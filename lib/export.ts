import { getBrowserStorageItem, setBrowserStorageItem } from "@/lib/browser-storage";
import {
  documentFormatFromFileName,
  documentFormatForBook,
} from "@/lib/documents";
import type {
  BackupBookPayload,
  EpubComment,
  ExportPayload,
  LibraryBackupPayload,
  ParsedBackupBook,
  ParsedBackupPayload,
  ReadingBookmark,
  SectionSummary,
  StoredBook,
} from "@/lib/types";

const READER_STATE_PREFIX = "summary_epub_reader_state:";

export function buildExportPayload(book: StoredBook): ExportPayload {
  return {
    version: 1,
    exportedAt: Date.now(),
    book: {
      fileName: book.fileName,
      format: book.format,
      uploadedAt: book.uploadedAt,
      sections: book.sections,
      summaries: Object.values(book.summaries),
      comments: Object.values(book.comments ?? {}),
    },
  };
}

export function readerStateKeyForBook(bookId: string): string {
  return `${READER_STATE_PREFIX}${bookId}`;
}

export function readReaderStateForBackup(bookId: string): unknown {
  const raw = getBrowserStorageItem(readerStateKeyForBook(bookId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeReaderStateFromBackup(
  bookId: string,
  readerState: unknown,
): void {
  if (!readerState || typeof readerState !== "object") return;
  setBrowserStorageItem(readerStateKeyForBook(bookId), JSON.stringify(readerState));
}

function safeFileBase(fileName: string): string {
  const withoutExt = fileName.replace(/\.(?:epub|pdf)$/i, "") || "book";
  return withoutExt.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "book";
}

export function backupFileNameForBook(book: Pick<StoredBook, "fileName">): string {
  return `${safeFileBase(book.fileName)}-backup.json`;
}

export function backupFileNameForLibrary(): string {
  return "summary-epub-library-backup.json";
}

export function markdownFileNameForBook(book: Pick<StoredBook, "fileName">): string {
  return `${safeFileBase(book.fileName)}-notes.md`;
}

function markdownEscapeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function markdownSectionHeading(level: number, title: string): string {
  return `${"#".repeat(level)} ${markdownEscapeText(title) || "未命名"}`;
}

function sortBySectionOrder<T extends { sectionId: string; updatedAt?: number }>(
  values: T[],
  sections: StoredBook["sections"],
): T[] {
  const sectionOrder = new Map(
    sections.map((section, index) => [section.id, index]),
  );
  return [...values].sort((a, b) => {
    const sectionDelta =
      (sectionOrder.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER) -
      (sectionOrder.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER);
    if (sectionDelta !== 0) return sectionDelta;
    return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
  });
}

function sectionTitleForId(
  sectionId: string,
  sections: StoredBook["sections"],
): string {
  return sections.find((section) => section.id === sectionId)?.title ?? sectionId;
}

function summaryLabel(summary: SectionSummary): string {
  if (summary.headingText) return `标题总结：${summary.headingText}`;
  if (summary.scopeType === "selected_blocks") return "所选段落总结";
  if (summary.scopeType === "paragraph") return "段落总结";
  return "章节总结";
}

export function buildMarkdownReadingNotes(params: {
  book: StoredBook;
  bookmarks?: ReadingBookmark[];
}): string {
  const { book, bookmarks = [] } = params;
  const lines: string[] = [
    markdownSectionHeading(1, book.fileName),
    "",
    `- 格式：${documentFormatForBook(book.fileName, book.format).toUpperCase()}`,
    `- 导出时间：${new Date().toISOString()}`,
    `- 小节数：${book.sections.length}`,
    "",
  ];

  const sortedBookmarks = [...bookmarks].sort((a, b) => a.createdAt - b.createdAt);
  if (sortedBookmarks.length > 0) {
    lines.push(markdownSectionHeading(2, "书签"), "");
    for (const bookmark of sortedBookmarks) {
      lines.push(`- ${markdownEscapeText(bookmark.title)} (${bookmark.sectionId})`);
    }
    lines.push("");
  }

  const summaries = sortBySectionOrder(
    Object.values(book.summaries).filter((summary) => summary.summary.trim()),
    book.sections,
  );
  if (summaries.length > 0) {
    lines.push(markdownSectionHeading(2, "AI 总结"), "");
    let previousSectionId: string | null = null;
    for (const summary of summaries) {
      if (summary.sectionId !== previousSectionId) {
        lines.push(
          markdownSectionHeading(3, sectionTitleForId(summary.sectionId, book.sections)),
          "",
        );
        previousSectionId = summary.sectionId;
      }
      lines.push(`#### ${markdownEscapeText(summaryLabel(summary))}`, "");
      lines.push(markdownEscapeText(summary.summary), "");
    }
  }

  const comments = sortBySectionOrder(
    Object.values(book.comments ?? {}).filter((comment) => comment.comment.trim()),
    book.sections,
  );
  if (comments.length > 0) {
    lines.push(markdownSectionHeading(2, "批注与翻译"), "");
    let previousSectionId: string | null = null;
    for (const comment of comments) {
      if (comment.sectionId !== previousSectionId) {
        lines.push(
          markdownSectionHeading(3, sectionTitleForId(comment.sectionId, book.sections)),
          "",
        );
        previousSectionId = comment.sectionId;
      }
      const label = comment.kind === "translation" ? "翻译" : "评论";
      lines.push(`#### ${label}`, "");
      if (comment.sourceText?.trim()) {
        lines.push("> " + markdownEscapeText(comment.sourceText).replace(/\n/g, "\n> "));
        lines.push("");
      }
      lines.push(markdownEscapeText(comment.comment), "");
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function summariesArrayToRecord(
  summaries: SectionSummary[],
): Record<string, SectionSummary> {
  const record: Record<string, SectionSummary> = {};
  summaries.forEach((summary, index) => {
    const key =
      summary.summaryKey ||
      (summary.scopeType && summary.scopeType !== "paragraph"
        ? `${summary.scopeType}:${summary.sectionId}:${summary.startBlockId ?? summary.headingBlockId ?? index}`
        : summary.sectionId) ||
      `summary-${index}`;
    record[key] = summary;
  });
  return record;
}

function normalizeSummaries(
  value: BackupBookPayload["summaries"] | unknown,
): Record<string, SectionSummary> {
  if (Array.isArray(value)) return summariesArrayToRecord(value);
  if (!value || typeof value !== "object") return {};
  const summaries: Record<string, SectionSummary> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, summary]) => {
    if (
      summary &&
      typeof summary === "object" &&
      typeof (summary as SectionSummary).sectionId === "string" &&
      typeof (summary as SectionSummary).summary === "string" &&
      typeof (summary as SectionSummary).updatedAt === "number"
    ) {
      summaries[key] = summary as SectionSummary;
    }
  });
  return summaries;
}

function commentsArrayToRecord(comments: EpubComment[]): Record<string, EpubComment> {
  const record: Record<string, EpubComment> = {};
  comments.forEach((comment, index) => {
    const key = comment.id || `comment-${index}`;
    record[key] = { ...comment, id: key };
  });
  return record;
}

function normalizeComments(
  value: BackupBookPayload["comments"] | unknown,
): Record<string, EpubComment> {
  if (Array.isArray(value)) return commentsArrayToRecord(value);
  if (!value || typeof value !== "object") return {};
  const comments: Record<string, EpubComment> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, comment]) => {
    if (
      comment &&
      typeof comment === "object" &&
      typeof (comment as EpubComment).sectionId === "string" &&
      Array.isArray((comment as EpubComment).blockIds) &&
      typeof (comment as EpubComment).comment === "string" &&
      typeof (comment as EpubComment).updatedAt === "number"
    ) {
      comments[key] = { ...(comment as EpubComment), id: (comment as EpubComment).id || key };
    }
  });
  return comments;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(dataBase64: string, type: string): Blob {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

async function blobToBackupDocument(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    type: blob.type || "application/octet-stream",
    size: blob.size,
    dataBase64: bytesToBase64(bytes),
  };
}

export async function buildBookBackupPayload(params: {
  book: StoredBook;
  blob: Blob;
}): Promise<BackupBookPayload> {
  const { book, blob } = params;
  return {
    id: book.id,
    fileName: book.fileName,
    format: documentFormatForBook(book.fileName, book.format),
    uploadedAt: book.uploadedAt,
    sections: book.sections,
    summaries: book.summaries,
    comments: book.comments ?? {},
    document: await blobToBackupDocument(blob),
    readerState: readReaderStateForBackup(book.id),
  };
}

export async function buildLibraryBackupPayload(
  books: { book: StoredBook; blob: Blob }[],
  scope: LibraryBackupPayload["scope"],
): Promise<LibraryBackupPayload> {
  return {
    version: 2,
    exportedAt: Date.now(),
    scope,
    books: await Promise.all(books.map(buildBookBackupPayload)),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function parseVersion2Backup(payload: Record<string, unknown>): ParsedBackupPayload {
  const rawBooks = Array.isArray(payload.books) ? payload.books : [];
  const books: ParsedBackupBook[] = [];
  rawBooks.filter(isObject).forEach((rawBook) => {
    const fileName =
      typeof rawBook.fileName === "string" && rawBook.fileName.trim()
        ? rawBook.fileName.trim()
        : null;
    if (!fileName) return;
    const rawDocument = isObject(rawBook.document) ? rawBook.document : null;
    const dataBase64 =
      rawDocument && typeof rawDocument.dataBase64 === "string"
        ? rawDocument.dataBase64
        : null;
    const type =
      rawDocument && typeof rawDocument.type === "string"
        ? rawDocument.type
        : "application/octet-stream";
    const format =
      rawBook.format === "epub" || rawBook.format === "pdf"
        ? rawBook.format
        : (documentFormatFromFileName(fileName) ?? undefined);

    books.push({
      id: typeof rawBook.id === "string" && rawBook.id.trim() ? rawBook.id : undefined,
      fileName,
      format,
      uploadedAt:
        typeof rawBook.uploadedAt === "number" && Number.isFinite(rawBook.uploadedAt)
          ? rawBook.uploadedAt
          : undefined,
      sections: Array.isArray(rawBook.sections) ? rawBook.sections : [],
      summaries: normalizeSummaries(rawBook.summaries),
      comments: normalizeComments(rawBook.comments),
      blob: dataBase64 ? base64ToBlob(dataBase64, type) : undefined,
      readerState: rawBook.readerState,
    });
  });

  return {
    version: 2,
    exportedAt:
      typeof payload.exportedAt === "number" && Number.isFinite(payload.exportedAt)
        ? payload.exportedAt
        : undefined,
    scope: payload.scope === "library" ? "library" : "book",
    books,
  };
}

function parseLegacyExportPayload(
  payload: Record<string, unknown>,
): ParsedBackupPayload {
  const rawBook = isObject(payload.book) ? payload.book : null;
  if (!rawBook || typeof rawBook.fileName !== "string") {
    return { version: 1, books: [] };
  }
  const fileName = rawBook.fileName.trim();
  if (!fileName) return { version: 1, books: [] };
  return {
    version: 1,
    exportedAt:
      typeof payload.exportedAt === "number" && Number.isFinite(payload.exportedAt)
        ? payload.exportedAt
        : undefined,
    scope: "book",
    books: [
      {
        fileName,
        format:
          rawBook.format === "epub" || rawBook.format === "pdf"
            ? rawBook.format
            : (documentFormatFromFileName(fileName) ?? undefined),
        uploadedAt:
          typeof rawBook.uploadedAt === "number" && Number.isFinite(rawBook.uploadedAt)
            ? rawBook.uploadedAt
            : undefined,
        sections: Array.isArray(rawBook.sections) ? rawBook.sections : [],
        summaries: normalizeSummaries(rawBook.summaries),
        comments: normalizeComments(rawBook.comments),
      },
    ],
  };
}

export function parseBackupPayload(payload: unknown): ParsedBackupPayload {
  if (!isObject(payload)) return { version: 2, books: [] };
  if (payload.version === 1) return parseLegacyExportPayload(payload);
  if (payload.version === 2) return parseVersion2Backup(payload);
  return { version: 2, books: [] };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(filename, blob);
}

export function downloadMarkdown(filename: string, markdown: string): void {
  downloadBlob(
    filename,
    new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
  );
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
