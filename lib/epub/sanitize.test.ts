import { describe, expect, it } from "vitest";
import { sanitizeEpubHtml } from "@/lib/epub/sanitize";
import { extractBlocksFromHtml } from "@/lib/epub/blocks";
import { buildReaderDocumentHtml, buildReaderWindowHtml } from "@/lib/reader-window";

const maliciousHtml = `
<html>
  <head>
    <base href="https://attacker.example/" />
    <meta http-equiv="refresh" content="0; url=https://attacker.example/" />
    <script>window.__owned = true</script>
  </head>
  <body>
    <h1 onclick="window.__click = true">Safe title</h1>
    <p style="background-image:url(javascript:owned)">Safe body</p>
    <img src="cover.png" onerror="window.__img = true" alt="Cover" />
    <a href="javascript:owned">Bad link</a>
    <a href="data:text/html,owned">Bad data link</a>
    <a href="https://example.com/read">Good link</a>
    <table><tr><td>Cell</td></tr></table>
    <iframe srcdoc="<script>window.__frame = true</script>"></iframe>
    <object data="owned"></object>
    <embed src="owned" />
    <form action="javascript:owned"><input /></form>
  </body>
</html>`;

function expectSafeEpubHtml(html: string): void {
  expect(html).not.toMatch(/<script\b/i);
  expect(html).not.toMatch(/<iframe\b/i);
  expect(html).not.toMatch(/<object\b/i);
  expect(html).not.toMatch(/<embed\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<base\b/i);
  expect(html).not.toMatch(/<meta\b[^>]*refresh/i);
  expect(html).not.toMatch(/\son[a-z][\w:-]*/i);
  expect(html).not.toMatch(/\ssrcdoc=/i);
  expect(html).not.toMatch(/javascript:/i);
  expect(html).not.toMatch(/\shref=["']data:/i);
}

describe("sanitizeEpubHtml", () => {
  it("removes executable EPUB content and keeps safe document structure", () => {
    const html = sanitizeEpubHtml(maliciousHtml);

    expectSafeEpubHtml(html);
    expect(html).toContain("Safe title");
    expect(html).toContain("Safe body");
    expect(html).toContain('src="cover.png"');
    expect(html).toContain('href="https://example.com/read"');
    expect(html).toContain("<table>");
  });

  it("sanitizes block extraction fallback output without executing scripts", () => {
    const { annotatedHtml } = extractBlocksFromHtml(maliciousHtml, "spine-0");

    expectSafeEpubHtml(annotatedHtml);
    expect(annotatedHtml).toContain("Safe title");
  });

  it("sanitizes reader-window stitched sections", () => {
    const windowHtml = buildReaderWindowHtml({
      currentHtml: maliciousHtml,
      currentSectionId: "spine-0",
      prevHtml: maliciousHtml,
      prevSectionId: "spine-prev",
      nextHtml: maliciousHtml,
      nextSectionId: "spine-next",
    });
    const documentHtml = buildReaderDocumentHtml({
      sections: [{ html: maliciousHtml, sectionId: "spine-0" }],
      currentSectionId: "spine-0",
    });

    expectSafeEpubHtml(windowHtml);
    expectSafeEpubHtml(documentHtml);
    expect(windowHtml).toContain("summary-epub-reader-window-section");
    expect(documentHtml).toContain("data-reader-window-full-document");
  });
});
