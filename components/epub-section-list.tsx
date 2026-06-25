"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sectionHasAnySummary } from "@/lib/section-summary-status";
import type { EpubSection, SectionSummary } from "@/lib/types";

type Props = {
  sections: EpubSection[];
  activeSectionId: string | null;
  summaries: Record<string, SectionSummary>;
  bookmarkedSectionIds?: string[];
  onSelectSection: (section: EpubSection) => void;
  className?: string;
};

export function EpubSectionList({
  sections,
  activeSectionId,
  summaries,
  bookmarkedSectionIds = [],
  onSelectSection,
  className,
}: Props) {
  const bookmarked = new Set(bookmarkedSectionIds);

  return (
    <ScrollArea className={`h-full px-4 pb-4 ${className ?? ""}`}>
      <ul className="space-y-1">
        {sections.map((section) => {
          const done = sectionHasAnySummary(section.id, summaries);
          const active = activeSectionId === section.id;
          const indent = Math.min(section.navLevel ?? 0, 4) * 12;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelectSection(section)}
                style={{ paddingLeft: `${8 + indent}px` }}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition sm:min-h-0 sm:items-start sm:py-1.5 ${
                  active
                    ? "bg-secondary/70 font-medium text-secondary-foreground shadow-sm shadow-black/[0.02]"
                    : "hover:bg-white/60"
                }`}
              >
                <span className="line-clamp-2 flex-1">{section.title}</span>
                {bookmarked.has(section.id) ? (
                  <Badge variant="outline" className="shrink-0 bg-white/55">
                    书签
                  </Badge>
                ) : null}
                {done ? (
                  <Badge variant="secondary" className="shrink-0">
                    已总结
                  </Badge>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
