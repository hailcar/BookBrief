import {
  loadSectionContent as loadEpubSectionContent,
  parseEpubSections,
  visitSectionTexts as visitEpubSectionTexts,
} from "@/lib/epub/sections";
import {
  loadAllPdfPagesContent,
  loadPdfPageContent,
  loadPdfPagesContent,
  parsePdfSections,
  visitPdfPageTexts,
  type PdfTextBlock,
} from "@/lib/pdf/sections";
import type { DocumentFormat, EpubSection } from "@/lib/types";

export type DocumentSectionContent = {
  section: EpubSection;
  html: string;
  text: string;
  blocks?: PdfTextBlock[];
};

export function documentFormatFromFileName(fileName: string): DocumentFormat | null {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".epub")) return "epub";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

export function documentFormatForBook(fileName: string, format?: DocumentFormat): DocumentFormat {
  return format ?? documentFormatFromFileName(fileName) ?? "epub";
}

export function isSupportedDocumentFileName(fileName: string): boolean {
  return documentFormatFromFileName(fileName) !== null;
}

export function documentFormatLabel(format: DocumentFormat): string {
  return format === "pdf" ? "PDF" : "EPUB";
}

export function documentSectionUnitLabel(format: DocumentFormat): string {
  return format === "pdf" ? "目录项" : "小节";
}

export function pdfPageAnchorId(pageNumber: number): string {
  return `page-${pageNumber}`;
}

export function pageNumberFromPdfPageAnchorId(sectionId: string): number | null {
  const pageNumber = sectionId.match(/^page-(\d+)$/)?.[1];
  return pageNumber ? Number(pageNumber) : null;
}

function pageNumberFromSection(section: EpubSection): number | null {
  if (typeof section.pageNumber === "number" && section.pageNumber > 0) {
    return section.pageNumber;
  }
  const fromHref = section.href.match(/^page:(\d+)$/)?.[1];
  return fromHref ? Number(fromHref) : null;
}

export function pdfPageAnchorIdForSection(
  section: EpubSection,
): string | undefined {
  const pageNumber = pageNumberFromSection(section);
  return pageNumber ? pdfPageAnchorId(pageNumber) : undefined;
}

export function sectionForPdfPageAnchor(
  sections: EpubSection[],
  sectionId: string,
): EpubSection | undefined {
  const exact = sections.find((section) => section.id === sectionId);
  if (exact) return exact;

  const pageNumber = pageNumberFromPdfPageAnchorId(sectionId);
  if (!pageNumber) return undefined;

  const containing = sections
    .filter((section) => {
      const start = pageNumberFromSection(section);
      if (!start || start > pageNumber) return false;
      const end =
        typeof section.endPageNumber === "number" && section.endPageNumber >= start
          ? section.endPageNumber
          : start;
      return pageNumber <= end;
    })
    .sort((a, b) => {
      const levelDelta = (b.navLevel ?? 0) - (a.navLevel ?? 0);
      if (levelDelta !== 0) return levelDelta;
      return b.index - a.index;
    });

  if (containing[0]) return containing[0];

  return sections
    .filter((section) => {
      const start = pageNumberFromSection(section);
      return !!start && start <= pageNumber;
    })
    .sort((a, b) => {
      const startDelta =
        (pageNumberFromSection(b) ?? 0) - (pageNumberFromSection(a) ?? 0);
      if (startDelta !== 0) return startDelta;
      return b.index - a.index;
    })[0];
}

export async function parseDocumentSections(
  arrayBuffer: ArrayBuffer,
  format: DocumentFormat,
): Promise<{ sections: EpubSection[]; metadataTitle?: string }> {
  if (format === "pdf") return parsePdfSections(arrayBuffer);
  return parseEpubSections(arrayBuffer);
}

export async function loadDocumentSectionContent(
  arrayBuffer: ArrayBuffer,
  section: EpubSection,
  format: DocumentFormat,
): Promise<{ html: string; text: string; blocks?: PdfTextBlock[] }> {
  if (format === "pdf") return loadPdfPageContent(arrayBuffer, section);
  return loadEpubSectionContent(arrayBuffer, section);
}

export async function loadDocumentSectionsContent(
  arrayBuffer: ArrayBuffer,
  sections: EpubSection[],
  format: DocumentFormat,
): Promise<DocumentSectionContent[]> {
  if (format === "pdf") return loadPdfPagesContent(arrayBuffer, sections);
  const pages: DocumentSectionContent[] = [];
  for (const section of sections) {
    const content = await loadEpubSectionContent(arrayBuffer, section);
    pages.push({ section, ...content });
  }
  return pages;
}

export async function loadDocumentPagesContent(
  arrayBuffer: ArrayBuffer,
  format: DocumentFormat,
): Promise<DocumentSectionContent[]> {
  if (format === "pdf") return loadAllPdfPagesContent(arrayBuffer);
  throw new Error("Only PDF documents expose physical page content");
}

export async function visitDocumentSectionTexts(
  arrayBuffer: ArrayBuffer,
  sections: EpubSection[],
  format: DocumentFormat,
  visitor: (
    section: EpubSection,
    text: string,
  ) => void | boolean | Promise<void | boolean>,
): Promise<void> {
  if (format === "pdf") {
    await visitPdfPageTexts(arrayBuffer, sections, visitor);
    return;
  }
  await visitEpubSectionTexts(arrayBuffer, sections, visitor);
}
