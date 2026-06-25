import type { SectionSummary } from "@/lib/types";

/** True if section/page has paragraph-mode summary, heading summary, or anchored selected summary. */
export function sectionHasAnySummary(
  sectionId: string,
  summaries: Record<string, SectionSummary>,
): boolean {
  if (summaries[sectionId]) return true;
  const prefix = `${sectionId}::h::`;
  const selectedPrefix = `selected::${sectionId}::`;
  return Object.keys(summaries).some(
    (key) =>
      (key.startsWith(prefix) && summaries[key]?.mode === "heading_section_summary") ||
      key.startsWith(selectedPrefix),
  );
}
