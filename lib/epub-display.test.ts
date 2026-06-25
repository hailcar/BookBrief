import { describe, expect, it } from "vitest";
import { applyEpubDisplayMode } from "@/lib/epub-display";

describe("applyEpubDisplayMode", () => {
  function styleById(html: string, id: string): string {
    return (
      html.match(
        new RegExp(`<style id="${id}">([\\s\\S]*?)<\\/style>`),
      )?.[1] ?? ""
    );
  }

  it("does not override authored foreground colors in global mode", () => {
    const html = applyEpubDisplayMode(
      '<h2 class="red">Red heading</h2><p><a class="red">Red link</a></p><blockquote class="red">Red quote</blockquote>',
      "global",
    );

    const globalCss = styleById(html, "summary-epub-global-mode");

    expect(globalCss).toBeTruthy();
    expect(globalCss).not.toMatch(
      /#summary-epub-root\s+:where\(h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\)[\s\S]*?color:/,
    );
    expect(globalCss).not.toMatch(
      /#summary-epub-root\s+blockquote[\s\S]*?color:/,
    );
    expect(globalCss).not.toMatch(/#summary-epub-root\s+a[\s\S]*?color:/);
  });

  it("preserves authored image layout in publisher mode", () => {
    const html = applyEpubDisplayMode(
      '<p><img class="inline-diagram" src="diagram.png" /></p>',
      "publisher",
    );

    const publisherCss = styleById(html, "summary-epub-publisher-mode");

    expect(publisherCss).toContain("max-width: 100%");
    expect(publisherCss).not.toMatch(/display:\s*block/);
    expect(publisherCss).not.toMatch(/margin:\s*1\.2em auto/);
    expect(publisherCss).not.toMatch(/width:\s*auto\s*!important/);
    expect(publisherCss).not.toMatch(/height:\s*auto\s*!important/);
    expect(publisherCss).not.toMatch(/object-fit:\s*contain\s*!important/);
  });

  it("keeps responsive image layout in global reading mode", () => {
    const html = applyEpubDisplayMode(
      '<p><img src="cover.png" /></p>',
      "global",
    );

    const globalCss = styleById(html, "summary-epub-global-mode");

    expect(globalCss).toMatch(/display:\s*block/);
    expect(globalCss).toMatch(/margin:\s*1\.2em auto/);
    expect(globalCss).toMatch(/max-width:\s*100%\s*!important/);
  });

  it("removes active EPUB content before injecting reader scripts", () => {
    const html = applyEpubDisplayMode(
      `<html>
        <head>
          <base href="https://attacker.example/" />
          <meta http-equiv="refresh" content="0; url=https://attacker.example/" />
          <script>window.__summaryEpubOwned = true</script>
        </head>
        <body>
          <img src="cover.png" onerror="window.__summaryEpubImageOwned = true" />
          <a href="javascript:window.__summaryEpubLinkOwned = true" onclick="window.__summaryEpubClickOwned = true">Bad link</a>
          <a href="data:text/html,<script>window.__summaryEpubDataOwned = true</script>">Data link</a>
          <a href="https://example.com/ok">Good link</a>
          <iframe srcdoc="<script>window.__summaryEpubFrameOwned = true</script>"></iframe>
        </body>
      </html>`,
      "global",
    );

    expect(html).not.toContain("__summaryEpubOwned");
    expect(html).not.toContain("__summaryEpubImageOwned");
    expect(html).not.toContain("__summaryEpubLinkOwned");
    expect(html).not.toContain("__summaryEpubClickOwned");
    expect(html).not.toContain("__summaryEpubDataOwned");
    expect(html).not.toContain("__summaryEpubFrameOwned");
    expect(html).not.toMatch(/<base\b/i);
    expect(html).not.toMatch(/<meta\b[^>]*refresh/i);
    expect(html).not.toMatch(/<iframe\b/i);
    expect(html).not.toMatch(/\son[a-z][\w:-]*=/i);
    expect(html).not.toMatch(/\shref=["']javascript:/i);
    expect(html).not.toMatch(/\shref=["']data:/i);
    expect(html).toContain('src="cover.png"');
    expect(html).toContain('href="https://example.com/ok"');
    expect(html).toContain('id="summary-epub-stage-script"');
    expect(html).toContain('id="summary-epub-heading-script"');
  });
});
