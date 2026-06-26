import {
  HEADING_INTERACTION_STYLE,
} from "@/lib/epub/heading-interaction";
import { sanitizeEpubDocument, sanitizeEpubHtml } from "@/lib/epub/sanitize";
import {
  DEFAULT_READER_SETTINGS,
  READER_CONTENT_MAX_PX,
  READER_FONT_SIZE_PX,
  type ReaderImageMode,
  type ReaderSettings,
} from "@/lib/reader-settings";
import {
  getBrowserStorageItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";

export type EpubDisplayMode = "publisher" | "global";

const KEY = "summary_epub_display_mode";

export const EPUB_DISPLAY_MODE_LABELS: Record<EpubDisplayMode, string> = {
  publisher: "原貌",
  global: "阅读版式",
};

export function loadEpubDisplayMode(): EpubDisplayMode {
  try {
    const raw = getBrowserStorageItem(KEY);
    if (raw === "publisher" || raw === "global") return raw;
  } catch {
    /* ignore */
  }
  return "global";
}

export function saveEpubDisplayMode(mode: EpubDisplayMode): boolean {
  return setBrowserStorageItem(KEY, mode);
}

export type EpubReaderLayout = "embedded" | "fullscreen";

const SHARED_SHELL = `
<style id="summary-epub-shell">
  html {
    -webkit-text-size-adjust: 100%;
    background: #e7e2d8;
    min-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
  body {
    margin: 0;
    min-height: 100%;
    background: #e7e2d8;
    overflow-x: hidden;
  }
  #summary-epub-stage {
    box-sizing: border-box;
    min-height: 100%;
    padding: 20px 16px 32px;
    display: flex;
    justify-content: center;
  }
  #summary-epub-root {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    background: #faf8f3;
    color: #1c1917;
    border-radius: 4px;
    box-shadow:
      0 1px 2px rgb(28 25 23 / 6%),
      0 8px 24px rgb(28 25 23 / 8%),
      0 0 0 1px rgb(28 25 23 / 4%);
    transform-origin: top center;
    overflow: visible;
  }
  .summary-epub-table-scroll {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-block: 1em;
  }
</style>
`;

function imageCss(mode: ReaderImageMode, layout: EpubReaderLayout): string {
  const maxH =
    layout === "fullscreen"
      ? "max-height: calc(100dvh - 160px) !important;"
      : "max-height: calc(100dvh - 220px) !important;";

  const base = `
  #summary-epub-root img,
  #summary-epub-root picture img,
  #summary-epub-root video,
  #summary-epub-root svg {
    display: block;
    margin: 1.2em auto;
    object-fit: contain !important;
    width: auto !important;
    height: auto !important;
    ${maxH}
  }`;

  if (mode === "full-width") {
    return `${base}
  #summary-epub-root img,
  #summary-epub-root picture img {
    max-width: 100% !important;
    width: 100% !important;
    height: auto !important;
  }`;
  }
  if (mode === "original") {
    return `${base}
  #summary-epub-root img,
  #summary-epub-root picture img {
    max-width: 100% !important;
  }`;
  }
  return `${base}
  #summary-epub-root img,
  #summary-epub-root picture img {
    max-width: 100% !important;
  }`;
}

function publisherImageCss(): string {
  return `
  #summary-epub-root :where(img, picture img, video, svg) {
    max-width: 100%;
  }`;
}

function buildGlobalTypo(
  settings: ReaderSettings,
  layout: EpubReaderLayout,
): string {
  const fontPx = READER_FONT_SIZE_PX[settings.fontSize];
  const maxPx = READER_CONTENT_MAX_PX[settings.contentWidth];
  const pad =
    layout === "fullscreen" ? "32px 40px 40px" : "2rem 1.75rem 2.25rem";

  return `
<style id="summary-epub-global-mode">
  #summary-epub-root {
    max-width: ${maxPx}px;
    margin-inline: auto;
    padding: ${pad};
    font-family: Literata, "Songti SC", "Noto Serif SC", Georgia, serif;
    font-size: ${fontPx}px;
    line-height: 1.75;
    letter-spacing: 0.01em;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  #summary-epub-root :where(p, li, blockquote, dd) {
    margin-block: 0 1em;
  }
  #summary-epub-root :where(h1, h2, h3, h4, h5, h6) {
    font-family: Literata, "Songti SC", "Noto Serif SC", Georgia, serif;
    line-height: 1.35;
    font-weight: 600;
    margin-block: 1.35em 0.55em;
  }
  #summary-epub-root h1 { font-size: 1.65rem; }
  #summary-epub-root h2 { font-size: 1.4rem; }
  #summary-epub-root h3 { font-size: 1.2rem; }
  #summary-epub-root :where(ul, ol) {
    padding-inline-start: 1.35em;
    margin-block: 0 1em;
  }
  #summary-epub-root blockquote {
    margin-inline: 0;
    padding: 0.35em 0 0.35em 1em;
    border-inline-start: 3px solid #d6d3d1;
  }
  #summary-epub-root hr {
    border: none;
    border-top: 1px solid #e7e5e4;
    margin: 1.75em 0;
  }
  ${imageCss(settings.imageMode, layout)}
  #summary-epub-root table {
    border-collapse: collapse;
    font-size: 0.95em;
    max-width: 100%;
  }
  #summary-epub-root :where(td, th) {
    border: 1px solid #e7e5e4;
    padding: 0.4em 0.55em;
  }
  #summary-epub-root pre,
  #summary-epub-root code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.88em;
  }
  #summary-epub-root pre {
    max-width: 100%;
    overflow-x: auto;
    padding: 0.85em 1em;
    background: #f5f5f4;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  #summary-epub-root a {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
`;
}

function buildPublisherTypo(): string {
  return `
<style id="summary-epub-publisher-mode">
  #summary-epub-root {
    padding: 12px;
    background: #fffefb;
  }
  ${publisherImageCss()}
</style>
`;
}

function buildInject(
  mode: EpubDisplayMode,
  settings: ReaderSettings,
  layout: EpubReaderLayout,
): string {
  const typo =
    mode === "global"
      ? buildGlobalTypo(settings, layout)
      : buildPublisherTypo();
  return `${SHARED_SHELL}${typo}${HEADING_INTERACTION_STYLE}`;
}

function injectIntoHtml(html: string, inject: string): string {
  const lower = html.toLowerCase();
  if (lower.includes("</head>")) {
    return html.replace(/<\/head>/i, `${inject}</head>`);
  }
  if (lower.includes("<body")) {
    return html.replace(/<body/i, `${inject}<body`);
  }
  return `<!DOCTYPE html><html lang="zh-Hans"><head>${inject}</head><body>${html}</body></html>`;
}

function prepareEpubPreviewHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return sanitizeEpubHtml(html);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeEpubDocument(doc);

  const head = doc.head;
  if (head) {
    let viewport = head.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) {
      viewport = doc.createElement("meta");
      viewport.setAttribute("name", "viewport");
      head.appendChild(viewport);
    }
    viewport.setAttribute("content", "width=device-width, initial-scale=1");
  }

  const body = doc.body;
  if (body && !doc.getElementById("summary-epub-stage")) {
    const stage = doc.createElement("div");
    stage.id = "summary-epub-stage";
    const root = doc.createElement("div");
    root.id = "summary-epub-root";
    while (body.firstChild) {
      root.appendChild(body.firstChild);
    }
    stage.appendChild(root);
    body.appendChild(stage);
  }

  doc.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("summary-epub-table-scroll")) {
      return;
    }
    const wrap = doc.createElement("div");
    wrap.className = "summary-epub-table-scroll";
    table.parentNode?.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

/** Apply reading shell + optional typography (global mode). */
export function applyEpubDisplayMode(
  html: string,
  mode: EpubDisplayMode,
  readerSettings: ReaderSettings = DEFAULT_READER_SETTINGS,
  layout: EpubReaderLayout = "embedded",
): string {
  return injectIntoHtml(
    prepareEpubPreviewHtml(html),
    buildInject(mode, readerSettings, layout),
  );
}
