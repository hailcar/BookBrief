import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("PDF canvas reader", () => {
  it("branches PDF documents to PdfReader while EPUB keeps the iframe preview", () => {
    const contentPane = source("components/reader-content-pane.tsx");
    const workspace = source("components/epub-workspace.tsx");
    const fullscreenPanel = source("components/epub-reader-panel.tsx");

    expect(contentPane).toContain("documentFormat === \"pdf\"");
    expect(contentPane).toContain("<PdfReader");
    expect(contentPane).toContain("<EpubSectionPreview");
    expect(workspace).toContain("documentFormat={activeBookFormat}");
    expect(workspace).toContain("bookBuffer={ws.bookBuffer}");
    expect(fullscreenPanel).toContain("bookBuffer={bookBuffer}");
  });

  it("renders PDF pages with pdf.js canvas rendering and cancels stale tasks", () => {
    const page = source("components/pdf-page.tsx");
    const reader = source("components/pdf-reader.tsx");

    expect(page).toContain("page.render({");
    expect(page).toContain("canvas,");
    expect(page).toContain("transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0]");
    expect(page).toContain('background: "rgb(255,255,255)"');
    expect(page).toContain("renderTask.cancel()");
    expect(page).toContain("isPdfRenderCancelled(error)");
    expect(page).toContain("data-pdf-render-enabled");
    expect(reader).toContain("new IntersectionObserver");
    expect(reader).toContain("rootMargin: \"1800px 0px\"");
    expect(reader).toContain("lastHandledScrollNonceRef.current === scrollTopRequest.nonce");
  });

  it("uses transparent text spans for search and native text selection without summary clicks", () => {
    const page = source("components/pdf-page.tsx");
    const reader = source("components/pdf-reader.tsx");
    const contentPane = source("components/reader-content-pane.tsx");
    const pdfBranch = contentPane.slice(
      contentPane.indexOf('if (documentFormat === "pdf")'),
      contentPane.indexOf("if (loadingPreview && !previewHtml)"),
    );

    expect(page).toContain("text-transparent");
    expect(page).toContain("data-pdf-block-id={span.blockId}");
    expect(page).toContain("searchHighlightClass");
    expect(page).not.toContain("onReaderBlockClick");
    expect(reader).not.toContain("onReaderBlockClick");
    expect(reader).not.toContain("selectedBlockIds");
    expect(reader).not.toContain("summarizedBlockIds");
    expect(contentPane).toContain('activeTab === "summary" && documentFormat !== "pdf"');
    expect(pdfBranch).not.toContain("onReaderBlockClick");
  });
});
