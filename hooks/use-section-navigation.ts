"use client";

import { useCallback, useMemo } from "react";
import type { EpubSection } from "@/lib/types";

export function useSectionNavigation(
  sections: EpubSection[] | undefined,
  activeSectionId: string | null,
) {
  const index = useMemo(() => {
    if (!sections?.length || !activeSectionId) return -1;
    return sections.findIndex((s) => s.id === activeSectionId);
  }, [sections, activeSectionId]);

  const prev = index > 0 ? sections![index - 1] : null;
  const next =
    sections && index >= 0 && index < sections.length - 1
      ? sections[index + 1]
      : null;

  const positionLabel =
    sections?.length && index >= 0
      ? `${index + 1} / ${sections.length}`
      : null;

  const goPrev = useCallback(
    (onSelect: (s: EpubSection) => void) => {
      if (prev) onSelect(prev);
    },
    [prev],
  );

  const goNext = useCallback(
    (onSelect: (s: EpubSection) => void) => {
      if (next) onSelect(next);
    },
    [next],
  );

  return { prev, next, index, positionLabel, goPrev, goNext };
}