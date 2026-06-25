import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ImmersiveSummaryPanel", () => {
  it("uses a single unified scroll body instead of scrolling summary cards", () => {
    const source = readFileSync(
      join(process.cwd(), "components/immersive-summary-panel.tsx"),
      "utf8",
    );
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    expect(source).toContain("summary-panel-scroll");
    expect(source).toContain("scrollRef");
    expect(source).toContain("onWheel={scrollSummaryWithWheel}");
    expect(source).toContain("touch-pan-y");
    expect(source).toContain("overscroll-contain");
    expect(source.match(/overflow-y-auto/g) ?? []).toHaveLength(1);
    expect(source).not.toContain("max-h-80");
    expect(source).not.toContain("h-64");
    expect(source).not.toContain("useState(() => !isMobileViewport())");
    expect(source).not.toContain('touchAction: "none"');
    expect(source).not.toContain("md:max-h-none");
    expect(source).toContain("md:max-h-[calc(100dvh-96px)]");
    expect(css).toContain("touch-action: pan-y");
    expect(css).toContain("overscroll-behavior: contain");
  });

  it("supports pointer-drag on a dedicated handle for immersive summary panel", () => {
    const source = readFileSync(
      join(process.cwd(), "components/immersive-summary-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("summary-panel-drag-handle");
    expect(source).toContain("onPointerDown={startDrag}");
    expect(source).toContain("position: \"fixed\"");
    expect(source).not.toContain("setClampedPosition(clampPanelPosition({ x: rect.left, y: rect.top }))");
    expect(source).toContain("touch-none");
  });
});
