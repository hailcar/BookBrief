/**
 * Canonical in-spine content blocks for heading-scoped summaries.
 * Section = one OPF spine item (chapterId = section.id).
 */
import type { EpubBlock, EpubHeading } from "@/lib/types";
import { sanitizeEpubDocument, sanitizeEpubHtml } from "@/lib/epub/sanitize";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

const HEADING_CLASS_RE =
  /(?:^|\s)(?:title|heading|chapter|section-title|chapter-title|part-title)(?:\s|$)/i;

const PAGE_NUM_RE = /^[\d\s·•\-–—.]+$/;

const MIN_TEXT_LEN = 2;

let blockIdSeq = 0;
let blockIdPrefix = "";

function nextBlockId(): string {
  blockIdSeq += 1;
  return `${blockIdPrefix}blk-${blockIdSeq}`;
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function headingLevelFromTag(tag: string): number {
  const n = Number(tag.charAt(1));
  return Number.isFinite(n) ? n : 2;
}

function isDecorativeText(text: string): boolean {
  if (text.length < MIN_TEXT_LEN) return true;
  if (PAGE_NUM_RE.test(text) && text.length < 24) return true;
  return false;
}

function isHeadingElement(el: Element): { level: number } | null {
  const tag = el.tagName;
  if (HEADING_TAGS.has(tag)) {
    return { level: headingLevelFromTag(tag) };
  }
  const cls = el.getAttribute("class") ?? "";
  if (HEADING_CLASS_RE.test(cls)) {
    let level = 2;
    if (/\bh1\b/i.test(cls)) level = 1;
    else if (/\bh2\b/i.test(cls)) level = 2;
    else if (/\bh3\b/i.test(cls)) level = 3;
    else if (/\bpart\b/i.test(cls)) level = 1;
    return { level };
  }
  return null;
}

function isContentCandidate(el: Element): boolean {
  const tag = el.tagName;
  if (isHeadingElement(el)) return true;
  if (tag === "P" || tag === "BLOCKQUOTE" || tag === "PRE" || tag === "FIGCAPTION") {
    return true;
  }
  if (tag === "LI") return true;
  if (tag === "TD" || tag === "TH") return true;
  if (tag === "IMG") {
    const alt = normalizeText(el.getAttribute("alt") ?? "");
    return alt.length >= MIN_TEXT_LEN;
  }
  return false;
}

function blockTypeForElement(
  el: Element,
  heading: { level: number } | null,
): EpubBlock["type"] {
  if (heading) return "heading";
  const tag = el.tagName;
  if (tag === "BLOCKQUOTE") return "quote";
  if (tag === "LI") return "list_item";
  if (tag === "PRE") return "code";
  if (tag === "FIGCAPTION") return "image_caption";
  if (tag === "TD" || tag === "TH") return "table";
  if (tag === "IMG") return "image_caption";
  return "paragraph";
}

function textFromElement(el: Element, type: EpubBlock["type"]): string {
  if (type === "image_caption" && el.tagName === "IMG") {
    return normalizeText(el.getAttribute("alt") ?? "");
  }
  return normalizeText(el.textContent ?? "");
}

/** Document-order walk; one block per matching element (no duplicate nested p inside blockquote if we only match leaf... li contains p - both may match). Prefer skipping nested: if parent is also candidate block, skip child for p inside blockquote? */
function shouldSkipNested(el: Element): boolean {
  let p = el.parentElement;
  while (p) {
    const tag = p.tagName;
    if (tag === "BLOCKQUOTE" || tag === "LI" || tag === "TD" || tag === "TH") {
      if (el.tagName === "P") return true;
    }
    if (HEADING_TAGS.has(tag) || isHeadingElement(p)) return false;
    p = p.parentElement;
  }
  return false;
}

function walkElements(root: Element, visit: (el: Element) => void): void {
  const stack: Element[] = [root];
  while (stack.length) {
    const el = stack.shift()!;
    visit(el);
    for (const child of Array.from(el.children)) {
      stack.push(child);
    }
  }
}

export function extractBlocksFromHtml(
  html: string,
  chapterId: string,
  options: { blockIdPrefix?: string } = {},
): { blocks: EpubBlock[]; annotatedHtml: string } {
  blockIdSeq = 0;
  blockIdPrefix = options.blockIdPrefix ?? "";
  if (typeof DOMParser === "undefined") {
    blockIdPrefix = "";
    return { blocks: [], annotatedHtml: sanitizeEpubHtml(html) };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeEpubDocument(doc);
  doc.querySelectorAll("style, nav").forEach((el) => el.remove());

  const body = doc.body;
  if (!body) {
    blockIdPrefix = "";
    return { blocks: [], annotatedHtml: html };
  }

  const blocks: EpubBlock[] = [];
  let index = 0;

  walkElements(body, (el) => {
    if (!isContentCandidate(el)) return;
    if (shouldSkipNested(el)) return;

    const heading = isHeadingElement(el);
    const type = blockTypeForElement(el, heading);
    const text = textFromElement(el, type);
    if (isDecorativeText(text) && type !== "heading") return;
    if (type === "heading" && text.length < 1) return;

    const id = nextBlockId();
    el.setAttribute("data-se-block-id", id);
    el.setAttribute("data-block-id", id);
    el.setAttribute("data-chapter-id", chapterId);
    if (type === "heading" && heading) {
      el.setAttribute("data-se-heading-level", String(heading.level));
      el.setAttribute("data-heading-id", id);
      el.setAttribute("data-heading-level", String(heading.level));
    }

    const block: EpubBlock = {
      id,
      type,
      text,
      chapterId,
      index,
      ...(type === "heading" && heading ? { level: heading.level } : {}),
    };
    blocks.push(block);
    index += 1;
  });

  if (blocks.length === 0) {
    const bodyText = normalizeText(body.textContent ?? "");
    if (bodyText.length >= MIN_TEXT_LEN) {
      const id = nextBlockId();
      const wrap = doc.createElement("p");
      wrap.setAttribute("data-se-block-id", id);
      wrap.setAttribute("data-block-id", id);
      wrap.setAttribute("data-chapter-id", chapterId);
      wrap.textContent = bodyText;
      body.appendChild(wrap);
      blocks.push({
        id,
        type: "paragraph",
        text: bodyText,
        chapterId,
        index: 0,
      });
    }
  }

  const serialized =
    doc.documentElement.outerHTML.length > 0
      ? `<!DOCTYPE html>${doc.documentElement.outerHTML}`
      : html;
  blockIdPrefix = "";
  return { blocks, annotatedHtml: serialized };
}

function markdownForBlock(block: EpubBlock): string {
  if (block.type === "heading" && block.level) {
    const hashes = "#".repeat(Math.min(6, Math.max(1, block.level)));
    return `${hashes} ${block.text}`;
  }
  if (block.type === "quote") return `> ${block.text}`;
  if (block.type === "list_item") return `- ${block.text}`;
  if (block.type === "code") return "```\n" + block.text + "\n```";
  return block.text;
}

export function collectContentUnderHeading(params: {
  blocks: EpubBlock[];
  headingBlockId: string;
}): {
  heading: EpubHeading;
  contentBlocks: EpubBlock[];
  plainText: string;
  markdownText: string;
  startIndex: number;
  endIndex: number;
} {
  const { blocks, headingBlockId } = params;
  const startIdx = blocks.findIndex((b) => b.id === headingBlockId);
  if (startIdx < 0) {
    throw new Error(`标题 block 未找到: ${headingBlockId}`);
  }
  const headBlock = blocks[startIdx];
  if (headBlock.type !== "heading" || headBlock.level == null) {
    throw new Error("所选 block 不是标题");
  }

  const heading: EpubHeading = {
    id: headBlock.id,
    text: headBlock.text,
    level: headBlock.level,
    index: headBlock.index,
    chapterId: headBlock.chapterId,
    blockId: headBlock.id,
  };

  const contentBlocks: EpubBlock[] = [];
  let endIndex = startIdx;

  for (let i = startIdx + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "heading" && b.level != null && b.level <= headBlock.level) {
      break;
    }
    contentBlocks.push(b);
    endIndex = i;
  }

  const plainParts = contentBlocks.map((b) => b.text).filter(Boolean);
  const plainText = plainParts.join("\n\n");
  const markdownText = contentBlocks.map(markdownForBlock).join("\n\n");

  return {
    heading,
    contentBlocks,
    plainText,
    markdownText,
    startIndex: startIdx + 1,
    endIndex: contentBlocks.length ? endIndex : startIdx,
  };
}

export function headingSummaryCacheKey(
  sectionId: string,
  headingBlockId: string,
): string {
  return `${sectionId}::h::${headingBlockId}`;
}

export function createContentHash(parts: unknown[]): string {
  const input = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv1a-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function contentHashForHeadingSection(params: {
  heading: EpubHeading;
  contentBlocks: EpubBlock[];
  markdownText: string;
  options: Record<string, unknown>;
}): string {
  return createContentHash([
    params.heading.text,
    params.heading.level,
    params.heading.blockId,
    params.contentBlocks.map((block) => [block.id, block.type, block.text]),
    params.markdownText,
    params.options,
  ]);
}

export function findSummarizableHeadings(
  blocks: EpubBlock[],
  minChars = 80,
): EpubHeading[] {
  const headings = blocks.filter(
    (block) =>
      block.type === "heading" &&
      block.level !== undefined &&
      block.level >= 1 &&
      block.level <= 3 &&
      block.text.trim().length > 0,
  );

  const out: EpubHeading[] = [];
  for (const headingBlock of headings) {
    try {
      const collected = collectContentUnderHeading({
        blocks,
        headingBlockId: headingBlock.id,
      });
      if (collected.plainText.replace(/\s+/g, "").length < minChars) continue;
      out.push(collected.heading);
    } catch {
      /* ignore malformed heading blocks */
    }
  }
  return out;
}

export function splitTextForChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf("\n\n", maxChars);
    if (cut < maxChars * 0.35) cut = rest.lastIndexOf("。", maxChars);
    if (cut < maxChars * 0.35) cut = rest.lastIndexOf(". ", maxChars);
    if (cut < maxChars * 0.35) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}
