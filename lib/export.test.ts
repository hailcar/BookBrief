import { describe, expect, it } from "vitest";
import {
  buildLibraryBackupPayload,
  parseBackupPayload,
} from "@/lib/export";
import type { StoredBook } from "@/lib/types";

describe("library backup export", () => {
  it("round-trips a book backup with document bytes and summaries", async () => {
    const book: StoredBook = {
      id: "book-1",
      fileName: "Book.epub",
      format: "epub",
      uploadedAt: 123,
      sections: [{ id: "spine-0", index: 0, title: "One", href: "one.xhtml" }],
      summaries: {
        "spine-0": {
          sectionId: "spine-0",
          summary: "cached",
          updatedAt: 456,
        },
      },
      comments: {
        "comment-1": {
          id: "comment-1",
          sectionId: "spine-0",
          blockIds: ["spine-0-p-1"],
          comment: "remember this",
          createdAt: 500,
          updatedAt: 501,
        },
      },
    };
    const blob = new Blob(["epub bytes"], { type: "application/epub+zip" });

    const payload = await buildLibraryBackupPayload([{ book, blob }], "book");
    const parsed = parseBackupPayload(payload);

    expect(payload.version).toBe(2);
    expect(payload.scope).toBe("book");
    expect(payload.books[0].document?.dataBase64).toBeTruthy();
    expect(parsed.books[0]).toMatchObject({
      id: "book-1",
      fileName: "Book.epub",
      format: "epub",
      uploadedAt: 123,
      sections: book.sections,
      summaries: book.summaries,
      comments: book.comments,
    });
    await expect(parsed.books[0].blob?.text()).resolves.toBe("epub bytes");
  });

  it("loads legacy summary-only exports as a single parsed book", () => {
    const parsed = parseBackupPayload({
      version: 1,
      exportedAt: 789,
      book: {
        fileName: "Book.pdf",
        format: "pdf",
        uploadedAt: 123,
        sections: [{ id: "page-1", index: 0, title: "Page 1", href: "page:1" }],
        summaries: [
          { sectionId: "page-1", summary: "old", updatedAt: 456 },
        ],
      },
    });

    expect(parsed).toMatchObject({
      version: 1,
      exportedAt: 789,
      scope: "book",
      books: [
        {
          fileName: "Book.pdf",
          format: "pdf",
          uploadedAt: 123,
          summaries: {
            "page-1": {
              sectionId: "page-1",
              summary: "old",
              updatedAt: 456,
            },
          },
        },
      ],
    });
    expect(parsed.books[0].blob).toBeUndefined();
  });
});
