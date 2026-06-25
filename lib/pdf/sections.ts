/**
 * PDF catalog sections use document outline/bookmarks when available; PDFs
 * without an outline fall back to one section per physical page.
 *
 * This module supports PDFs with an extractable text layer. Scanned/image-only
 * PDFs need OCR before they can be searched or summarized.
 */
import {
  getPdfDocument,
  type PDFDocumentProxy,
  type PageViewport,
} from "@/lib/pdf/pdfjs";
import type { EpubBlock, EpubSection } from "@/lib/types";

type PdfTextItem = {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

export type PdfTextRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfTextSpan = {
  text: string;
  pageNumber: number;
  blockId: string;
  lineIndex: number;
  itemIndex: number;
  rect: PdfTextRect | null;
};

export type PdfLine = {
  text: string;
  x: number;
  y: number;
  height: number;
  index: number;
  rects: PdfTextRect[];
  itemIndexes: number[];
};

export type PdfTextBlock = EpubBlock & {
  pageNumber: number;
  rects: PdfTextRect[];
  lineIndexes: number[];
};

export type PdfPageText = {
  pageNumber: number;
  pageId: string;
  width: number;
  height: number;
  spans: PdfTextSpan[];
  lines: PdfLine[];
  blocks: PdfTextBlock[];
  text: string;
};

type PdfOutlineItem = {
  title?: unknown;
  dest?: unknown;
  items?: unknown;
};

type PdfPageContent = {
  section: EpubSection;
  html: string;
  text: string;
  blocks: PdfTextBlock[];
};

const LINE_Y_TOLERANCE = 2.5;
const MIN_TEXT_LEN = 2;
const PARAGRAPH_GAP_FACTOR = 2.15;
const MODERATE_GAP_FACTOR = 1.65;

const LIST_MARKER_RE =
  /^(?:[-*•·]\s+|(?:\(?[0-9A-Za-z一二三四五六七八九十]+\)?[.)、])\s+)/;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str?: unknown }).str === "string"
  );
}

function itemX(item: PdfTextItem): number {
  return item.transform?.[4] ?? 0;
}

function itemY(item: PdfTextItem): number {
  return item.transform?.[5] ?? 0;
}

function itemHeight(item: PdfTextItem): number {
  const fromTransform = Math.abs(item.transform?.[3] ?? 0);
  const fromItem = Math.abs(item.height ?? 0);
  return fromTransform || fromItem || 10;
}

function pageIdForNumber(pageNumber: number): string {
  return `page-${pageNumber}`;
}

function normalizedRectFromViewportRectangle(rect: number[]): PdfTextRect | null {
  if (rect.length < 4 || rect.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const left = Math.min(rect[0], rect[2]);
  const top = Math.min(rect[1], rect[3]);
  const right = Math.max(rect[0], rect[2]);
  const bottom = Math.max(rect[1], rect[3]);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

function itemRect(item: PdfTextItem, viewport: PageViewport | null): PdfTextRect | null {
  const x = itemX(item);
  const y = itemY(item);
  const width = Math.abs(item.width ?? 0);
  const height = itemHeight(item);
  if (width <= 0 || height <= 0) return null;

  if (viewport?.convertToViewportRectangle) {
    return normalizedRectFromViewportRectangle(
      viewport.convertToViewportRectangle([x, y - height, x + width, y]),
    );
  }

  return { x, y: Math.max(0, y - height), width, height };
}

function unionRects(rects: PdfTextRect[]): PdfTextRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function blockIdForPage(pageNumber: number, blockIndex: number): string {
  return `${pageIdForNumber(pageNumber)}-blk-${blockIndex + 1}`;
}

function shouldJoinWithSpace(current: string, next: string): boolean {
  if (!current || !next) return false;
  if (/\s$/.test(current) || /^\s/.test(next)) return false;
  if (/^[,.;:!?，。；：！？、）】》」』]/.test(next)) return false;
  if (/[（【《「『]$/.test(current)) return false;
  const prev = current.at(-1) ?? "";
  const first = next.charAt(0);
  const prevAscii = /[A-Za-z0-9]$/.test(prev);
  const nextAscii = /^[A-Za-z0-9]/.test(first);
  return prevAscii || nextAscii;
}

function pushLine(lines: PdfLine[], line: PdfLine | null): PdfLine | null {
  if (!line) return null;
  const text = normalizeText(line.text);
  if (text.length >= MIN_TEXT_LEN) {
    lines.push({ ...line, index: lines.length, text });
  }
  return null;
}

function textItemsToLines(
  items: PdfTextItem[],
  rects: Array<PdfTextRect | null>,
): PdfLine[] {
  const lines: PdfLine[] = [];
  let current: PdfLine | null = null;

  items.forEach((item, itemIndex) => {
    const raw = item.str;
    const text = raw.replace(/\s+/g, " ");
    const x = itemX(item);
    const y = itemY(item);
    const height = itemHeight(item);
    const yTolerance = Math.max(LINE_Y_TOLERANCE, height * 0.35);

    if (!text.trim()) {
      if (item.hasEOL) current = pushLine(lines, current);
      return;
    }

    if (
      current &&
      Math.abs(y - current.y) > yTolerance
    ) {
      current = pushLine(lines, current);
    }

    if (!current) {
      current = {
        text: "",
        x,
        y,
        height,
        index: lines.length,
        rects: [],
        itemIndexes: [],
      };
    }

    current.text += shouldJoinWithSpace(current.text, text) ? ` ${text}` : text;
    current.x = Math.min(current.x, x);
    current.height = Math.max(current.height, height);
    current.y = y;
    current.itemIndexes.push(itemIndex);
    const rect = rects[itemIndex];
    if (rect) current.rects.push(rect);

    if (item.hasEOL) {
      current = pushLine(lines, current);
    }
  });

  pushLine(lines, current);
  return lines;
}

function median(values: number[]): number {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isLikelyHeading(line: PdfLine, medianHeight: number): boolean {
  if (line.text.length > 120) return false;
  if (line.height >= medianHeight * 1.32) return true;
  if (
    line.height >= medianHeight * 1.18 &&
    /^(?:第\s*[\d一二三四五六七八九十]+|Chapter|PART|Part|Section)\b/.test(
      line.text,
    )
  ) {
    return true;
  }
  return false;
}

function isListStart(line: PdfLine): boolean {
  return LIST_MARKER_RE.test(line.text);
}

function joinPdfLineText(current: string, next: string): string {
  if (!current) return next;
  const trimmed = current.trimEnd();
  if (trimmed.endsWith("-") && /^[A-Za-z]/.test(next)) {
    return `${trimmed.slice(0, -1)}${next}`;
  }
  return `${current}${shouldJoinWithSpace(current, next) ? " " : ""}${next}`;
}

function startsNewParagraph(params: {
  firstLine: PdfLine;
  previousLine: PdfLine;
  line: PdfLine;
  medianHeight: number;
}): boolean {
  const { firstLine, previousLine, line, medianHeight } = params;
  const verticalGap = Math.abs(previousLine.y - line.y);
  const largeGap =
    verticalGap >
    Math.max(
      medianHeight * PARAGRAPH_GAP_FACTOR,
      previousLine.height * 2,
      18,
    );
  if (largeGap) return true;

  const moderateGap =
    verticalGap >
    Math.max(
      medianHeight * MODERATE_GAP_FACTOR,
      previousLine.height * 1.55,
      14,
    );
  if (!moderateGap) return false;

  if (isListStart(line) && !isListStart(firstLine)) return true;

  const xShift = Math.abs(line.x - firstLine.x);
  if (xShift > medianHeight * 3) return true;

  return false;
}

function blockTextForLines(lines: PdfLine[]): string {
  return normalizeText(
    lines.reduce((text, line) => joinPdfLineText(text, line.text), ""),
  );
}

function blockRectsForLines(lines: PdfLine[]): PdfTextRect[] {
  const rects = lines.flatMap((line) => {
    const lineRect = unionRects(line.rects);
    return lineRect ? [lineRect] : line.rects;
  });
  return rects.length ? rects : lines.flatMap((line) => line.rects);
}

function linesToBlocks(
  lines: PdfLine[],
  pageNumber: number,
  pageId: string,
): PdfTextBlock[] {
  const medianHeight = median(lines.map((line) => line.height));
  const blocks: PdfTextBlock[] = [];
  let currentLines: PdfLine[] = [];

  const pushCurrent = () => {
    if (currentLines.length === 0) return;
    const text = blockTextForLines(currentLines);
    if (text.length < MIN_TEXT_LEN) {
      currentLines = [];
      return;
    }
    const firstLine = currentLines[0];
    const heading =
      currentLines.length === 1 && isLikelyHeading(firstLine, medianHeight);
    const blockIndex = blocks.length;
    blocks.push({
      id: blockIdForPage(pageNumber, blockIndex),
      type: heading ? "heading" : "paragraph",
      text,
      chapterId: pageId,
      index: blockIndex,
      pageNumber,
      rects: blockRectsForLines(currentLines),
      lineIndexes: currentLines.map((line) => line.index),
      ...(heading ? { level: 2 } : {}),
    });
    currentLines = [];
  };

  for (const line of lines) {
    const lineIsHeading = isLikelyHeading(line, medianHeight);
    if (lineIsHeading) {
      pushCurrent();
      currentLines = [line];
      pushCurrent();
      continue;
    }

    const previousLine = currentLines.at(-1);
    if (
      previousLine &&
      startsNewParagraph({
        firstLine: currentLines[0],
        previousLine,
        line,
        medianHeight,
      })
    ) {
      pushCurrent();
    }
    currentLines.push(line);
  }

  pushCurrent();
  return blocks;
}

type PdfPageTextSource = {
  getTextContent: () => Promise<{ items: unknown[] }>;
  getViewport?: (params: { scale: number }) => PageViewport;
};

export async function extractPdfPageText(
  page: PdfPageTextSource,
  options: { pageNumber?: number; pageId?: string } = {},
): Promise<PdfPageText> {
  const pageNumber = options.pageNumber ?? 1;
  const pageId = options.pageId ?? pageIdForNumber(pageNumber);
  const viewport = page.getViewport?.({ scale: 1 }) ?? null;
  const content = await page.getTextContent();
  const items = content.items.filter(isPdfTextItem);
  const rects = items.map((item) => itemRect(item, viewport));
  const lines = textItemsToLines(items, rects);
  const blocks = linesToBlocks(lines, pageNumber, pageId);
  const itemToLine = new Map<number, number>();
  for (const line of lines) {
    for (const itemIndex of line.itemIndexes) {
      itemToLine.set(itemIndex, line.index);
    }
  }
  const itemToBlock = new Map<number, string>();
  const lineToBlock = new Map<number, string>();
  for (const block of blocks) {
    for (const lineIndex of block.lineIndexes) {
      lineToBlock.set(lineIndex, block.id);
    }
  }
  for (const [itemIndex, lineIndex] of itemToLine.entries()) {
    const blockId = lineToBlock.get(lineIndex);
    if (blockId) itemToBlock.set(itemIndex, blockId);
  }
  const spans = items
    .map((item, itemIndex): PdfTextSpan | null => {
      const text = normalizeText(item.str);
      if (!text) return null;
      const lineIndex = itemToLine.get(itemIndex) ?? -1;
      const blockId = itemToBlock.get(itemIndex);
      if (!blockId) return null;
      return {
        text,
        pageNumber,
        blockId,
        lineIndex,
        itemIndex,
        rect: rects[itemIndex] ?? null,
      };
    })
    .filter((span): span is PdfTextSpan => Boolean(span));
  return {
    pageNumber,
    pageId,
    width: viewport?.width ?? 0,
    height: viewport?.height ?? 0,
    spans,
    lines,
    blocks,
    text: lines.map((line) => line.text).join("\n"),
  };
}

function htmlForPdfPage(pageNumber: number, title: string, pageText: PdfPageText): string {
  const body =
    pageText.blocks.length > 0
      ? pageText.blocks
          .map((block) => {
            const tag = block.type === "heading" ? "h2" : "p";
            const className = tag === "h2" ? "pdf-heading" : "pdf-line";
            const headingAttrs =
              block.type === "heading"
                ? ` data-se-heading-level="${block.level ?? 2}" data-heading-id="${escapeHtml(block.id)}" data-heading-level="${block.level ?? 2}"`
                : "";
            return `<${tag} class="${className}" data-se-block-id="${escapeHtml(block.id)}" data-block-id="${escapeHtml(block.id)}" data-chapter-id="${escapeHtml(block.chapterId)}"${headingAttrs}>${escapeHtml(block.text)}</${tag}>`;
          })
          .join("\n")
      : `<div class="pdf-empty" aria-hidden="true"></div>`;

  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <article class="pdf-page" data-pdf-page="${pageNumber}">
    <h1>${escapeHtml(title)}</h1>
    ${body}
  </article>
</body>
</html>`;
}

function htmlForPdfPages(title: string, pageHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <title>${escapeHtml(title)}</title>
</head>
<body>
  ${pageHtml}
</body>
</html>`;
}

function bodyForPdfPage(pageNumber: number, title: string, pageText: PdfPageText): string {
  const fullHtml = htmlForPdfPage(pageNumber, title, pageText);
  return fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? "";
}

function createPdfPageSection(pageNumber: number): EpubSection {
  return {
    id: `page-${pageNumber}`,
    index: pageNumber - 1,
    title: `第 ${pageNumber} 页`,
    href: `page:${pageNumber}`,
    format: "pdf",
    pageNumber,
    endPageNumber: pageNumber,
  };
}

function pageNumberFromSection(section: EpubSection): number {
  if (typeof section.pageNumber === "number" && section.pageNumber > 0) {
    return section.pageNumber;
  }
  const fromHref = section.href.match(/^page:(\d+)$/)?.[1];
  if (fromHref) return Number(fromHref);
  return section.index + 1;
}

function pageRangeFromSection(
  section: EpubSection,
  numPages: number,
): { start: number; end: number } {
  const start = Math.min(Math.max(1, pageNumberFromSection(section)), numPages);
  const rawEnd =
    typeof section.endPageNumber === "number" && section.endPageNumber >= start
      ? section.endPageNumber
      : start;
  return {
    start,
    end: Math.min(Math.max(start, rawEnd), numPages),
  };
}

function metadataTitleFromInfo(info: unknown): string | undefined {
  if (!info || typeof info !== "object") return undefined;
  const title = (info as { Title?: unknown }).Title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

function isPdfOutlineItem(value: unknown): value is PdfOutlineItem {
  return typeof value === "object" && value !== null;
}

function clampPageNumber(pageNumber: number, numPages: number): number | null {
  if (!Number.isFinite(pageNumber)) return null;
  const normalized = Math.trunc(pageNumber);
  if (normalized < 1 || normalized > numPages) return null;
  return normalized;
}

async function pageNumberFromDestination(
  doc: PDFDocumentProxy,
  dest: unknown,
): Promise<number | null> {
  const destinationPromise =
    typeof dest === "string" ? doc.getDestination?.(dest) : null;
  const resolvedDest =
    typeof dest === "string"
      ? await (destinationPromise?.catch(() => null) ?? null)
      : dest;

  if (!Array.isArray(resolvedDest) || resolvedDest.length === 0) {
    return null;
  }

  const target = resolvedDest[0];
  if (typeof target === "number") {
    return clampPageNumber(target + 1, doc.numPages);
  }

  if (typeof target === "object" && target !== null) {
    const pageIndexPromise = doc.getPageIndex?.(target);
    const pageIndex = await (pageIndexPromise?.catch(() => null) ?? null);
    if (typeof pageIndex === "number") {
      return clampPageNumber(pageIndex + 1, doc.numPages);
    }
  }

  return null;
}

async function outlineSectionsFromDocument(
  doc: PDFDocumentProxy,
): Promise<EpubSection[]> {
  const outlinePromise = doc.getOutline?.();
  const outline = await (outlinePromise?.catch(() => null) ?? null);
  if (!Array.isArray(outline) || outline.length === 0) return [];

  const sections: EpubSection[] = [];

  const visit = async (items: unknown[], level: number): Promise<void> => {
    for (const item of items) {
      if (!isPdfOutlineItem(item)) continue;
      const title =
        typeof item.title === "string" ? normalizeText(item.title) : "";
      const pageNumber = await pageNumberFromDestination(doc, item.dest);
      if (title && pageNumber) {
        const index = sections.length;
        sections.push({
          id: `outline-${index + 1}-page-${pageNumber}`,
          index,
          title,
          href: `page:${pageNumber}`,
          format: "pdf",
          pageNumber,
          navLevel: level,
        });
      }

      if (Array.isArray(item.items) && item.items.length > 0) {
        await visit(item.items, level + 1);
      }
    }
  };

  await visit(outline, 0);

  return sections.map((section, index) => {
    const startPage = section.pageNumber ?? 1;
    const nextLaterPage = sections
      .slice(index + 1)
      .map((next) => next.pageNumber)
      .find(
        (pageNumber): pageNumber is number =>
          typeof pageNumber === "number" && pageNumber > startPage,
      );
    return {
      ...section,
      endPageNumber: nextLaterPage ? nextLaterPage - 1 : doc.numPages,
    };
  });
}

async function loadPdfPageFromDocument(
  doc: PDFDocumentProxy,
  section: EpubSection,
): Promise<{ html: string; text: string; blocks: PdfTextBlock[] }> {
  const { start, end } = pageRangeFromSection(section, doc.numPages);
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  const blocks: PdfTextBlock[] = [];

  for (let pageNumber = start; pageNumber <= end; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const pageText = await extractPdfPageText(page, {
      pageNumber,
      pageId: pageIdForNumber(pageNumber),
    });
    const title =
      start === end
        ? section.title || `第 ${pageNumber} 页`
        : `${section.title || `第 ${start} 页`} · 第 ${pageNumber} 页`;
    htmlParts.push(bodyForPdfPage(pageNumber, title, pageText));
    textParts.push(pageText.text);
    blocks.push(...pageText.blocks);
  }

  return {
    html:
      start === end
        ? htmlForPdfPages(section.title || `第 ${start} 页`, htmlParts.join("\n"))
        : htmlForPdfPages(section.title || `第 ${start}-${end} 页`, htmlParts.join("\n")),
    text: textParts.filter(Boolean).join("\n\n"),
    blocks,
  };
}

export async function parsePdfSections(arrayBuffer: ArrayBuffer): Promise<{
  sections: EpubSection[];
  metadataTitle?: string;
}> {
  const loadingTask = await getPdfDocument(arrayBuffer);
  const doc = await loadingTask.promise;

  try {
    const metadata = await doc.getMetadata().catch(() => null);
    const outlineSections = await outlineSectionsFromDocument(doc);
    const sections =
      outlineSections.length > 0
        ? outlineSections
        : Array.from({ length: doc.numPages }, (_, index) =>
            createPdfPageSection(index + 1),
          );
    return {
      sections,
      metadataTitle: metadataTitleFromInfo(metadata?.info),
    };
  } finally {
    await loadingTask.destroy();
  }
}

export async function loadPdfPageContent(
  arrayBuffer: ArrayBuffer,
  section: EpubSection,
): Promise<{ html: string; text: string; blocks: PdfTextBlock[] }> {
  const loadingTask = await getPdfDocument(arrayBuffer);
  const doc = await loadingTask.promise;

  try {
    return await loadPdfPageFromDocument(doc, section);
  } finally {
    await loadingTask.destroy();
  }
}

export async function loadPdfPagesContent(
  arrayBuffer: ArrayBuffer,
  sections: EpubSection[],
): Promise<PdfPageContent[]> {
  const loadingTask = await getPdfDocument(arrayBuffer);
  const doc = await loadingTask.promise;

  try {
    const pages: PdfPageContent[] = [];
    for (const section of sections) {
      const content = await loadPdfPageFromDocument(doc, section);
      pages.push({ section, ...content });
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

export async function loadAllPdfPagesContent(
  arrayBuffer: ArrayBuffer,
): Promise<PdfPageContent[]> {
  const loadingTask = await getPdfDocument(arrayBuffer);
  const doc = await loadingTask.promise;

  try {
    const pages: PdfPageContent[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const section = createPdfPageSection(pageNumber);
      const content = await loadPdfPageFromDocument(doc, section);
      pages.push({ section, ...content });
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

export async function visitPdfPageTexts(
  arrayBuffer: ArrayBuffer,
  sections: EpubSection[],
  visitor: (
    section: EpubSection,
    text: string,
  ) => void | boolean | Promise<void | boolean>,
): Promise<void> {
  const loadingTask = await getPdfDocument(arrayBuffer);
  const doc = await loadingTask.promise;

  try {
    for (const section of sections) {
      const { start, end } = pageRangeFromSection(section, doc.numPages);
      const textParts: string[] = [];
      for (let pageNumber = start; pageNumber <= end; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        const pageText = await extractPdfPageText(page, {
          pageNumber,
          pageId: pageIdForNumber(pageNumber),
        });
        textParts.push(pageText.text);
      }
      const shouldContinue = await visitor(
        section,
        textParts.filter(Boolean).join("\n\n"),
      );
      if (shouldContinue === false) break;
    }
  } finally {
    await loadingTask.destroy();
  }
}
