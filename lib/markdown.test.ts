import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "@/lib/markdown";

describe("renderMarkdownToHtml", () => {
  it("renders common summary markdown blocks", () => {
    const html = renderMarkdownToHtml(`# 标题

- **重点** one
- \`code\`

> 引用
`);

    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<blockquote>");
  });

  it("escapes raw html and blocks unsafe links", () => {
    const html = renderMarkdownToHtml(
      `<img src=x onerror=alert(1)>
[bad](javascript:alert(1))
[ok](https://example.com)`,
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain('href="#"');
    expect(html).toContain('href="https://example.com"');
  });
});
