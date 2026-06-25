export type SectionId = string;

export type DocumentFormat = "epub" | "pdf";

export type EpubSection = {
  id: SectionId;
  index: number;
  title: string;
  href: string;
  format?: DocumentFormat;
  pageNumber?: number;
  endPageNumber?: number;
  navLevel?: number;
  textLength?: number;
};

export type EpubBlockType =
  | "heading"
  | "paragraph"
  | "quote"
  | "list_item"
  | "code"
  | "image_caption"
  | "table";

export type EpubBlock = {
  id: string;
  type: EpubBlockType;
  text: string;
  chapterId: string;
  index: number;
  level?: number;
};

export type EpubHeading = {
  id: string;
  text: string;
  level: number;
  index: number;
  chapterId: string;
  blockId: string;
};

export type SummaryMode =
  | "paragraph"
  | "heading_section_summary"
  | "selected_blocks";

export type HeadingSectionSummaryContent = {
  plainText: string;
  markdownText: string;
  blockIds: string[];
  startIndex: number;
  endIndex: number;
  contentHash?: string;
};

export type HeadingSectionSummaryRequest = {
  mode: "heading_section_summary";
  bookId: string;
  chapterId: string;
  heading: Pick<EpubHeading, "id" | "text" | "level">;
  content: HeadingSectionSummaryContent;
  options?: {
    summaryStyle?: "must_remember_points";
    removeRedundancy?: boolean;
    makeImplicitMeaningExplicit?: boolean;
    autoChunk?: boolean;
    maxChunkChars?: number;
  };
};

export type SectionSummary = {
  sectionId: SectionId;
  summary: string;
  model?: string;
  updatedAt: number;
  mode?: SummaryMode;
  scopeType?: "paragraph" | "heading_section" | "chapter" | "selected_blocks";
  summaryKey?: string;
  pageId?: string;
  sourceText?: string;
  headingBlockId?: string;
  headingText?: string;
  headingLevel?: number;
  blockIds?: string[];
  startBlockId?: string;
  endBlockId?: string;
  startIndex?: number;
  endIndex?: number;
  contentHash?: string;
  status?: "success" | "cached";
};

export type SelectedBlocksSummaryResult = {
  sectionId: SectionId;
  blockIds: string[];
  sourceText: string;
  summary: string;
  model?: string;
  updatedAt: number;
  summaryKey?: string;
  pageId?: string;
  scopeType?: "selected_blocks";
  startBlockId?: string;
  endBlockId?: string;
  startIndex?: number;
  endIndex?: number;
};

export type EpubComment = {
  id: string;
  sectionId: SectionId;
  blockIds: string[];
  comment: string;
  kind?: "comment" | "translation";
  sourceText?: string;
  sourceFragments?: { blockId: string; text: string }[];
  model?: string;
  createdAt: number;
  updatedAt: number;
  startBlockId?: string;
  endBlockId?: string;
  startIndex?: number;
  endIndex?: number;
};

export type InlineSummaryBubble = {
  summaryId?: string;
  blockId: string;
  blockIds?: string[];
  summary: string;
  status: "loading" | "success" | "cached" | "failed";
  label?: string;
  headingText?: string;
  headingLevel?: number;
};

export type InlineSummaryActionState = {
  activeBlockId: string | null;
  selectedBlockIds: string[];
  selectedSummaryId?: string | null;
  selectedSummaryBlockIds?: string[];
  summarizing?: boolean;
};

export type SummaryTaskMode =
  | "manual"
  | "auto_current_chapter"
  | "auto_on_reading"
  | "auto_on_import";

export type SummaryTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "skipped";

export type SummaryTask = {
  id: string;
  bookId: string;
  chapterId: string;
  headingId: string;
  headingText: string;
  headingLevel: number;
  blockIds: string[];
  contentHash: string;
  mode: SummaryTaskMode;
  status: SummaryTaskStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type SummaryQueueStats = {
  queued: number;
  running: number;
  success: number;
  failed: number;
  skipped: number;
  cancelled: number;
  cached: number;
};

export type StoredBook = {
  id: string;
  fileName: string;
  format?: DocumentFormat;
  uploadedAt: number;
  sections: EpubSection[];
  summaries: Record<string, SectionSummary>;
  comments: Record<string, EpubComment>;
};

export type ReadingBookmark = {
  sectionId: SectionId;
  title: string;
  createdAt: number;
};

export type EpubSearchResult = {
  sectionId: SectionId;
  sectionTitle: string;
  snippet: string;
  matchIndex: number;
};

export type ExportPayload = {
  version: 1;
  exportedAt: number;
  book: {
    fileName: string;
    format?: DocumentFormat;
    uploadedAt: number;
    sections: EpubSection[];
    summaries: SectionSummary[];
    comments?: EpubComment[];
  };
};

export type BackupDocumentPayload = {
  type: string;
  size: number;
  dataBase64: string;
};

export type BackupBookPayload = {
  id: string;
  fileName: string;
  format?: DocumentFormat;
  uploadedAt: number;
  sections: EpubSection[];
  summaries: Record<string, SectionSummary> | SectionSummary[];
  comments?: Record<string, EpubComment> | EpubComment[];
  document?: BackupDocumentPayload;
  readerState?: unknown;
};

export type LibraryBackupPayload = {
  version: 2;
  exportedAt: number;
  scope: "book" | "library";
  books: BackupBookPayload[];
};

export type ParsedBackupBook = {
  id?: string;
  fileName: string;
  format?: DocumentFormat;
  uploadedAt?: number;
  sections: EpubSection[];
  summaries: Record<string, SectionSummary>;
  comments: Record<string, EpubComment>;
  blob?: Blob;
  readerState?: unknown;
};

export type ParsedBackupPayload = {
  version: 1 | 2;
  exportedAt?: number;
  scope?: "book" | "library";
  books: ParsedBackupBook[];
};

export type AiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  summarySystemPrompt?: string;
  summaryUserTemplate?: string;
  headingSummarySystemPrompt?: string;
  headingSummaryUserTemplate?: string;
};
