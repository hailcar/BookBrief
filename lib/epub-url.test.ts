import { describe, expect, it } from "vitest";
import {
  assertHttpDocumentUrl,
  assertHttpEpubUrl,
  ensureDocumentExtension,
  ensureEpubExtension,
  fileNameFromContentDisposition,
  fileNameFromDocumentUrl,
  fileNameFromEpubUrl,
  supportedFileNameFromDocumentUrlPath,
} from "@/lib/epub-url";

describe("epub url helpers", () => {
  it("extracts filename from content disposition", () => {
    expect(
      fileNameFromContentDisposition(
        "attachment; filename*=UTF-8''%E4%B9%A6.epub",
      ),
    ).toBe("书.epub");
    expect(
      fileNameFromContentDisposition('attachment; filename="book.epub"'),
    ).toBe("book.epub");
  });

  it("handles encoded language filenames and quoted semicolons", () => {
    expect(
      fileNameFromContentDisposition(
        "attachment; filename*=UTF-8'en'%E4%B9%A6%20A.epub",
      ),
    ).toBe("书 A.epub");
    expect(
      fileNameFromContentDisposition('attachment; filename="Part 1; Intro.epub"'),
    ).toBe("Part 1; Intro.epub");
  });

  it("cleans unsafe path-like filenames", () => {
    expect(
      fileNameFromContentDisposition(
        "attachment; filename*=UTF-8''..%2F..%2FSecret%3APlan.epub",
      ),
    ).toBe("Secret_Plan.epub");
    expect(ensureEpubExtension("..\\nested\\Book?.epub")).toBe("Book_.epub");
    expect(ensureEpubExtension("\u0000")).toBe("downloaded.epub");
  });

  it("falls back to url path and ensures epub extension", () => {
    expect(fileNameFromEpubUrl("https://example.com/books/demo")).toBe(
      "demo.epub",
    );
    expect(fileNameFromEpubUrl("https://example.com/books/demo.epub")).toBe(
      "demo.epub",
    );
    expect(fileNameFromEpubUrl("https://example.com/books/My%20Book%3F")).toBe(
      "My Book_.epub",
    );
  });

  it("keeps pdf filenames for document urls", () => {
    expect(fileNameFromDocumentUrl("https://example.com/books/demo.pdf")).toBe(
      "demo.pdf",
    );
    expect(
      fileNameFromDocumentUrl(
        "https://example.com/download",
        'attachment; filename="Paper.pdf"',
      ),
    ).toBe("Paper.pdf");
    expect(
      fileNameFromDocumentUrl(
        "https://example.com/download",
        null,
        "application/pdf",
      ),
    ).toBe("download.pdf");
    expect(
      fileNameFromDocumentUrl(
        "https://example.com/",
        null,
        "application/pdf",
      ),
    ).toBe("downloaded.pdf");
    expect(ensureDocumentExtension("notes", "pdf")).toBe("notes.pdf");
    expect(ensureDocumentExtension("\u0000", "pdf")).toBe("downloaded.pdf");
  });

  it("only pre-download reuses URL path filenames when the document extension is explicit", () => {
    expect(
      supportedFileNameFromDocumentUrlPath("https://example.com/books/demo.pdf"),
    ).toBe("demo.pdf");
    expect(
      supportedFileNameFromDocumentUrlPath("https://example.com/books/demo"),
    ).toBeNull();
    expect(
      supportedFileNameFromDocumentUrlPath("https://example.com/"),
    ).toBeNull();
  });

  it("only accepts http urls", () => {
    expect(assertHttpEpubUrl("https://example.com/a.epub")).toBe(
      "https://example.com/a.epub",
    );
    expect(() => assertHttpEpubUrl("file:///tmp/a.epub")).toThrow(
      "只支持 http 或 https",
    );
    expect(assertHttpDocumentUrl("https://example.com/a.pdf")).toBe(
      "https://example.com/a.pdf",
    );
    expect(() => assertHttpDocumentUrl("file:///tmp/a.pdf")).toThrow(
      "只支持 http 或 https",
    );
  });

  it("accepts percent-encoded url query values after URLSearchParams decoding", () => {
    const raw =
      "url=https%3A%2F%2Fexample.com%2Fbooks%2Fepub%2Fcss%2FCSS%2520Visual.epub";
    const queryUrl = new URLSearchParams(raw).get("url");

    expect(queryUrl).toBe(
      "https://example.com/books/epub/css/CSS%20Visual.epub",
    );
    expect(assertHttpEpubUrl(queryUrl ?? "")).toBe(
      "https://example.com/books/epub/css/CSS%20Visual.epub",
    );
  });
});
