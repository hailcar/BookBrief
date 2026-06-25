import { describe, expect, it } from "vitest";
import { sectionHasAnySummary } from "@/lib/section-summary-status";

describe("sectionHasAnySummary", () => {
  it("true for chapter-level cache", () => {
    expect(
      sectionHasAnySummary("sec1", {
        sec1: {
          sectionId: "sec1",
          summary: "x",
          updatedAt: 1,
          mode: "paragraph",
        },
      }),
    ).toBe(true);
  });

  it("true for heading cache key", () => {
    expect(
      sectionHasAnySummary("sec1", {
        "sec1::h::blk-3": {
          sectionId: "sec1",
          summary: "x",
          updatedAt: 1,
          mode: "heading_section_summary",
        },
      }),
    ).toBe(true);
  });

  it("true for selected block cache key", () => {
    expect(
      sectionHasAnySummary("sec1", {
        "selected::sec1::p1": {
          sectionId: "sec1",
          blockIds: ["p1"],
          sourceText: "a",
          summary: "x",
          updatedAt: 1,
          summaryKey: "selected::sec1::p1",
          pageId: "p1",
          startBlockId: "p1",
          scopeType: "selected_blocks",
        },
      }),
    ).toBe(true);
  });

  it("false when other section", () => {
    expect(sectionHasAnySummary("sec1", {})).toBe(false);
  });
});
