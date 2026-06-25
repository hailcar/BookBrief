import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ReaderSummaryPane", () => {
  it("uses the polished summary scroll container for AI summary content", () => {
    const source = readFileSync(
      join(process.cwd(), "components/reader-summary-pane.tsx"),
      "utf8",
    );

    expect(source).toContain("summary-scroll");
    expect(source).toContain("summary-markdown");
    expect(source).toContain("touch-pan-y");
    expect(source).toContain("overscroll-contain");
    expect(source).not.toContain("shadow-inner");
  });
});
