import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("EpubReaderPanel immersive summary integration", () => {
  it("renders immersive summaries outside the iframe overlay", () => {
    const source = readFileSync(
      join(process.cwd(), "components/epub-reader-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("ImmersiveSummaryPanel");
    expect(source).toContain("inlineSummaryBubbles={[]}");
    expect(source).toContain("onReaderBlockClick");
    expect(source).toContain("onActivateSummary");
    expect(source).toContain("activeSummaryId={activeSummaryKey}");
  });

  it("keeps the immersive menu as a two-column catalog and actions layout", () => {
    const source = readFileSync(
      join(process.cwd(), "components/epub-reader-panel.tsx"),
      "utf8",
    );

    expect(source).toContain('data-reader-menu-layout="two-column"');
    expect(source).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(source).toContain("data-reader-menu-toc");
    expect(source).toContain("data-reader-menu-actions");
    expect(source).toContain("搜索目录");
    expect(source).toContain("阅读设置");
    expect(source).not.toContain("menuView");
    expect(source).not.toContain("setMenuView");
  });
});
