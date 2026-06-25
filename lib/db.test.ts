import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";

const mockState = vi.hoisted(() => ({
  openDB: vi.fn(),
}));

vi.mock("idb", () => ({
  openDB: mockState.openDB,
}));

type FakeDb = {
  count: ReturnType<typeof vi.fn>;
  getAll: ReturnType<typeof vi.fn>;
  getAllFromIndex: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function createFakeDb(overrides: Partial<FakeDb> = {}): FakeDb {
  return {
    count: vi.fn(async () => 0),
    getAll: vi.fn(async () => []),
    getAllFromIndex: vi.fn(async () => []),
    put: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    ...overrides,
  };
}

async function loadDbModule(fakeDb: FakeDb) {
  vi.resetModules();
  vi.mocked(openDB).mockResolvedValue(fakeDb as never);
  return import("@/lib/db");
}

beforeEach(() => {
  mockState.openDB.mockReset();
});

describe("IndexedDB metadata access", () => {
  it("lists books from the lightweight metadata store", async () => {
    const fakeDb = createFakeDb({
      count: vi.fn(async () => 2),
      getAll: vi.fn(async (store: string) => {
        if (store === "books") throw new Error("books store should not load");
        return [
          {
            id: "old",
            fileName: "old.epub",
            fileNameKey: "old.epub",
            uploadedAt: 1,
          },
          {
            id: "new",
            fileName: "new.epub",
            fileNameKey: "new.epub",
            uploadedAt: 2,
          },
        ];
      }),
    });
    const { listBooks } = await loadDbModule(fakeDb);

    await expect(listBooks()).resolves.toEqual([
      { id: "new", fileName: "new.epub", format: "epub", uploadedAt: 2 },
      { id: "old", fileName: "old.epub", format: "epub", uploadedAt: 1 },
    ]);
    expect(fakeDb.getAll).toHaveBeenCalledWith("bookMeta");
    expect(fakeDb.getAll).not.toHaveBeenCalledWith("books");
  });

  it("finds duplicate file names through the metadata filename index", async () => {
    const fakeDb = createFakeDb({
      count: vi.fn(async () => 2),
      getAllFromIndex: vi.fn(async () => [
        {
          id: "first",
          fileName: "Book.epub",
          fileNameKey: "book.epub",
          uploadedAt: 10,
        },
        {
          id: "latest",
          fileName: "book.epub",
          fileNameKey: "book.epub",
          uploadedAt: 20,
        },
      ]),
      getAll: vi.fn(async (store: string) => {
        if (store === "books") throw new Error("books store should not load");
        return [];
      }),
    });
    const { findBookByFileName } = await loadDbModule(fakeDb);

    await expect(findBookByFileName("  BOOK.epub  ")).resolves.toEqual({
      id: "latest",
      fileName: "book.epub",
      uploadedAt: 20,
    });
    expect(fakeDb.getAllFromIndex).toHaveBeenCalledWith(
      "bookMeta",
      "fileNameKey",
      "book.epub",
    );
    expect(fakeDb.getAll).not.toHaveBeenCalledWith("books");
  });

  it("does not open IndexedDB for an empty filename lookup", async () => {
    vi.resetModules();
    const { findBookByFileName } = await import("@/lib/db");

    await expect(findBookByFileName("   ")).resolves.toBeNull();
    expect(openDB).not.toHaveBeenCalled();
  });

  it("backfills lightweight stores once when upgrading an existing books store", async () => {
    const rows = [
      {
        id: "b1",
        fileName: " First.epub ",
        uploadedAt: 1,
        blob: new Blob(["a"]),
        sections: [],
        summaries: {},
      },
    ];
    const fakeDb = createFakeDb({
      count: vi.fn(async (store: string) => (store === "books" ? 1 : 0)),
      getAll: vi.fn(async (store: string) => {
        if (store === "books") return rows;
        return [];
      }),
    });
    const { listBooks } = await loadDbModule(fakeDb);

    await listBooks();
    await listBooks();

    expect(fakeDb.clear).toHaveBeenCalledTimes(2);
    expect(fakeDb.clear).toHaveBeenCalledWith("bookMeta");
    expect(fakeDb.clear).toHaveBeenCalledWith("bookState");
    expect(fakeDb.put).toHaveBeenCalledTimes(2);
    expect(fakeDb.put).toHaveBeenCalledWith("bookMeta", {
      id: "b1",
      fileName: " First.epub ",
      format: "epub",
      fileNameKey: "first.epub",
      uploadedAt: 1,
    });
    expect(fakeDb.put).toHaveBeenCalledWith("bookState", {
      id: "b1",
      fileName: " First.epub ",
      format: "epub",
      uploadedAt: 1,
      sections: [],
      summaries: {},
      comments: {},
    });
  });

  it("backfills state when metadata already exists but state is missing", async () => {
    const rows = [
      {
        id: "b1",
        fileName: "Book.epub",
        uploadedAt: 1,
        blob: new Blob(["a"]),
        sections: [{ id: "spine-0", index: 0, title: "One", href: "one.xhtml" }],
        summaries: {},
      },
    ];
    const fakeDb = createFakeDb({
      count: vi.fn(async (store: string) => {
        if (store === "books" || store === "bookMeta") return 1;
        return 0;
      }),
      getAll: vi.fn(async (store: string) => {
        if (store === "books") return rows;
        return [];
      }),
    });
    const { listBooks } = await loadDbModule(fakeDb);

    await listBooks();

    expect(fakeDb.getAll).toHaveBeenCalledWith("books");
    expect(fakeDb.clear).toHaveBeenCalledWith("bookMeta");
    expect(fakeDb.clear).toHaveBeenCalledWith("bookState");
    expect(fakeDb.put).toHaveBeenCalledWith(
      "bookState",
      expect.objectContaining({ id: "b1", sections: rows[0].sections }),
    );
  });

  it("gets book state from the lightweight state store", async () => {
    const state = {
      id: "b1",
      fileName: "Book.epub",
      uploadedAt: 1,
      sections: [],
      summaries: {},
    };
    const fakeDb = createFakeDb({
      get: vi.fn(async (store: string) => {
        if (store === "books") throw new Error("books store should not load");
        if (store === "bookState") return state;
        return null;
      }),
    });
    const { getBook } = await loadDbModule(fakeDb);

    await expect(getBook("b1")).resolves.toEqual({
      ...state,
      format: "epub",
      comments: {},
    });
    expect(fakeDb.get).toHaveBeenCalledWith("bookState", "b1");
    expect(fakeDb.get).not.toHaveBeenCalledWith("books", "b1");
  });

  it("backfills missing book state for old rows on demand", async () => {
    const row = {
      id: "b1",
      fileName: "Book.epub",
      uploadedAt: 1,
      blob: new Blob(["content"]),
      sections: [{ id: "spine-0", index: 0, title: "One", href: "one.xhtml" }],
      summaries: {
        "spine-0": {
          sectionId: "spine-0",
          summary: "cached",
          updatedAt: 1,
        },
      },
    };
    const fakeDb = createFakeDb({
      get: vi.fn(async (store: string) => {
        if (store === "bookState") return null;
        if (store === "books") return row;
        return null;
      }),
    });
    const { getBook } = await loadDbModule(fakeDb);

    await expect(getBook("b1")).resolves.toEqual({
      id: "b1",
      fileName: "Book.epub",
      format: "epub",
      uploadedAt: 1,
      sections: row.sections,
      summaries: row.summaries,
      comments: {},
    });
    expect(fakeDb.put).toHaveBeenCalledWith(
      "bookState",
      expect.objectContaining({ id: "b1", summaries: row.summaries }),
    );
    expect(fakeDb.put).toHaveBeenCalledWith(
      "bookMeta",
      expect.objectContaining({ id: "b1", fileNameKey: "book.epub" }),
    );
  });

  it("updates summaries in the lightweight state store without loading the blob row", async () => {
    const state = {
      id: "b1",
      fileName: "Book.epub",
      uploadedAt: 1,
      sections: [],
      summaries: {},
    };
    const fakeDb = createFakeDb({
      get: vi.fn(async (store: string) => {
        if (store === "books") throw new Error("books store should not load");
        if (store === "bookState") return state;
        return null;
      }),
    });
    const { updateSummaries } = await loadDbModule(fakeDb);
    const summaries = {
      "spine-0": { sectionId: "spine-0", summary: "new", updatedAt: 2 },
    };

    await updateSummaries("b1", summaries);

    expect(fakeDb.get).toHaveBeenCalledWith("bookState", "b1");
    expect(fakeDb.get).not.toHaveBeenCalledWith("books", "b1");
    expect(fakeDb.put).toHaveBeenCalledWith("bookState", {
      ...state,
      format: "epub",
      summaries,
      comments: {},
    });
    expect(fakeDb.put).not.toHaveBeenCalledWith(
      "books",
      expect.anything(),
    );
  });

  it("saves and deletes book metadata alongside the blob row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T00:00:00.000Z"));
    try {
      const fakeDb = createFakeDb();
      const { deleteBook, saveBook } = await loadDbModule(fakeDb);

      await saveBook("b1", "Book.epub", new Blob(["content"]), [], {});
      await deleteBook("b1");

      expect(fakeDb.put).toHaveBeenCalledWith(
        "bookMeta",
        expect.objectContaining({
          id: "b1",
          fileName: "Book.epub",
          format: "epub",
          fileNameKey: "book.epub",
          uploadedAt: Date.parse("2026-06-24T00:00:00.000Z"),
        }),
      );
      expect(fakeDb.put).toHaveBeenCalledWith(
        "bookState",
        expect.objectContaining({
          id: "b1",
          fileName: "Book.epub",
          format: "epub",
          uploadedAt: Date.parse("2026-06-24T00:00:00.000Z"),
          sections: [],
          summaries: {},
        }),
      );
      expect(fakeDb.delete).toHaveBeenCalledWith("books", "b1");
      expect(fakeDb.delete).toHaveBeenCalledWith("bookMeta", "b1");
      expect(fakeDb.delete).toHaveBeenCalledWith("bookState", "b1");
    } finally {
      vi.useRealTimers();
    }
  });
});
