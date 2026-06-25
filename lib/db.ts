import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  DocumentFormat,
  EpubComment,
  EpubSection,
  SectionSummary,
  StoredBook,
} from "@/lib/types";

type BookRow = {
  id: string;
  fileName: string;
  format?: DocumentFormat;
  uploadedAt: number;
  blob: Blob;
  sections: EpubSection[];
  summaries: Record<string, SectionSummary>;
  comments?: Record<string, EpubComment>;
};

type BookMetaRow = Pick<StoredBook, "id" | "fileName" | "uploadedAt"> & {
  format?: DocumentFormat;
  fileNameKey: string;
};

type BookStateRow = StoredBook;

type SummaryEpubDB = DBSchema & {
  books: {
    key: string;
    value: BookRow;
  };
  bookState: {
    key: string;
    value: BookStateRow;
  };
  bookMeta: {
    key: string;
    value: BookMetaRow;
    indexes: {
      fileNameKey: string;
    };
  };
};

let dbPromise: Promise<IDBPDatabase<SummaryEpubDB>> | null = null;
let lightweightStoresReadyPromise: Promise<void> | null = null;

function fileNameKey(fileName: string): string {
  return fileName.trim().toLowerCase();
}

function inferFormatFromFileName(fileName: string): DocumentFormat {
  return fileName.trim().toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
}

function rowFormat(row: { fileName: string; format?: DocumentFormat }): DocumentFormat {
  return row.format ?? inferFormatFromFileName(row.fileName);
}

function metaFromBookRow(row: BookRow): BookMetaRow {
  return {
    id: row.id,
    fileName: row.fileName,
    format: rowFormat(row),
    fileNameKey: fileNameKey(row.fileName),
    uploadedAt: row.uploadedAt,
  };
}

function stateFromBookRow(row: BookRow): BookStateRow {
  return {
    id: row.id,
    fileName: row.fileName,
    format: rowFormat(row),
    uploadedAt: row.uploadedAt,
    sections: row.sections,
    summaries: row.summaries,
    comments: row.comments ?? {},
  };
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SummaryEpubDB>("summary-epub", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("bookState")) {
          db.createObjectStore("bookState", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("bookMeta")) {
          const metaStore = db.createObjectStore("bookMeta", {
            keyPath: "id",
          });
          metaStore.createIndex("fileNameKey", "fileNameKey");
        }
      },
    });
  }
  return dbPromise;
}

async function ensureLightweightBookStores(
  db: IDBPDatabase<SummaryEpubDB>,
): Promise<void> {
  if (!lightweightStoresReadyPromise) {
    lightweightStoresReadyPromise = (async () => {
      const [bookCount, metaCount, stateCount] = await Promise.all([
        db.count("books"),
        db.count("bookMeta"),
        db.count("bookState"),
      ]);
      if (bookCount === metaCount && bookCount === stateCount) return;

      const rows = await db.getAll("books");
      await Promise.all([db.clear("bookMeta"), db.clear("bookState")]);
      await Promise.all(
        rows.flatMap((row) => [
          db.put("bookMeta", metaFromBookRow(row)),
          db.put("bookState", stateFromBookRow(row)),
        ]),
      );
    })().catch((err) => {
      lightweightStoresReadyPromise = null;
      throw err;
    });
  }
  await lightweightStoresReadyPromise;
}

export async function saveBook(
  id: string,
  fileName: string,
  blob: Blob,
  sections: EpubSection[],
  summaries: Record<string, SectionSummary> = {},
  format: DocumentFormat = inferFormatFromFileName(fileName),
  uploadedAt: number = Date.now(),
  comments: Record<string, EpubComment> = {},
): Promise<void> {
  const db = await getDb();
  const row: BookRow = {
    id,
    fileName,
    format,
    uploadedAt,
    blob,
    sections,
    summaries,
    comments,
  };
  await db.put("books", row);
  await db.put("bookMeta", metaFromBookRow(row));
  await db.put("bookState", stateFromBookRow(row));
}

export async function getBook(id: string): Promise<StoredBook | null> {
  const db = await getDb();
  const state = await db.get("bookState", id);
  if (state) {
    const hydratedState: StoredBook = {
      ...state,
      format: state.format ?? inferFormatFromFileName(state.fileName),
      comments: state.comments ?? {},
    };
    if (!state.format || !state.comments) {
      await db.put("bookState", hydratedState);
    }
    return hydratedState;
  }

  const row = await db.get("books", id);
  if (!row) return null;
  const nextState = stateFromBookRow(row);
  await db.put("bookState", nextState);
  await db.put("bookMeta", metaFromBookRow(row));
  return nextState;
}

export async function getBookBlob(id: string): Promise<Blob | null> {
  const db = await getDb();
  const row = await db.get("books", id);
  return row?.blob ?? null;
}

export async function updateSummaries(
  id: string,
  summaries: Record<string, SectionSummary>,
): Promise<void> {
  const db = await getDb();
  const state = await getBook(id);
  if (!state) return;
  await db.put("bookState", { ...state, summaries });
}

export async function updateComments(
  id: string,
  comments: Record<string, EpubComment>,
): Promise<void> {
  const db = await getDb();
  const state = await getBook(id);
  if (!state) return;
  await db.put("bookState", { ...state, comments });
}

export async function updateBookSections(
  id: string,
  sections: EpubSection[],
): Promise<void> {
  const db = await getDb();
  const [state, row] = await Promise.all([
    db.get("bookState", id),
    db.get("books", id),
  ]);
  if (state) await db.put("bookState", { ...state, sections });
  if (row) await db.put("books", { ...row, sections });
}

export async function listBooks(): Promise<
  Pick<StoredBook, "id" | "fileName" | "format" | "uploadedAt">[]
> {
  const db = await getDb();
  await ensureLightweightBookStores(db);
  const all = await db.getAll("bookMeta");
  return all
    .map((b) => ({
      id: b.id,
      fileName: b.fileName,
      format: b.format ?? inferFormatFromFileName(b.fileName),
      uploadedAt: b.uploadedAt,
    }))
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("books", id);
  await db.delete("bookMeta", id);
  await db.delete("bookState", id);
}

/**
 * Find the most recently stored book whose fileName matches the given name.
 * Comparison is case-insensitive and ignores leading/trailing whitespace, so a
 * URL download that resolves to the same file name as an existing book reuses
 * it instead of re-downloading. Returns the most recent match (by uploadedAt),
 * or null when nothing matches.
 */
export async function findBookByFileName(
  fileName: string,
): Promise<{ id: string; fileName: string; uploadedAt: number } | null> {
  const target = fileNameKey(fileName);
  if (!target) return null;
  const db = await getDb();
  await ensureLightweightBookStores(db);
  const all = await db.getAllFromIndex("bookMeta", "fileNameKey", target);
  let best: { id: string; fileName: string; uploadedAt: number } | null = null;
  for (const b of all) {
    if (!best || b.uploadedAt > best.uploadedAt) {
      best = { id: b.id, fileName: b.fileName, uploadedAt: b.uploadedAt };
    }
  }
  return best;
}
