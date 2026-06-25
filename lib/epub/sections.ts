/**
 * Section = one OPF spine item (stable id: spine-{index}).
 */
import type { EpubSection } from "@/lib/types";

type SpineItem = { href: string; index: number; idref?: string };

type EpubSectionHandle = {
  href: string;
  render: (request?: (url: string) => Promise<unknown>) => Promise<string>;
};

type LoadedBook = {
  opened: Promise<unknown>;
  loaded: {
    metadata?: { title?: string };
    navigation?: { toc?: NavItem[] };
    spine?: { items?: SpineItem[] };
  };
  spine: {
    get: (target: number | string) => EpubSectionHandle | null;
    length: number;
  };
  load: (href: string) => Promise<string | Document | null>;
  destroy: () => void;
};

type NavItem = {
  label: string;
  href: string;
  subitems?: NavItem[];
};

const EPUB_OPTIONS = { replacements: "blobUrl" as const };

function flattenToc(items: NavItem[] | undefined): { label: string; href: string }[] {
  if (!items) return [];
  const out: { label: string; href: string }[] = [];
  for (const item of items) {
    out.push({ label: item.label, href: item.href });
    out.push(...flattenToc(item.subitems));
  }
  return out;
}

function titleForSpine(
  index: number,
  href: string,
  toc: { label: string; href: string }[],
): string {
  const normalized = href.split("#")[0];
  const match = toc.find(
    (t) => t.href === href || t.href.split("#")[0] === normalized,
  );
  if (match?.label) return match.label;
  return `Section ${index + 1}`;
}

type EpubFactory = (
  input: ArrayBuffer,
  options?: { replacements?: "base64" | "blobUrl" | "none" },
) => LoadedBook;

async function openBook(arrayBuffer: ArrayBuffer): Promise<LoadedBook> {
  const ePub = (await import("epubjs")).default as EpubFactory;
  const book = ePub(arrayBuffer, EPUB_OPTIONS);
  await book.opened;
  return book;
}

export async function parseEpubSections(arrayBuffer: ArrayBuffer): Promise<{
  sections: EpubSection[];
  metadataTitle?: string;
}> {
  const book = await openBook(arrayBuffer);

  try {
    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;
    await book.loaded.spine;

    const toc = flattenToc(navigation?.toc);
    const sections: EpubSection[] = [];

    for (let i = 0; i < book.spine.length; i++) {
      const item = book.spine.get(i);
      if (!item?.href) continue;
      sections.push({
        id: `spine-${i}`,
        index: i,
        title: titleForSpine(i, item.href, toc),
        href: item.href,
      });
    }

    const metadataTitle =
      typeof metadata?.title === "string" ? metadata.title : undefined;

    return {
      sections,
      metadataTitle,
    };
  } finally {
    book.destroy();
  }
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function textFromLoadedSection(loaded: string | Document | null): string {
  if (typeof Document !== "undefined" && loaded instanceof Document) {
    return stripHtml(loaded.documentElement.outerHTML);
  }
  return stripHtml(typeof loaded === "string" ? loaded : "");
}

/** Full section document HTML with EPUB resource URLs rewritten for preview. */
export async function loadSectionContent(
  arrayBuffer: ArrayBuffer,
  section: EpubSection,
): Promise<{ html: string; text: string }> {
  const book = await openBook(arrayBuffer);
  try {
    const spineSection = book.spine.get(section.index);
    if (!spineSection) {
      throw new Error(`Spine section not found: ${section.id}`);
    }

    const renderedHtml = await spineSection.render(book.load.bind(book));
    return { html: renderedHtml, text: stripHtml(renderedHtml) };
  } finally {
    book.destroy();
  }
}

export async function loadSectionText(
  arrayBuffer: ArrayBuffer,
  section: EpubSection,
): Promise<string> {
  const book = await openBook(arrayBuffer);
  try {
    const loaded = await book.load(section.href);
    return textFromLoadedSection(loaded);
  } finally {
    book.destroy();
  }
}

export async function visitSectionTexts(
  arrayBuffer: ArrayBuffer,
  sections: EpubSection[],
  visitor: (
    section: EpubSection,
    text: string,
  ) => void | boolean | Promise<void | boolean>,
): Promise<void> {
  const book = await openBook(arrayBuffer);
  try {
    for (const section of sections) {
      const loaded = await book.load(section.href);
      const shouldContinue = await visitor(
        section,
        textFromLoadedSection(loaded),
      );
      if (shouldContinue === false) break;
    }
  } finally {
    book.destroy();
  }
}
