import { describe, expect, it } from "vitest";
import {
  applyHeadingSummaryOptions,
  DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT,
} from "@/lib/summary-prompt";

describe("applyHeadingSummaryOptions", () => {
  it("returns base prompt when options omitted", () => {
    expect(applyHeadingSummaryOptions(DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT)).toBe(
      DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT,
    );
  });

  it("appends option instructions when set", () => {
    const out = applyHeadingSummaryOptions(DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT, {
      summaryStyle: "must_remember_points",
      removeRedundancy: true,
      makeImplicitMeaningExplicit: true,
    });
    expect(out).toContain("Request options:");
    expect(out).toContain("must_remember_points");
    expect(out).toContain("Remove redundancy");
    expect(out).toContain("Make implicit meaning explicit");
  });
});