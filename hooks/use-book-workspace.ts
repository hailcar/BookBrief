"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveBookState } from "@/hooks/use-active-book-state";
import {
  useBookLibraryState,
  type DownloadProgress,
} from "@/hooks/use-book-library-state";
import { useBookSearchState } from "@/hooks/use-book-search-state";
import { useHeadingSummaryQueue } from "@/hooks/use-heading-summary-queue";
import { useReaderSectionState } from "@/hooks/use-reader-section-state";
import { useSelectedSummaryState } from "@/hooks/use-selected-summary-state";
import {
  deleteBook,
  findBookByFileName,
  getBook,
  getBookBlob,
  saveBook,
  updateBookSections,
  updateComments,
  updateSummaries,
} from "@/lib/db";
import {
  backupFileNameForBook,
  backupFileNameForLibrary,
  buildExportPayload,
  buildMarkdownReadingNotes,
  buildLibraryBackupPayload,
  buildSettingsBackupFilePayload,
  downloadMarkdown,
  downloadJson,
  markdownFileNameForBook,
  parseBackupPayload,
  parseSettingsBackupPayload,
  settingsBackupFileName,
  writeSettingsFromBackup,
  writeReaderStateFromBackup,
} from "@/lib/export";
import {
  documentFormatForBook,
  documentFormatFromFileName,
  documentFormatLabel,
  loadDocumentSectionContent,
  parseDocumentSections,
  pageNumberFromPdfPageAnchorId,
  pdfPageAnchorIdForSection,
  sectionForPdfPageAnchor,
  visitDocumentSectionTexts,
} from "@/lib/documents";
import {
  buildReaderWindowHtml,
} from "@/lib/reader-window";
import {
  collectContentUnderHeading,
  contentHashForHeadingSection,
  extractBlocksFromHtml,
  findSummarizableHeadings,
  headingSummaryCacheKey,
} from "@/lib/epub/blocks";
import { extractParagraphsFromHtml } from "@/lib/epub/paragraphs";
import {
  assertHttpDocumentUrl,
  fileNameFromDocumentUrl,
  supportedFileNameFromDocumentUrlPath,
} from "@/lib/epub-url";
import {
  getBrowserSessionItem,
  getBrowserStorageItem,
  setBrowserSessionItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";
import {
  computeReaderBlockSelection,
  expandSelectedBoundaryRange,
  isSummarizableBlock,
  resolveSummarizableBlockId,
} from "@/lib/selection";
import {
  summarizeHeadingSection,
  summarizeParagraph,
  summarizeSectionParagraphs,
  summarizeSelectedBlocks as summarizeSelectedBlocksRequest,
  translateSelectedText,
  type SummarizeRequestOptions,
} from "@/lib/summarize-client";
import type {
  BackupSettingsPayload,
  SelectedBlocksSummaryResult,
  EpubBlock,
  EpubComment,
  EpubSection,
  EpubSearchResult,
  HeadingSectionSummaryRequest,
  ParsedBackupBook,
  ReadingBookmark,
  SectionSummary,
  SummaryTask,
  SummaryTaskMode,
  StoredBook,
} from "@/lib/types";

function bookIdFromBlob(fileName: string, blob: Blob, sourceKey: string): string {
  return `${fileName}-${blob.size}-${sourceKey}`;
}

function selectedSummaryCacheKey(sectionId: string, anchorBlockId: string): string {
  return `selected::${sectionId}::${anchorBlockId}`;
}

function commentCacheKey(sectionId: string, anchorBlockId: string): string {
  return `comment::${sectionId}::${anchorBlockId}::${Date.now()}`;
}

function sameStringArray(a: string[] | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function sameSectionCatalog(a: EpubSection[], b: EpubSection[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((section, index) => {
    const other = b[index];
    return (
      section.id === other.id &&
      section.title === other.title &&
      section.href === other.href &&
      section.pageNumber === other.pageNumber &&
      section.endPageNumber === other.endPageNumber &&
      section.navLevel === other.navLevel
    );
  });
}

export type ImportBackupResult = {
  imported: number;
  skipped: number;
  fileNames: string[];
};

export type ImportSettingsBackupResult = {
  settings: BackupSettingsPayload;
  settingsImported: boolean;
};

type ReaderState = {
  lastSectionId: string | null;
  lastSectionOffset: number;
  bookmarks: ReadingBookmark[];
};

const readerStateKey = (bookId: string) => `summary_epub_reader_state:${bookId}`;
const ACTIVE_BOOK_KEY = "summary_epub_active_book_id";

function loadActiveBookId(): string | null {
  const id = getBrowserSessionItem(ACTIVE_BOOK_KEY)?.trim();
  return id || null;
}

function saveActiveBookId(id: string): boolean {
  return setBrowserSessionItem(ACTIVE_BOOK_KEY, id);
}

function clearActiveBookId(): boolean {
  return setBrowserSessionItem(ACTIVE_BOOK_KEY, "");
}

function hasUrlImportParam(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(new URLSearchParams(window.location.search).get("url"));
}

function loadReaderState(bookId: string): ReaderState {
  try {
    const raw = getBrowserStorageItem(readerStateKey(bookId));
    if (!raw) return { lastSectionId: null, lastSectionOffset: 0, bookmarks: [] };
    const parsed = JSON.parse(raw) as Partial<ReaderState>;
    return {
      lastSectionId:
        typeof parsed.lastSectionId === "string" ? parsed.lastSectionId : null,
      lastSectionOffset:
        typeof parsed.lastSectionOffset === "number" &&
        Number.isFinite(parsed.lastSectionOffset) &&
        parsed.lastSectionOffset > 0
          ? parsed.lastSectionOffset
          : 0,
      bookmarks: Array.isArray(parsed.bookmarks)
        ? parsed.bookmarks.filter(
            (b): b is ReadingBookmark =>
              typeof b?.sectionId === "string" &&
              typeof b.title === "string" &&
              typeof b.createdAt === "number",
          )
        : [],
    };
  } catch {
    return { lastSectionId: null, lastSectionOffset: 0, bookmarks: [] };
  }
}

function saveReaderState(bookId: string, state: ReaderState): boolean {
  return setBrowserStorageItem(readerStateKey(bookId), JSON.stringify(state));
}

function snippetAround(text: string, index: number, queryLength: number): string {
  const start = Math.max(0, index - 56);
  const end = Math.min(text.length, index + queryLength + 88);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ")}${suffix}`;
}

function appendSectionSearchResults(params: {
  results: EpubSearchResult[];
  section: EpubSection;
  text: string;
  needle: string;
  queryLength: number;
  maxResults: number;
}): boolean {
  const { results, section, text, needle, queryLength, maxResults } = params;
  const haystack = text.toLocaleLowerCase();
  let from = 0;
  while (results.length < maxResults) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    results.push({
      sectionId: section.id,
      sectionTitle: section.title,
      snippet: snippetAround(text, index, queryLength),
      matchIndex: index,
    });
    from = index + Math.max(1, queryLength);
  }
  return results.length < maxResults;
}

type ReaderPreviewBundle = {
  blocks: EpubBlock[];
  html: string;
};

async function loadReaderPreviewBundle(params: {
  arrayBuffer: ArrayBuffer;
  sections: EpubSection[];
  section: EpubSection;
  format: ReturnType<typeof documentFormatForBook>;
}): Promise<ReaderPreviewBundle> {
  const { arrayBuffer, section, format } = params;
  if (format === "pdf") {
    return {
      blocks: [],
      html: "",
    };
  }

  const { html: currentHtml } = await loadDocumentSectionContent(
    arrayBuffer,
    section,
    format,
  );
  const { blocks, annotatedHtml } = extractBlocksFromHtml(
    currentHtml,
    section.id,
  );
  return {
    blocks,
    html: buildReaderWindowHtml({
      currentHtml: annotatedHtml,
      currentSectionId: section.id,
      currentTitle: section.title,
    }),
  };
}

const HEADING_SUMMARY_OPTIONS = {
  summaryStyle: "must_remember_points" as const,
  removeRedundancy: true,
  makeImplicitMeaningExplicit: true,
  autoChunk: true,
  maxChunkChars: 6000,
};

const MAX_SUMMARY_RETRIES = 2;
const DOCUMENT_DOWNLOAD_TIMEOUT_MS = 120000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessageForDownload(err: unknown): string {
  if (err instanceof TypeError) {
    return "下载失败：目标站点可能未允许浏览器跨域访问（CORS）";
  }
  return err instanceof Error ? err.message : "URL 加载失败";
}

function downloadTimeoutMessage(timeoutMs: number): string {
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  return `下载超时（${seconds} 秒），请稍后重试或换用响应更快的 EPUB/PDF URL。`;
}

async function readResponseBlobWithProgress(
  res: Response,
  onProgress: (progress: DownloadProgress) => void,
): Promise<Blob> {
  const totalHeader = res.headers.get("content-length");
  const totalBytes = totalHeader ? Number(totalHeader) : null;
  const validTotal =
    totalBytes !== null && Number.isFinite(totalBytes) && totalBytes > 0
      ? totalBytes
      : null;

  if (!res.body) {
    const blob = await res.blob();
    onProgress({
      receivedBytes: blob.size,
      totalBytes: validTotal,
      phase: "downloading",
    });
    return blob;
  }

  const reader = res.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    receivedBytes += value.byteLength;
    onProgress({
      receivedBytes,
      totalBytes: validTotal,
      phase: "downloading",
    });
  }

  return new Blob(chunks, {
    type: res.headers.get("content-type") ?? "application/octet-stream",
  });
}

export function useBookWorkspace() {
  const {
    library,
    refreshLibrary,
    uploading,
    setUploading,
    downloadingUrl,
    setDownloadingUrl,
    downloadProgress,
    setDownloadProgress,
    downloadError,
    setDownloadError,
  } = useBookLibraryState();
  const { book, setBook, blob, setBlob, bookBuffer, setBookBuffer } =
    useActiveBookState();
  const {
    activeSectionId,
    setActiveSectionId,
    previewHtml,
    setPreviewHtml,
    sectionBlocks,
    setSectionBlocks,
    loadingPreview,
    setLoadingPreview,
    activeBlockId,
    setActiveBlockId,
    scrollToBlockRequest,
    setScrollToBlockRequest,
    scrollTopRequest,
    setScrollTopRequest,
    highlightBlockIds,
    setHighlightBlockIds,
  } = useReaderSectionState();
  const [summarizingSection, setSummarizingSection] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [streamingSummary, setStreamingSummary] = useState<string | null>(null);
  const [activeSummaryKey, setActiveSummaryKey] = useState<string | null>(
    null,
  );
  const [bookmarks, setBookmarks] = useState<ReadingBookmark[]>([]);
  const search = useBookSearchState();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchingBook,
    setSearchingBook,
    searchError,
    setSearchError,
    clearSearch,
  } = search;
  const {
    summaryTasks,
    setSummaryTasks,
    summaryQueuePaused,
    setSummaryQueuePaused,
    pauseSummaryQueue,
    resumeSummaryQueue,
    summaryQueueStats,
    summaryQueueLabel,
    autoSummaryOnReading,
    setAutoSummaryOnReading,
  } = useHeadingSummaryQueue();
  const openBookRequestSeqRef = useRef(0);
  const previewRequestSeqRef = useRef(0);
  const searchRequestSeqRef = useRef(0);
  const sectionTextCacheRef = useRef<Map<string, string>>(new Map());
  const restoreActiveBookAttemptedRef = useRef(false);
  const queueWorkerRunningRef = useRef(false);
  const queueWorkerAbortRef = useRef<AbortController | null>(null);
  const queueWorkerTaskRef = useRef<SummaryTask | null>(null);
  const activeSectionIdRef = useRef<string | null>(null);
  const selectedSummary = useSelectedSummaryState(sectionBlocks);
  const {
    selectedBlockIds,
    selectionAnchorBlockId,
    selectionAnchorLabel,
    setSelection,
    summarizingSelectedBlocks,
    setSummarizingSelectedBlocks,
    selectedSummaryProgressText,
    setSelectedSummaryProgressText,
    selectedSummaryResult,
    setSelectedSummaryResult,
    selectedSummaryError,
    setSelectedSummaryError,
    clearSelectedSummary: resetSelectedSummaryState,
  } = selectedSummary;

  useEffect(() => {
    activeSectionIdRef.current = activeSectionId;
  }, [activeSectionId]);

  const activeBookFormat = book
    ? documentFormatForBook(book.fileName, book.format)
    : null;
  const summaryEnabledForActiveBook = activeBookFormat !== "pdf";

  const abortSummaryWorker = useCallback((chapterId?: string) => {
    const runningTask = queueWorkerTaskRef.current;
    if (!runningTask) return;
    if (chapterId && runningTask.chapterId !== chapterId) return;
    queueWorkerAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      abortSummaryWorker();
    };
  }, [abortSummaryWorker]);

  const clearBookSearch = useCallback(() => {
    searchRequestSeqRef.current += 1;
    setSearchingBook(false);
    clearSearch();
  }, [clearSearch, setSearchingBook]);

  const clearSelectedSummaryResult = useCallback(() => {
    setSelectedSummaryResult(null);
    setSelectedSummaryError(null);
    setSelectedSummaryProgressText(null);
  }, [
    setSelectedSummaryError,
    setSelectedSummaryProgressText,
    setSelectedSummaryResult,
  ]);

  const selectedResultFromSummary = useCallback(
    (
      summary: SectionSummary,
      summaryKey: string,
    ): SelectedBlocksSummaryResult | null => {
      if (summary.scopeType !== "selected_blocks" || !summary.blockIds?.length) {
        return null;
      }
      return {
        sectionId: summary.sectionId,
        blockIds: summary.blockIds,
        sourceText: summary.sourceText ?? "",
        summary: summary.summary,
        model: summary.model,
        updatedAt: summary.updatedAt,
        summaryKey,
        pageId: summary.startBlockId ?? summary.blockIds[0],
        scopeType: "selected_blocks",
        startBlockId: summary.startBlockId ?? summary.blockIds[0],
        endBlockId: summary.endBlockId,
        startIndex: summary.startIndex,
        endIndex: summary.endIndex,
      };
    },
    [],
  );

  const loadSectionHtml = useCallback(
    async (
      section: EpubSection,
      options: {
        scrollTop?: number;
        scrollSectionId?: string;
        quiet?: boolean;
        preserveScroll?: boolean;
      } = {},
    ) => {
      if (!blob) return;
      const requestId = previewRequestSeqRef.current + 1;
      previewRequestSeqRef.current = requestId;
      const format = book
        ? documentFormatForBook(book.fileName, book.format)
        : (section.format ?? "epub");
      const scrollSectionId =
        options.scrollSectionId ??
        (format === "pdf" ? pdfPageAnchorIdForSection(section) : section.id);
      const applySectionState = () => {
        setActiveSectionId(section.id);
        setHighlightBlockIds([]);
        setActiveBlockId(null);
        resetSelectedSummaryState();
        setScrollToBlockRequest(null);
        if (options.preserveScroll) {
          setScrollTopRequest(null);
        } else {
          setScrollTopRequest(
            options.scrollTop !== undefined || scrollSectionId
              ? {
                  top: Math.max(0, options.scrollTop ?? 0),
                  sectionId: scrollSectionId,
                  nonce: Date.now(),
                }
              : null,
          );
        }
        setActiveSummaryKey(null);
      };
      if (!options.quiet) {
        setLoadingPreview(true);
        applySectionState();
      }
      try {
        const buf = bookBuffer ?? (await blob.arrayBuffer());
        if (previewRequestSeqRef.current !== requestId) return;
        if (!bookBuffer) setBookBuffer(buf);
        const preview = await loadReaderPreviewBundle({
          arrayBuffer: buf,
          sections: book?.sections ?? [section],
          section,
          format,
        });
        if (previewRequestSeqRef.current !== requestId) return;
        if (options.quiet) applySectionState();
        setSectionBlocks(preview.blocks);
        setPreviewHtml(preview.html);
        clearSelectedSummaryResult();
        if (book && !options.preserveScroll) {
          saveReaderState(book.id, {
            lastSectionId: section.id,
            lastSectionOffset: Math.max(0, options.scrollTop ?? 0),
            bookmarks,
          });
        }
      } finally {
        if (previewRequestSeqRef.current === requestId && !options.quiet) {
          setLoadingPreview(false);
        }
      }
    },
    [
      blob,
      book,
      bookBuffer,
      bookmarks,
      clearSelectedSummaryResult,
      resetSelectedSummaryState,
      setActiveBlockId,
      setActiveSectionId,
      setBookBuffer,
      setHighlightBlockIds,
      setLoadingPreview,
      setPreviewHtml,
      setScrollToBlockRequest,
      setScrollTopRequest,
      setSectionBlocks,
    ],
  );

  const openBook = useCallback(async (
    id: string,
    preloaded?: { blob: Blob; buffer: ArrayBuffer },
  ) => {
    abortSummaryWorker();
    const requestId = openBookRequestSeqRef.current + 1;
    openBookRequestSeqRef.current = requestId;
    previewRequestSeqRef.current += 1;
    searchRequestSeqRef.current += 1;
    sectionTextCacheRef.current.clear();

    const meta = await getBook(id);
    const b = preloaded?.blob ?? (await getBookBlob(id));
    if (openBookRequestSeqRef.current !== requestId) return;
    if (!meta || !b) return;
    let hydratedMeta: StoredBook = {
      ...meta,
      format: documentFormatForBook(meta.fileName, meta.format),
    };
    const buf = preloaded?.buffer ?? (await b.arrayBuffer());
    if (openBookRequestSeqRef.current !== requestId) return;
    if (hydratedMeta.format === "pdf") {
      const parsed = await parseDocumentSections(buf, "pdf").catch(() => null);
      if (
        parsed?.sections.length &&
        !sameSectionCatalog(hydratedMeta.sections, parsed.sections)
      ) {
        hydratedMeta = {
          ...hydratedMeta,
          sections: parsed.sections,
        };
        await updateBookSections(hydratedMeta.id, parsed.sections);
        if (openBookRequestSeqRef.current !== requestId) return;
      }
    }
    const readerState = loadReaderState(hydratedMeta.id);
    saveActiveBookId(hydratedMeta.id);
    setBook(hydratedMeta);
    setBlob(b);
    setBookBuffer(buf);
    setHighlightBlockIds([]);
    setActiveBlockId(null);
    resetSelectedSummaryState();
    setScrollToBlockRequest(null);
    setScrollTopRequest(null);
    setBookmarks(readerState.bookmarks);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSummaryTasks([]);
    setSummaryQueuePaused(false);
    setAutoSummaryOnReading(false);
    const first =
      hydratedMeta.sections.find((section) => section.id === readerState.lastSectionId) ??
      (readerState.lastSectionId
        ? sectionForPdfPageAnchor(hydratedMeta.sections, readerState.lastSectionId)
        : undefined) ??
      hydratedMeta.sections[0] ??
      null;
    if (!first) {
      setActiveSectionId(null);
      setPreviewHtml("");
      setSectionBlocks([]);
      setActiveBlockId(null);
      resetSelectedSummaryState();
      setScrollToBlockRequest(null);
      setScrollTopRequest(null);
      return;
    }
    setLoadingPreview(true);
    setActiveSectionId(first.id);
    try {
      const preview = await loadReaderPreviewBundle({
        arrayBuffer: buf,
        sections: hydratedMeta.sections,
        section: first,
        format: hydratedMeta.format ?? "epub",
      });
      if (openBookRequestSeqRef.current !== requestId) return;
      setSectionBlocks(preview.blocks);
      setPreviewHtml(preview.html);
      setActiveSummaryKey(null);
      setActiveBlockId(null);
      clearSelectedSummaryResult();
      const restoredPdfPageId =
        (hydratedMeta.format ?? "epub") === "pdf" &&
        readerState.lastSectionId &&
        pageNumberFromPdfPageAnchorId(readerState.lastSectionId)
          ? readerState.lastSectionId
          : null;
      setScrollToBlockRequest(null);
      setScrollTopRequest({
        top: readerState.lastSectionOffset,
        sectionId:
          (hydratedMeta.format ?? "epub") === "pdf"
            ? (restoredPdfPageId ?? pdfPageAnchorIdForSection(first) ?? first.id)
            : first.id,
        nonce: Date.now(),
      });
      saveReaderState(hydratedMeta.id, {
        lastSectionId: first.id,
        lastSectionOffset: readerState.lastSectionOffset,
        bookmarks: readerState.bookmarks,
      });
    } finally {
      if (openBookRequestSeqRef.current === requestId) {
        setLoadingPreview(false);
      }
    }
  }, [
    abortSummaryWorker,
    clearSelectedSummaryResult,
    resetSelectedSummaryState,
    setActiveBlockId,
    setActiveSectionId,
    setAutoSummaryOnReading,
    setBlob,
    setBook,
    setBookBuffer,
    setHighlightBlockIds,
    setLoadingPreview,
    setPreviewHtml,
    setScrollToBlockRequest,
    setScrollTopRequest,
    setSectionBlocks,
    setSearchError,
    setSearchQuery,
    setSearchResults,
    setSummaryQueuePaused,
    setSummaryTasks,
  ]);

  useEffect(() => {
    if (restoreActiveBookAttemptedRef.current || book || hasUrlImportParam()) {
      return;
    }
    const activeBookId = loadActiveBookId();
    if (!activeBookId) return;

    restoreActiveBookAttemptedRef.current = true;
    const run = async () => {
      const [storedBook, storedBlob] = await Promise.all([
        getBook(activeBookId),
        getBookBlob(activeBookId),
      ]);
      if (!storedBook || !storedBlob) {
        clearActiveBookId();
        return;
      }
      await openBook(activeBookId, {
        blob: storedBlob,
        buffer: await storedBlob.arrayBuffer(),
      });
    };

    void run().catch((err) => {
      console.error("Failed to restore active book", err);
      clearActiveBookId();
    });
  }, [book, openBook]);

  const importDocumentBlob = useCallback(
    async (
      documentBlob: Blob,
      fileName: string,
      sourceKey: string,
    ): Promise<{ reused: boolean; fileName: string }> => {
      const format = documentFormatFromFileName(fileName);
      if (!format) {
        throw new Error("请选择 .epub 或 .pdf 文件");
      }

      const id = bookIdFromBlob(fileName, documentBlob, sourceKey);
      const existing = await getBook(id);
      if (existing && (await getBookBlob(id))) {
        await openBook(id);
        return { reused: true, fileName: existing.fileName };
      }

      const buf = await documentBlob.arrayBuffer();
      const { sections } = await parseDocumentSections(buf, format);
      if (sections.length === 0) {
        throw new Error(`未能从 ${documentFormatLabel(format)} 中提取可阅读内容`);
      }
      await saveBook(id, fileName, documentBlob, sections, {}, format);
      await refreshLibrary();
      await openBook(id, { blob: documentBlob, buffer: buf });
      return { reused: false, fileName };
    },
    [openBook, refreshLibrary],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<{ reused: boolean; fileName: string }> => {
      setUploading(true);
      try {
        return await importDocumentBlob(file, file.name, String(file.lastModified));
      } finally {
        setUploading(false);
      }
    },
    [importDocumentBlob, setUploading],
  );

  const downloadDocumentFromUrl = useCallback(
    async (rawUrl: string): Promise<{ reused: boolean; fileName: string }> => {
      setDownloadError(null);
      try {
        const url = assertHttpDocumentUrl(rawUrl);
        // Only reuse before fetching when the URL path explicitly names a
        // supported document. Generic download endpoints need response headers
        // before we know whether the file is EPUB or PDF.
        const reusableFileName = supportedFileNameFromDocumentUrlPath(url);
        if (reusableFileName) {
          const existing = await findBookByFileName(reusableFileName);
          if (existing) {
            await openBook(existing.id);
            return { reused: true, fileName: existing.fileName };
          }
        }

        setDownloadingUrl(true);
        setDownloadProgress({
          receivedBytes: 0,
          totalBytes: null,
          phase: "downloading",
        });
        const controller = new AbortController();
        let timedOut = false;
        const timeoutId = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, DOCUMENT_DOWNLOAD_TIMEOUT_MS);
        let documentBlob: Blob;
        let contentDisposition: string | null = null;
        let contentType: string | null = null;
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) {
            throw new Error(`下载失败：HTTP ${res.status}`);
          }
          contentDisposition = res.headers.get("content-disposition");
          contentType = res.headers.get("content-type");

          documentBlob = await readResponseBlobWithProgress(
            res,
            setDownloadProgress,
          );
        } catch (err) {
          if (controller.signal.aborted && timedOut) {
            throw new Error(downloadTimeoutMessage(DOCUMENT_DOWNLOAD_TIMEOUT_MS));
          }
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }
        if (documentBlob.size === 0) {
          throw new Error("下载到的文档是空文件");
        }

        setDownloadProgress((current) => ({
          ...current,
          phase: "processing",
        }));
        const fileName = fileNameFromDocumentUrl(url, contentDisposition, contentType);
        return await importDocumentBlob(documentBlob, fileName, url);
      } catch (err) {
        const message = errorMessageForDownload(err);
        setDownloadError(message);
        throw new Error(message);
      } finally {
        setDownloadingUrl(false);
        setDownloadProgress((current) =>
          current.phase === "processing"
            ? current
            : {
                receivedBytes: current.receivedBytes,
                totalBytes: current.totalBytes,
                phase: "idle",
              },
        );
      }
    },
    [
      importDocumentBlob,
      openBook,
      setDownloadError,
      setDownloadProgress,
      setDownloadingUrl,
    ],
  );

  const downloadProgressLabel =
    downloadProgress.phase === "processing"
      ? "下载完成，正在解析文档…"
      : downloadProgress.totalBytes
        ? `已下载 ${formatBytes(downloadProgress.receivedBytes)} / ${formatBytes(downloadProgress.totalBytes)}`
        : downloadProgress.receivedBytes > 0
          ? `已下载 ${formatBytes(downloadProgress.receivedBytes)}`
          : "正在连接下载地址…";

  const downloadProgressPercent = downloadProgress.totalBytes
    ? Math.min(
        100,
        (downloadProgress.receivedBytes / downloadProgress.totalBytes) * 100,
      )
    : null;

  const loadPreview = useCallback(
    async (
      section: EpubSection,
      options?: {
        scrollTop?: number;
        scrollSectionId?: string;
        quiet?: boolean;
        preserveScroll?: boolean;
      },
    ) => {
      await loadSectionHtml(section, options);
    },
    [loadSectionHtml],
  );

  const saveReaderPosition = useCallback(
    (sectionId: string, offset: number) => {
      if (!book) return;
      const section = sectionForPdfPageAnchor(book.sections, sectionId);
      if (!section) return;
      const format = documentFormatForBook(book.fileName, book.format);
      const lastSectionId =
        format === "pdf" && pageNumberFromPdfPageAnchorId(sectionId)
          ? sectionId
          : section.id;
      saveReaderState(book.id, {
        lastSectionId,
        lastSectionOffset: Math.max(0, Math.round(offset)),
        bookmarks,
      });
    },
    [book, bookmarks],
  );

  const activeSection = book?.sections.find((s) => s.id === activeSectionId);
  const isActiveSectionBookmarked = bookmarks.some(
    (bookmark) => bookmark.sectionId === activeSectionId,
  );

  const toggleBookmark = useCallback(() => {
    if (!book || !activeSection) return;
    setBookmarks((current) => {
      const exists = current.some((b) => b.sectionId === activeSection.id);
      const next = exists
        ? current.filter((b) => b.sectionId !== activeSection.id)
        : [
            {
              sectionId: activeSection.id,
              title: activeSection.title,
              createdAt: Date.now(),
            },
            ...current,
          ];
      saveReaderState(book.id, {
        lastSectionId: activeSection.id,
        lastSectionOffset: loadReaderState(book.id).lastSectionOffset,
        bookmarks: next,
      });
      return next;
    });
  }, [activeSection, book]);

  const searchBook = useCallback(
    async (query: string) => {
      const requestId = searchRequestSeqRef.current + 1;
      searchRequestSeqRef.current = requestId;
      const trimmed = query.trim();
      setSearchQuery(query);
      setSearchError(null);
      if (!trimmed) {
        setSearchResults([]);
        setSearchingBook(false);
        return;
      }
      if (!book || !blob) return;

      setSearchingBook(true);
      try {
        const buf = bookBuffer ?? (await blob.arrayBuffer());
        if (searchRequestSeqRef.current !== requestId) return;
        if (!bookBuffer) setBookBuffer(buf);
        const needle = trimmed.toLocaleLowerCase();
        const results: EpubSearchResult[] = [];
        const searchSectionText = (section: EpubSection, text: string) =>
          appendSectionSearchResults({
            results,
            section,
            text,
            needle,
            queryLength: trimmed.length,
            maxResults: 80,
          });
        const sectionTextCache = sectionTextCacheRef.current;

        for (let i = 0; i < book.sections.length; i++) {
          if (searchRequestSeqRef.current !== requestId) return;
          const section = book.sections[i];
          const cachedText = sectionTextCache.get(section.id);
          if (cachedText !== undefined) {
            if (!searchSectionText(section, cachedText)) break;
            continue;
          }

          const format = documentFormatForBook(book.fileName, book.format);
          await visitDocumentSectionTexts(
            buf,
            book.sections.slice(i),
            format,
            (loadedSection, text) => {
              if (searchRequestSeqRef.current !== requestId) return false;
              sectionTextCache.set(loadedSection.id, text);
              return searchSectionText(loadedSection, text);
            },
          );
          break;
        }
        if (searchRequestSeqRef.current !== requestId) return;
        setSearchResults(results);
      } catch (err) {
        if (searchRequestSeqRef.current === requestId) {
          setSearchError(err instanceof Error ? err.message : "搜索失败");
        }
      } finally {
        if (searchRequestSeqRef.current === requestId) {
          setSearchingBook(false);
        }
      }
    },
    [
      blob,
      book,
      bookBuffer,
      setBookBuffer,
      setSearchError,
      setSearchQuery,
      setSearchResults,
      setSearchingBook,
    ],
  );

  const selectSummaryBlock = useCallback(
    (
      blockId: string,
      modifiers?: { ctrlKey?: boolean; metaKey?: boolean },
    ) => {
      if (!summaryEnabledForActiveBook) return;
      const resolvedBlockId = resolveSummarizableBlockId(sectionBlocks, blockId);
      if (!resolvedBlockId) return;

      setActiveBlockId(resolvedBlockId);
      setSelectedSummaryError(null);
      let selectedSummaryBlockIds: string[] | null = null;
      let selectedSummaryAnchorBlockId: string | null = null;
      if (book && activeSectionId) {
        const selectedCandidate = Object.entries(book.summaries).find(
          ([, summary]) =>
            summary.sectionId === activeSectionId &&
            summary.scopeType === "selected_blocks" &&
            Boolean(summary.blockIds?.includes(resolvedBlockId)),
        );
        if (selectedCandidate) {
          const [cacheKey, summary] = selectedCandidate;
          const blockIds = summary.blockIds ?? [resolvedBlockId];
          selectedSummaryBlockIds = blockIds;
          selectedSummaryAnchorBlockId =
            summary.startBlockId ?? blockIds[0] ?? resolvedBlockId;
          setActiveSummaryKey(cacheKey);
          setSelectedSummaryResult(selectedResultFromSummary(summary, cacheKey));
          setActiveBlockId(selectedSummaryAnchorBlockId);
          setHighlightBlockIds(blockIds);
        } else {
          setActiveSummaryKey(null);
          setSelectedSummaryResult(null);
          setHighlightBlockIds([resolvedBlockId]);
        }
      }
      setSelection((current) => {
        const nextSelection = computeReaderBlockSelection({
          blocks: sectionBlocks,
          clickedBlockId: blockId,
          currentSelectedBlockIds: current.selectedBlockIds,
          anchorBlockId: current.anchorBlockId,
          modifiers,
        });
        if (!nextSelection.clickedBlockId) return current;
        if (
          selectedSummaryBlockIds?.length &&
          selectedSummaryAnchorBlockId &&
          !modifiers?.ctrlKey &&
          !modifiers?.metaKey
        ) {
          return {
            selectedBlockIds: selectedSummaryBlockIds,
            anchorBlockId: selectedSummaryAnchorBlockId,
            activeBlockId: selectedSummaryAnchorBlockId,
          };
        }
        return {
          selectedBlockIds: nextSelection.selectedBlockIds,
          anchorBlockId: nextSelection.anchorBlockId,
          activeBlockId: nextSelection.activeBlockId,
        };
      });
    },
    [
      activeSectionId,
      book,
      sectionBlocks,
      selectedResultFromSummary,
      summaryEnabledForActiveBook,
      setActiveBlockId,
      setHighlightBlockIds,
      setSelectedSummaryError,
      setSelectedSummaryResult,
      setSelection,
    ],
  );

  const canExpandSelectedBlockRange =
    summaryEnabledForActiveBook &&
    !summarizingSelectedBlocks &&
    expandSelectedBoundaryRange(sectionBlocks, selectedBlockIds).ok;

  const expandSelectedBlockRange = useCallback(() => {
    if (summarizingSelectedBlocks) return;
    const expanded = expandSelectedBoundaryRange(sectionBlocks, selectedBlockIds);
    if (!expanded.ok) return;
    setSelection({
      selectedBlockIds: expanded.selectedBlockIds,
      anchorBlockId: expanded.activeBlockId,
      activeBlockId: expanded.activeBlockId,
    });
    setActiveBlockId(expanded.activeBlockId);
    setHighlightBlockIds(expanded.selectedBlockIds);
    setSelectedSummaryError(null);
  }, [
    sectionBlocks,
    selectedBlockIds,
    setActiveBlockId,
    setHighlightBlockIds,
    setSelectedSummaryError,
    setSelection,
    summarizingSelectedBlocks,
  ]);

  const clearSelectedSummary = useCallback(() => {
    resetSelectedSummaryState();
    setActiveBlockId(null);
    setHighlightBlockIds([]);
    setScrollToBlockRequest(null);
  }, [
    resetSelectedSummaryState,
    setActiveBlockId,
    setHighlightBlockIds,
    setScrollToBlockRequest,
  ]);

  const canDeleteActiveSummary =
    summaryEnabledForActiveBook &&
    !summarizingSelectedBlocks &&
    (Boolean(selectedSummaryResult) ||
      Boolean(activeSummaryKey && book?.summaries[activeSummaryKey]));

  const deleteActiveSummary = useCallback(async (): Promise<
    "selected" | "cached" | null
  > => {
    if (summarizingSelectedBlocks) return null;

    if (selectedSummaryResult) {
      const summaryKey =
        selectedSummaryResult.summaryKey ??
        (selectedSummaryResult.startBlockId ?? selectedSummaryResult.blockIds[0]
          ? selectedSummaryCacheKey(
              selectedSummaryResult.sectionId,
              selectedSummaryResult.startBlockId ??
                selectedSummaryResult.blockIds[0],
            )
          : null);
      if (book && summaryKey) {
        const current = (await getBook(book.id)) ?? book;
        const summaries = { ...current.summaries };
        if (summaries[summaryKey]) {
          delete summaries[summaryKey];
          await updateSummaries(current.id, summaries);
          setBook({ ...current, summaries });
        }
      }
      resetSelectedSummaryState();
      setActiveSummaryKey(null);
      setActiveBlockId(null);
      setHighlightBlockIds([]);
      return "selected";
    }

    if (!book || !activeSummaryKey || !book.summaries[activeSummaryKey]) {
      return null;
    }

    const current = (await getBook(book.id)) ?? book;
    if (!current.summaries[activeSummaryKey]) return null;
    const summaries = { ...current.summaries };
    delete summaries[activeSummaryKey];
    await updateSummaries(current.id, summaries);
    setBook({ ...current, summaries });
    setActiveSummaryKey(null);
    setActiveBlockId(null);
    setHighlightBlockIds([]);
    return "cached";
  }, [
    activeSummaryKey,
    book,
    selectedSummaryResult,
    resetSelectedSummaryState,
    setBook,
    setActiveBlockId,
    setHighlightBlockIds,
    summarizingSelectedBlocks,
  ]);

  const summarizeSelectedBlocks = useCallback(async () => {
    if (!summaryEnabledForActiveBook) return null;
    if (!activeSectionId || !book) return null;
    const selected = sectionBlocks.filter((block) =>
      selectedBlockIds.includes(block.id),
    );
    const summarizable = selected.filter(isSummarizableBlock);
    if (summarizable.length === 0) {
      setSelectedSummaryError("请先选择要总结的段落");
      return null;
    }

    setSelectedSummaryError(null);
    setSelectedSummaryProgressText(null);
    try {
      const sourceText = summarizable.map((block) => block.text).join("\n\n");
      const blockIds = summarizable.map((block) => block.id);
      const anchorBlockId = blockIds[0];
      const summaryKey = selectedSummaryCacheKey(activeSectionId, anchorBlockId);
      setActiveSummaryKey(summaryKey);
      setActiveBlockId(anchorBlockId);
      setHighlightBlockIds(blockIds);
      const currentBeforeRequest = (await getBook(book.id)) ?? book;
      const cached = currentBeforeRequest.summaries[summaryKey];
      if (
        cached?.scopeType === "selected_blocks" &&
        cached.summary.trim() &&
        sameStringArray(cached.blockIds, blockIds) &&
        (cached.sourceText ?? "") === sourceText
      ) {
        setBook(currentBeforeRequest);
        const cachedResult = selectedResultFromSummary(cached, summaryKey);
        setSelectedSummaryResult(cachedResult);
        return cachedResult;
      }
      setSummarizingSelectedBlocks(true);
      const { summary, model } = await summarizeSelectedBlocksRequest(
        summarizable.map((block) => ({ id: block.id, text: block.text })),
        (done, total, accumulatedText) => {
          setSelectedSummaryProgressText(
            total > 1 ? `正在总结 ${done}/${total}` : accumulatedText,
          );
        },
      );
      const result: SelectedBlocksSummaryResult = {
        sectionId: activeSectionId,
        blockIds,
        sourceText,
        summary,
        model,
        updatedAt: Date.now(),
        summaryKey,
        pageId: anchorBlockId,
        scopeType: "selected_blocks",
        startBlockId: anchorBlockId,
        endBlockId: blockIds.at(-1),
        startIndex: summarizable[0]?.index,
        endIndex: summarizable.at(-1)?.index,
      };
      const current = (await getBook(book.id)) ?? book;
      const storedSummary: SectionSummary = {
        ...result,
        mode: "selected_blocks",
        status: "success",
      };
      const summaries = { ...current.summaries, [summaryKey]: storedSummary };
      await updateSummaries(current.id, summaries);
      setBook({ ...current, summaries });
      setActiveSummaryKey(summaryKey);
      setSelectedSummaryResult(result);
      setActiveBlockId(anchorBlockId);
      setHighlightBlockIds(blockIds);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "总结失败";
      setSelectedSummaryError(message);
      throw err;
    } finally {
      setSummarizingSelectedBlocks(false);
      setSelectedSummaryProgressText(null);
    }
  }, [
    book,
    activeSectionId,
    sectionBlocks,
    selectedBlockIds,
    selectedResultFromSummary,
    setBook,
    summaryEnabledForActiveBook,
    setActiveBlockId,
    setHighlightBlockIds,
    setSelectedSummaryError,
    setSelectedSummaryProgressText,
    setSelectedSummaryResult,
    setSummarizingSelectedBlocks,
  ]);

  const addCommentForTextSelection = useCallback(
    async (params: {
      commentText: string;
      selectedText: string;
      blockIds: string[];
      fragments?: { blockId: string; text: string }[];
    }): Promise<EpubComment | null> => {
      if (!summaryEnabledForActiveBook) return null;
      if (!activeSectionId || !book) return null;
      const trimmed = params.commentText.trim();
      const selectedText = params.selectedText.trim();
      if (!trimmed) return null;
      if (!selectedText) return null;
      const requestedBlockIds = new Set(params.blockIds);
      const commentable = sectionBlocks.filter((block) =>
        requestedBlockIds.has(block.id),
      );
      if (commentable.length === 0) {
        setSelectedSummaryError("请先选择要评论的文字");
        return null;
      }

      const blockIds = commentable.map((block) => block.id);
      const sourceFragments = params.fragments
        ?.map((fragment) => ({
          blockId: fragment.blockId,
          text: fragment.text.trim(),
        }))
        .filter(
          (fragment) =>
            fragment.text && blockIds.includes(fragment.blockId),
        );
      const anchorBlockId = blockIds[0];
      const now = Date.now();
      const randomId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : String(now);
      const id = `${commentCacheKey(activeSectionId, anchorBlockId)}::comment::${randomId}`;
      const comment: EpubComment = {
        id,
        sectionId: activeSectionId,
        blockIds,
        comment: trimmed,
        sourceText: selectedText,
        sourceFragments,
        createdAt: now,
        updatedAt: now,
        startBlockId: anchorBlockId,
        endBlockId: blockIds.at(-1),
        startIndex: commentable[0]?.index,
        endIndex: commentable.at(-1)?.index,
      };
      const current = (await getBook(book.id)) ?? book;
      const comments = { ...(current.comments ?? {}), [id]: comment };
      await updateComments(current.id, comments);
      setBook({ ...current, comments });
      setActiveBlockId(anchorBlockId);
      setHighlightBlockIds(blockIds);
      setSelectedSummaryError(null);
      return comment;
    },
    [
      activeSectionId,
      book,
      sectionBlocks,
      setBook,
      setActiveBlockId,
      setHighlightBlockIds,
      setSelectedSummaryError,
      summaryEnabledForActiveBook,
    ],
  );

  const addTranslationForTextSelection = useCallback(
    async (params: {
      selectedText: string;
      blockIds: string[];
      fragments?: { blockId: string; text: string }[];
    }): Promise<EpubComment | null> => {
      if (!summaryEnabledForActiveBook) return null;
      if (!activeSectionId || !book) return null;
      const selectedText = params.selectedText.trim();
      if (!selectedText) return null;
      const requestedBlockIds = new Set(params.blockIds);
      const commentable = sectionBlocks.filter((block) =>
        requestedBlockIds.has(block.id),
      );
      if (commentable.length === 0) {
        setSelectedSummaryError("请先选择要翻译的文字");
        return null;
      }

      const { translation, model } = await translateSelectedText(selectedText);
      const blockIds = commentable.map((block) => block.id);
      const sourceFragments = params.fragments
        ?.map((fragment) => ({
          blockId: fragment.blockId,
          text: fragment.text.trim(),
        }))
        .filter(
          (fragment) =>
            fragment.text && blockIds.includes(fragment.blockId),
        );
      const anchorBlockId = blockIds[0];
      const now = Date.now();
      const randomId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : String(now);
      const id = `${commentCacheKey(activeSectionId, anchorBlockId)}::translation::${randomId}`;
      const comment: EpubComment = {
        id,
        sectionId: activeSectionId,
        blockIds,
        comment: translation,
        kind: "translation",
        sourceText: selectedText,
        sourceFragments,
        model,
        createdAt: now,
        updatedAt: now,
        startBlockId: anchorBlockId,
        endBlockId: blockIds.at(-1),
        startIndex: commentable[0]?.index,
        endIndex: commentable.at(-1)?.index,
      };
      const current = (await getBook(book.id)) ?? book;
      const comments = { ...(current.comments ?? {}), [id]: comment };
      await updateComments(current.id, comments);
      setBook({ ...current, comments });
      setActiveBlockId(anchorBlockId);
      setHighlightBlockIds(blockIds);
      setSelectedSummaryError(null);
      return comment;
    },
    [
      activeSectionId,
      book,
      sectionBlocks,
      setBook,
      setActiveBlockId,
      setHighlightBlockIds,
      setSelectedSummaryError,
      summaryEnabledForActiveBook,
    ],
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string): Promise<boolean> => {
      if (!summaryEnabledForActiveBook) return false;
      if (!book) return false;
      const current = (await getBook(book.id)) ?? book;
      if (!current.comments?.[annotationId]) return false;
      const comments = { ...(current.comments ?? {}) };
      delete comments[annotationId];
      await updateComments(current.id, comments);
      setBook({ ...current, comments });
      return true;
    },
    [book, setBook, summaryEnabledForActiveBook],
  );

  const activateAnnotation = useCallback(
    async (annotationId: string): Promise<boolean> => {
      if (!summaryEnabledForActiveBook) return false;
      if (!book) return false;
      const annotation = book.comments?.[annotationId];
      if (!annotation) return false;
      const section = book.sections.find(
        (item) => item.id === annotation.sectionId,
      );
      if (!section) return false;

      if (section.id !== activeSectionIdRef.current) {
        await loadSectionHtml(section);
      }

      const targetBlockId =
        annotation.startBlockId ?? annotation.blockIds[0] ?? null;
      setHighlightBlockIds(annotation.blockIds);
      setActiveBlockId(targetBlockId);
      if (targetBlockId) {
        setScrollToBlockRequest((current) => ({
          blockId: targetBlockId,
          nonce: (current?.nonce ?? 0) + 1,
        }));
      }
      return true;
    },
    [
      book,
      loadSectionHtml,
      setActiveBlockId,
      setHighlightBlockIds,
      setScrollToBlockRequest,
      summaryEnabledForActiveBook,
    ],
  );

  const blockIdsForSummary = useCallback(
    (summary: SectionSummary, cacheKey: string): string[] => {
      if (summary.blockIds?.length) return summary.blockIds;
      if (summary.mode === "heading_section_summary" && summary.headingBlockId) {
        try {
          const collected = collectContentUnderHeading({
            blocks: sectionBlocks,
            headingBlockId: summary.headingBlockId,
          });
          return [
            summary.headingBlockId,
            ...collected.contentBlocks.map((block) => block.id),
          ];
        } catch {
          return [summary.headingBlockId];
        }
      }
      if (cacheKey === activeSectionId || summary.sectionId === activeSectionId) {
        return sectionBlocks.map((block) => block.id);
      }
      return [];
    },
    [activeSectionId, sectionBlocks],
  );

  const activateSummaryKey = useCallback(
    (cacheKey: string) => {
      if (!summaryEnabledForActiveBook) return;
      if (!book) return;
      if (activeSummaryKey === cacheKey) {
        clearSelectedSummary();
        return;
      }
      const summary = book.summaries[cacheKey];
      if (!summary || summary.sectionId !== activeSectionId) return;
      const blockIds = blockIdsForSummary(summary, cacheKey);
      const targetBlockId =
        summary.startBlockId ??
        summary.headingBlockId ??
        blockIds[0] ??
        null;
      setActiveSummaryKey(cacheKey);
      setActiveBlockId(targetBlockId);
      setHighlightBlockIds(blockIds);
      setSelectedSummaryResult(selectedResultFromSummary(summary, cacheKey));
      if (targetBlockId) {
        setScrollToBlockRequest((current) => ({
          blockId: targetBlockId,
          nonce: (current?.nonce ?? 0) + 1,
        }));
      }
    },
    [
      activeSectionId,
      activeSummaryKey,
      blockIdsForSummary,
      book,
      clearSelectedSummary,
      selectedResultFromSummary,
      summaryEnabledForActiveBook,
      setActiveBlockId,
      setHighlightBlockIds,
      setSelectedSummaryResult,
      setScrollToBlockRequest,
    ],
  );

  const selectReaderBlock = useCallback(
    (blockId: string) => {
      if (!summaryEnabledForActiveBook) return;
      if (!book || !activeSectionId) return;
      const block = sectionBlocks.find((item) => item.id === blockId);
      if (!block) return;
      setActiveBlockId(blockId);

      const candidates = Object.entries(book.summaries)
        .filter(([, summary]) => summary.sectionId === activeSectionId)
        .map(([cacheKey, summary]) => ({
          cacheKey,
          summary,
          blockIds: blockIdsForSummary(summary, cacheKey),
        }))
        .filter((item) => item.blockIds.includes(blockId));

      if (candidates.length === 0) {
        setActiveSummaryKey(null);
        setSelectedSummaryResult(null);
        setHighlightBlockIds([blockId]);
        return;
      }

      candidates.sort((a, b) => {
        if (
          block.type === "heading" &&
          a.summary.headingBlockId === blockId &&
          b.summary.headingBlockId !== blockId
        ) {
          return -1;
        }
        if (
          block.type === "heading" &&
          b.summary.headingBlockId === blockId &&
          a.summary.headingBlockId !== blockId
        ) {
          return 1;
        }
        const priority = (summary: SectionSummary) => {
          if (summary.scopeType === "selected_blocks") return 0;
          if (summary.scopeType === "paragraph") return 0;
          if (
            summary.scopeType === "heading_section" ||
            summary.mode === "heading_section_summary"
          ) {
            return 1;
          }
          return 2;
        };
        const pa = priority(a.summary);
        const pb = priority(b.summary);
        if (pa !== pb) return pa - pb;
        if (pa === 1) return a.blockIds.length - b.blockIds.length;
        return 0;
      });

      const best = candidates[0];
      setActiveSummaryKey(best.cacheKey);
      setHighlightBlockIds(best.blockIds);
      setActiveBlockId(
        best.summary.startBlockId ?? best.summary.headingBlockId ?? blockId,
      );
      setSelectedSummaryResult(
        selectedResultFromSummary(best.summary, best.cacheKey),
      );
    },
    [
      activeSectionId,
      blockIdsForSummary,
      book,
      sectionBlocks,
      selectedResultFromSummary,
      summaryEnabledForActiveBook,
      setActiveBlockId,
      setHighlightBlockIds,
      setSelectedSummaryResult,
    ],
  );

  const persistSummary = useCallback(
    async (cacheKey: string, summary: SectionSummary) => {
      if (!summaryEnabledForActiveBook) return;
      if (!book) return;
      const current = (await getBook(book.id)) ?? book;
      const summaries = { ...current.summaries, [cacheKey]: summary };
      await updateSummaries(current.id, summaries);
      setBook({ ...current, summaries });
      if (summary.sectionId === activeSectionIdRef.current) {
        setActiveSummaryKey(cacheKey);
        const blockIds = summary.blockIds ?? [];
        setHighlightBlockIds(blockIds);
        setActiveBlockId(
          summary.startBlockId ??
            summary.headingBlockId ??
            blockIds[0] ??
            null,
        );
      }
    },
    [book, setActiveBlockId, setBook, setHighlightBlockIds, summaryEnabledForActiveBook],
  );

  const summarizeActiveSection = useCallback(async (): Promise<SectionSummary | null> => {
    if (!summaryEnabledForActiveBook) return null;
    if (!blob || !book || !activeSectionId) return null;
    const section = book.sections.find((s) => s.id === activeSectionId);
    if (!section) return null;

    const buf = bookBuffer ?? (await blob.arrayBuffer());
    if (!bookBuffer) setBookBuffer(buf);
    const format = documentFormatForBook(book.fileName, book.format);
    const { html } = await loadDocumentSectionContent(buf, section, format);
    const paragraphs = extractParagraphsFromHtml(html, section.id);
    const summaryBlocks =
      format === "pdf" && sectionBlocks.length > 0
        ? sectionBlocks
        : sectionBlocks.length > 0 && sectionBlocks[0]?.chapterId === section.id
        ? sectionBlocks
        : extractBlocksFromHtml(html, section.id).blocks;
    if (paragraphs.length === 0) return null;

    const cacheKey = section.id;
    setSummarizingSection(true);
    setActiveSummaryKey(cacheKey);
    setProgress({ done: 0, total: paragraphs.length });
    setProgressMessage(null);
    setStreamingSummary(null);
    setHighlightBlockIds([]);
    try {
      const { summary: summaryText, model } = await summarizeSectionParagraphs(
        paragraphs,
        section.title,
        (done, total, accumulatedText) => {
          setProgress({ done, total });
          setStreamingSummary(accumulatedText);
        },
      );

      const summary: SectionSummary = {
        sectionId: section.id,
        summary: summaryText,
        model,
        updatedAt: Date.now(),
        mode: "paragraph",
        scopeType: "chapter",
        blockIds: summaryBlocks.map((block) => block.id),
        startBlockId: summaryBlocks[0]?.id,
        endBlockId: summaryBlocks.at(-1)?.id,
        startIndex: summaryBlocks[0]?.index,
        endIndex: summaryBlocks.at(-1)?.index,
      };
      await persistSummary(cacheKey, summary);
      return summary;
    } finally {
      setSummarizingSection(false);
      setProgress({ done: 0, total: 0 });
      setProgressMessage(null);
      setStreamingSummary(null);
    }
  }, [
    blob,
    book,
    bookBuffer,
    activeSectionId,
    persistSummary,
    sectionBlocks,
    setBookBuffer,
    summaryEnabledForActiveBook,
    setHighlightBlockIds,
  ]);

  const summarizeBlock = useCallback(
    async (blockId: string): Promise<SectionSummary | null> => {
      if (!summaryEnabledForActiveBook) return null;
      if (!book || !activeSectionId) return null;
      const section = book.sections.find((s) => s.id === activeSectionId);
      const block = sectionBlocks.find((item) => item.id === blockId);
      if (!section || !block) return null;

      const cacheKey = `${section.id}::b::${blockId}`;
      setSummarizingSection(true);
      setActiveSummaryKey(cacheKey);
      setActiveBlockId(blockId);
      setHighlightBlockIds([blockId]);
      setProgress({ done: 0, total: 1 });
      setProgressMessage("正在总结当前段落");
      setStreamingSummary(null);

      try {
        const { summary: summaryText, model } = await summarizeParagraph(
          block.text,
          section.title,
          block.index + 1,
          sectionBlocks.length,
        );
        const summary: SectionSummary = {
          sectionId: section.id,
          summary: summaryText,
          model,
          updatedAt: Date.now(),
          mode: "paragraph",
          scopeType: "paragraph",
          blockIds: [blockId],
          startBlockId: blockId,
          endBlockId: blockId,
          startIndex: block.index,
          endIndex: block.index,
          status: "success",
        };
        await persistSummary(cacheKey, summary);
        return summary;
      } finally {
        setSummarizingSection(false);
        setProgress({ done: 0, total: 0 });
        setProgressMessage(null);
        setStreamingSummary(null);
      }
    },
    [
      activeSectionId,
      book,
      persistSummary,
      sectionBlocks,
      summaryEnabledForActiveBook,
      setActiveBlockId,
      setHighlightBlockIds,
    ],
  );

  const buildHeadingSummaryPlan = useCallback(
    (headingBlockId: string) => {
      if (!summaryEnabledForActiveBook) return null;
      if (!book || !activeSectionId) return null;
      const section = book.sections.find((s) => s.id === activeSectionId);
      if (!section) return null;

      const collected = collectContentUnderHeading({
        blocks: sectionBlocks,
        headingBlockId,
      });

      const cacheKey = headingSummaryCacheKey(section.id, headingBlockId);
      const contentHash = contentHashForHeadingSection({
        heading: collected.heading,
        contentBlocks: collected.contentBlocks,
        markdownText: collected.markdownText,
        options: HEADING_SUMMARY_OPTIONS,
      });
      const highlightIds = [
        headingBlockId,
        ...collected.contentBlocks.map((b) => b.id),
      ];

      const request: HeadingSectionSummaryRequest = {
        mode: "heading_section_summary",
        bookId: book.id,
        chapterId: section.id,
        heading: {
          id: collected.heading.id,
          text: collected.heading.text,
          level: collected.heading.level,
        },
        content: {
          plainText: collected.plainText,
          markdownText: collected.markdownText,
          blockIds: collected.contentBlocks.map((b) => b.id),
          startIndex: collected.startIndex,
          endIndex: collected.endIndex,
          contentHash,
        },
        options: HEADING_SUMMARY_OPTIONS,
      };

      return { section, collected, cacheKey, contentHash, highlightIds, request };
    },
    [activeSectionId, book, sectionBlocks, summaryEnabledForActiveBook],
  );

  const summarizeHeading = useCallback(
    async (
      headingBlockId: string,
      sourceMode: SummaryTaskMode = "manual",
      options: SummarizeRequestOptions = {},
    ): Promise<SectionSummary | null> => {
      void sourceMode;
      const plan = buildHeadingSummaryPlan(headingBlockId);
      if (!plan) return null;

      const {
        section,
        collected,
        cacheKey,
        contentHash,
        highlightIds,
        request,
      } = plan;
      const cached = book?.summaries[cacheKey];
      setHighlightBlockIds(highlightIds);
      setActiveBlockId(headingBlockId);
      if (cached?.contentHash === contentHash && cached.summary.trim()) {
        setActiveSummaryKey(cacheKey);
        return { ...cached, status: "cached" };
      }

      setSummarizingSection(true);
      setActiveSummaryKey(cacheKey);
      setProgress({ done: 0, total: 1 });
      setProgressMessage(null);
      setStreamingSummary(null);

      try {
        const { summary: summaryText, model, chunked } =
          await summarizeHeadingSection(
            request,
            section.title,
            (p, acc) => {
              setProgress({ done: p.done, total: p.total });
              setProgressMessage(
                p.message ??
                  (p.phase === "chunk" && p.total > 2
                    ? "内容较长，已自动分块总结"
                    : null),
              );
              if (acc) setStreamingSummary(acc);
            },
            options,
          );

        const prefix = chunked ? "（已分块合并）\n\n" : "";
        const summary: SectionSummary = {
          sectionId: section.id,
          summary: prefix + summaryText,
          model,
          updatedAt: Date.now(),
          mode: "heading_section_summary",
          scopeType: "heading_section",
          headingBlockId,
          headingText: collected.heading.text,
          headingLevel: collected.heading.level,
          blockIds: [
            headingBlockId,
            ...collected.contentBlocks.map((block) => block.id),
          ],
          startBlockId: headingBlockId,
          endBlockId:
            collected.contentBlocks.at(-1)?.id ?? headingBlockId,
          startIndex: collected.heading.index,
          endIndex: collected.endIndex,
          contentHash,
          status: "success",
        };
        await persistSummary(cacheKey, summary);
        return summary;
      } finally {
        setSummarizingSection(false);
        setProgress({ done: 0, total: 0 });
        setProgressMessage(null);
        setStreamingSummary(null);
      }
    },
    [
      book?.summaries,
      buildHeadingSummaryPlan,
      persistSummary,
      setActiveBlockId,
      setHighlightBlockIds,
    ],
  );

  const enqueueHeadingSummary = useCallback(
    (headingBlockId: string, mode: SummaryTaskMode, priority = false) => {
      if (!book || !activeSectionId) return;
      const plan = buildHeadingSummaryPlan(headingBlockId);
      if (!plan) return;

      const cached = book.summaries[plan.cacheKey];
      const now = new Date().toISOString();
      const taskBase: SummaryTask = {
        id: `${book.id}:${activeSectionId}:${headingBlockId}:${plan.contentHash}`,
        bookId: book.id,
        chapterId: activeSectionId,
        headingId: headingBlockId,
        headingText: plan.collected.heading.text,
        headingLevel: plan.collected.heading.level,
        blockIds: plan.collected.contentBlocks.map((block) => block.id),
        contentHash: plan.contentHash,
        mode,
        status: "queued",
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (cached?.contentHash === plan.contentHash && cached.summary.trim()) {
        setSummaryTasks((current) => {
          if (
            current.some(
              (task) =>
                task.headingId === headingBlockId &&
                task.contentHash === plan.contentHash,
            )
          ) {
            return current;
          }
          return [
            {
              ...taskBase,
              status: "skipped",
            },
            ...current,
          ];
        });
        return;
      }

      setSummaryTasks((current) => {
        const duplicate = current.some(
          (task) =>
            task.headingId === headingBlockId &&
            task.contentHash === plan.contentHash &&
            (task.status === "queued" || task.status === "running"),
        );
        if (duplicate) return current;
        return priority ? [taskBase, ...current] : [...current, taskBase];
      });
    },
    [activeSectionId, book, buildHeadingSummaryPlan, setSummaryTasks],
  );

  const autoSummarizeCurrentChapter = useCallback(() => {
    if (!activeSectionId || sectionBlocks.length === 0) return 0;
    const headings = findSummarizableHeadings(sectionBlocks);
    for (const heading of headings) {
      enqueueHeadingSummary(heading.blockId, "auto_current_chapter");
    }
    return headings.length;
  }, [activeSectionId, enqueueHeadingSummary, sectionBlocks]);

  const cancelSummaryTasksForCurrentChapter = useCallback(() => {
    if (!activeSectionId) return;
    abortSummaryWorker(activeSectionId);
    const now = new Date().toISOString();
    setSummaryTasks((current) =>
      current.map((task) =>
        task.chapterId === activeSectionId &&
        (task.status === "queued" || task.status === "running")
          ? { ...task, status: "cancelled", updatedAt: now }
          : task,
      ),
    );
  }, [abortSummaryWorker, activeSectionId, setSummaryTasks]);

  const clearFinishedSummaryTasks = useCallback(() => {
    setSummaryTasks((current) =>
      current.filter(
        (task) => task.status === "queued" || task.status === "running",
      ),
    );
  }, [setSummaryTasks]);

  const retrySummaryTask = useCallback((taskId: string) => {
    const now = new Date().toISOString();
    setSummaryTasks((current) =>
      current.map((task) =>
        task.id === taskId && task.status === "failed"
          ? {
              ...task,
              status: "queued",
              retryCount: 0,
              error: undefined,
              updatedAt: now,
            }
          : task,
      ),
    );
  }, [setSummaryTasks]);

  useEffect(() => {
    if (summaryQueuePaused || queueWorkerRunningRef.current) return;
    const nextTask = summaryTasks.find((task) => task.status === "queued");
    if (!nextTask) return;

    const controller = new AbortController();
    const run = async () => {
      queueWorkerRunningRef.current = true;
      queueWorkerAbortRef.current = controller;
      queueWorkerTaskRef.current = nextTask;
      const now = new Date().toISOString();
      setSummaryTasks((current) =>
        current.map((task) =>
          task.id === nextTask.id
            ? { ...task, status: "running", updatedAt: now }
            : task,
        ),
      );

      try {
        const sectionStillActive = nextTask.chapterId === activeSectionId;
        if (!sectionStillActive) {
          throw new Error("位置已切换，任务已取消");
        }
        await summarizeHeading(nextTask.headingId, nextTask.mode, {
          signal: controller.signal,
        });
        setSummaryTasks((current) =>
          current.map((task) =>
            task.id === nextTask.id
              ? {
                  ...task,
                  status: "success",
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "总结失败";
        const taskCancelled =
          message.includes("位置已切换") ||
          message.includes("已取消") ||
          controller.signal.aborted;
        setSummaryTasks((current) =>
          current.map((task) => {
            if (task.id !== nextTask.id) return task;
            if (taskCancelled || task.retryCount >= MAX_SUMMARY_RETRIES) {
              return {
                ...task,
                status: taskCancelled ? "cancelled" : "failed",
                error: message,
                updatedAt: new Date().toISOString(),
              };
            }
            return {
              ...task,
              status: "queued",
              retryCount: task.retryCount + 1,
              error: message,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      } finally {
        queueWorkerRunningRef.current = false;
        if (queueWorkerTaskRef.current?.id === nextTask.id) {
          queueWorkerTaskRef.current = null;
          queueWorkerAbortRef.current = null;
        }
      }
    };

    void run();
  }, [
    activeSectionId,
    setSummaryTasks,
    summarizeHeading,
    summaryQueuePaused,
    summaryTasks,
  ]);

  const previousSectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousSectionIdRef.current;
    previousSectionIdRef.current = activeSectionId;
    if (!previous || previous === activeSectionId) return;
    abortSummaryWorker(previous);
    const now = new Date().toISOString();
    setSummaryTasks((current) =>
      current.map((task) =>
        task.chapterId === previous &&
        (task.status === "queued" || task.status === "running")
          ? { ...task, status: "cancelled", updatedAt: now }
          : task,
      ),
    );
  }, [abortSummaryWorker, activeSectionId, setSummaryTasks]);

  const exportData = useCallback(() => {
    if (!book) return;
    const base = book.fileName.replace(/\.(?:epub|pdf)$/i, "") || "export";
    downloadJson(`${base}-summaries.json`, buildExportPayload(book));
  }, [book]);

  const exportMarkdownNotes = useCallback(() => {
    if (!book) return;
    downloadMarkdown(
      markdownFileNameForBook(book),
      buildMarkdownReadingNotes({ book, bookmarks }),
    );
  }, [book, bookmarks]);

  const loadBookBackupSource = useCallback(
    async (id: string): Promise<{ book: StoredBook; blob: Blob }> => {
      const sourceBook = book?.id === id ? book : await getBook(id);
      const sourceBlob = await getBookBlob(id);
      if (!sourceBook || !sourceBlob) {
        throw new Error("未找到可导出的书籍文件");
      }
      return { book: sourceBook, blob: sourceBlob };
    },
    [book],
  );

  const exportBookBackup = useCallback(
    async (id: string) => {
      const source = await loadBookBackupSource(id);
      const payload = await buildLibraryBackupPayload([source], "book");
      downloadJson(backupFileNameForBook(source.book), payload);
    },
    [loadBookBackupSource],
  );

  const exportCurrentBookBackup = useCallback(async () => {
    if (!book) throw new Error("请先打开一本书");
    await exportBookBackup(book.id);
  }, [book, exportBookBackup]);

  const exportLibraryBackup = useCallback(async () => {
    if (library.length === 0) throw new Error("书库为空");
    const sources = await Promise.all(
      library.map((item) => loadBookBackupSource(item.id)),
    );
    const payload = await buildLibraryBackupPayload(sources, "library");
    downloadJson(backupFileNameForLibrary(), payload);
  }, [library, loadBookBackupSource]);

  const exportSettingsBackup = useCallback(() => {
    downloadJson(settingsBackupFileName(), buildSettingsBackupFilePayload());
  }, []);

  const findExistingBookForBackup = useCallback(
    async (backupBook: ParsedBackupBook): Promise<StoredBook | null> => {
      if (backupBook.id) {
        const existingById = await getBook(backupBook.id);
        if (existingById) return existingById;
      }
      const existingByName = await findBookByFileName(backupBook.fileName);
      return existingByName ? await getBook(existingByName.id) : null;
    },
    [],
  );

  const importBackupFile = useCallback(
    async (file: File): Promise<ImportBackupResult> => {
      const parsed = parseBackupPayload(JSON.parse(await file.text()));
      if (parsed.books.length === 0) {
        throw new Error("备份文件中没有可加载的书籍");
      }

      const importedIds: string[] = [];
      const importedFileNames: string[] = [];
      let skipped = 0;

      for (const backupBook of parsed.books) {
        if (backupBook.blob) {
          const id =
            backupBook.id ??
            bookIdFromBlob(
              backupBook.fileName,
              backupBook.blob,
              `backup:${parsed.exportedAt ?? file.name}`,
            );
          const format = documentFormatForBook(
            backupBook.fileName,
            backupBook.format,
          );
          await saveBook(
            id,
            backupBook.fileName,
            backupBook.blob,
            backupBook.sections,
            backupBook.summaries,
            format,
            backupBook.uploadedAt ?? Date.now(),
            backupBook.comments,
          );
          writeReaderStateFromBackup(id, backupBook.readerState);
          importedIds.push(id);
          importedFileNames.push(backupBook.fileName);
          continue;
        }

        const existing = await findExistingBookForBackup(backupBook);
        if (!existing) {
          skipped += 1;
          continue;
        }
        if (backupBook.sections.length > 0) {
          await updateBookSections(existing.id, backupBook.sections);
        }
        await updateSummaries(existing.id, {
          ...existing.summaries,
          ...backupBook.summaries,
        });
        await updateComments(existing.id, {
          ...(existing.comments ?? {}),
          ...backupBook.comments,
        });
        writeReaderStateFromBackup(existing.id, backupBook.readerState);
        importedIds.push(existing.id);
        importedFileNames.push(existing.fileName);
      }

      if (importedIds.length === 0) {
        throw new Error("没有导入任何书籍；summary-only 备份需要先存在同名书籍");
      }

      await refreshLibrary();
      if (book && importedIds.includes(book.id)) {
        await openBook(book.id);
      } else if (!book && importedIds[0]) {
        await openBook(importedIds[0]);
      }

      return {
        imported: importedIds.length,
        skipped,
        fileNames: importedFileNames,
      };
    },
    [book, findExistingBookForBackup, openBook, refreshLibrary],
  );

  const importSettingsBackupFile = useCallback(
    async (file: File): Promise<ImportSettingsBackupResult> => {
      const settings = parseSettingsBackupPayload(JSON.parse(await file.text()));
      if (!settings) {
        throw new Error("备份文件中没有可导入的配置");
      }
      return {
        settings,
        settingsImported: writeSettingsFromBackup(settings),
      };
    },
    [],
  );

  const removeBook = useCallback(
    async (id: string) => {
      if (book?.id === id) {
        abortSummaryWorker();
      }
      await deleteBook(id);
      if (loadActiveBookId() === id) {
        clearActiveBookId();
      }
      await refreshLibrary();
      if (book?.id === id) {
        openBookRequestSeqRef.current += 1;
        previewRequestSeqRef.current += 1;
        searchRequestSeqRef.current += 1;
        sectionTextCacheRef.current.clear();
        setBook(null);
        setBlob(null);
        setBookBuffer(null);
        setPreviewHtml("");
        setSectionBlocks([]);
        setActiveSectionId(null);
        setHighlightBlockIds([]);
        setScrollTopRequest(null);
        setBookmarks([]);
        setSearchQuery("");
        setSearchResults([]);
        setSearchError(null);
      }
    },
    [
      abortSummaryWorker,
      book,
      refreshLibrary,
      setActiveSectionId,
      setBlob,
      setBook,
      setBookBuffer,
      setHighlightBlockIds,
      setPreviewHtml,
      setSearchError,
      setSearchQuery,
      setSearchResults,
      setScrollTopRequest,
      setSectionBlocks,
    ],
  );

  const clearHighlights = useCallback(() => {
    setHighlightBlockIds([]);
  }, [setHighlightBlockIds]);

  return {
    library,
    book,
    bookBuffer,
    activeSectionId,
    previewHtml,
    sectionBlocks,
    loadingPreview,
    uploading,
    downloadingUrl,
    downloadProgress,
    downloadProgressLabel,
    downloadProgressPercent,
    downloadError,
    summarizingSection,
    progress,
    progressMessage,
    streamingSummary,
    activeSummaryKey,
    activeBlockId,
    selectedBlockIds,
    selectionAnchorBlockId,
    selectionAnchorLabel,
    summarizingSelectedBlocks,
    selectedSummaryProgressText,
    selectedSummaryResult,
    selectedSummaryError,
    scrollToBlockRequest,
    scrollTopRequest,
    highlightBlockIds,
    bookmarks,
    isActiveSectionBookmarked,
    searchQuery,
    searchResults,
    searchingBook,
    searchError,
    uploadFile,
    downloadDocumentFromUrl,
    downloadEpubFromUrl: downloadDocumentFromUrl,
    openBook,
    loadPreview,
    saveReaderPosition,
    toggleBookmark,
    setSearchQuery,
    searchBook,
    clearSearch: clearBookSearch,
    summarizeActiveSection,
    summarizeBlock,
    summarizeHeading,
    selectSummaryBlock,
    canExpandSelectedBlockRange,
    expandSelectedBlockRange,
    clearSelectedSummary,
    canDeleteActiveSummary,
    deleteActiveSummary,
    summarizeSelectedBlocks,
    addCommentForTextSelection,
    addTranslationForTextSelection,
    deleteAnnotation,
    activateAnnotation,
    selectReaderBlock,
    activateSummaryKey,
    enqueueHeadingSummary,
    autoSummarizeCurrentChapter,
    summaryTasks,
    summaryQueueStats,
    summaryQueueLabel,
    summaryQueuePaused,
    pauseSummaryQueue,
    resumeSummaryQueue,
    cancelSummaryTasksForCurrentChapter,
    clearFinishedSummaryTasks,
    retrySummaryTask,
    autoSummaryOnReading,
    setAutoSummaryOnReading,
    exportData,
    exportMarkdownNotes,
    exportBookBackup,
    exportCurrentBookBackup,
    exportLibraryBackup,
    exportSettingsBackup,
    importBackupFile,
    importSettingsBackupFile,
    removeBook,
    refreshLibrary,
    clearHighlights,
  };
}
