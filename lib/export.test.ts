import { describe, expect, it } from "vitest";
import {
  buildMarkdownReadingNotes,
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

describe("markdown reading notes export", () => {
  it("renders summaries, comments, translations, and bookmarks as notes", () => {
    const book: StoredBook = {
      id: "book-1",
      fileName: "Book.epub",
      format: "epub",
      uploadedAt: 123,
      sections: [
        { id: "spine-0", index: 0, title: "Intro", href: "intro.xhtml" },
        { id: "spine-1", index: 1, title: "Deep Dive", href: "deep.xhtml" },
      ],
      summaries: {
        "spine-1::h::b1": {
          sectionId: "spine-1",
          summary: "Important summary",
          headingText: "The Point",
          updatedAt: 300,
          scopeType: "heading_section",
        },
        "selected::spine-0::p1": {
          sectionId: "spine-0",
          summary: "Selected summary",
          updatedAt: 200,
          scopeType: "selected_blocks",
        },
      },
      comments: {
        "comment-1": {
          id: "comment-1",
          sectionId: "spine-0",
          blockIds: ["p1"],
          comment: "My comment",
          sourceText: "Original quote",
          createdAt: 400,
          updatedAt: 400,
        },
        "translation-1": {
          id: "translation-1",
          sectionId: "spine-1",
          blockIds: ["p2"],
          comment: "Translated text",
          kind: "translation",
          sourceText: "Source text",
          createdAt: 500,
          updatedAt: 500,
        },
      },
    };

    const markdown = buildMarkdownReadingNotes({
      book,
      bookmarks: [{ sectionId: "spine-1", title: "Deep Dive", createdAt: 100 }],
    });

    expect(markdown).toContain("# Book.epub");
    expect(markdown).toContain("## 书签");
    expect(markdown).toContain("- Deep Dive (spine-1)");
    expect(markdown).toContain("### Intro");
    expect(markdown).toContain("#### 所选段落总结");
    expect(markdown).toContain("Selected summary");
    expect(markdown).toContain("### Deep Dive");
    expect(markdown).toContain("#### 标题总结：The Point");
    expect(markdown).toContain("Important summary");
    expect(markdown).toContain("## 批注与翻译");
    expect(markdown).toContain("#### 评论");
    expect(markdown).toContain("> Original quote");
    expect(markdown).toContain("My comment");
    expect(markdown).toContain("#### 翻译");
    expect(markdown).toContain("Translated text");
  });
});
