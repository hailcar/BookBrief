"use client";

import { useCallback, useMemo, useState } from "react";
import {
  selectionAnchorLabel,
  type ReaderBlockSelectionState,
} from "@/lib/selection";
import type { EpubBlock, SelectedBlocksSummaryResult } from "@/lib/types";

export function useSelectedSummaryState(sectionBlocks: EpubBlock[]) {
  const [selection, setSelection] = useState<ReaderBlockSelectionState>({
    selectedBlockIds: [],
    anchorBlockId: null,
    activeBlockId: null,
  });
  const [summarizingSelectedBlocks, setSummarizingSelectedBlocks] =
    useState(false);
  const [selectedSummaryProgressText, setSelectedSummaryProgressText] =
    useState<string | null>(null);
  const [selectedSummaryResult, setSelectedSummaryResult] =
    useState<SelectedBlocksSummaryResult | null>(null);
  const [selectedSummaryError, setSelectedSummaryError] =
    useState<string | null>(null);

  const clearSelectedSummary = useCallback(() => {
    setSelection({
      selectedBlockIds: [],
      anchorBlockId: null,
      activeBlockId: null,
    });
    setSelectedSummaryError(null);
    setSelectedSummaryResult(null);
    setSelectedSummaryProgressText(null);
  }, []);

  const anchorLabel = useMemo(
    () => selectionAnchorLabel(sectionBlocks, selection.anchorBlockId),
    [sectionBlocks, selection.anchorBlockId],
  );

  return {
    selectedBlockIds: selection.selectedBlockIds,
    selectionAnchorBlockId: selection.anchorBlockId,
    selectionAnchorLabel: anchorLabel,
    selectedActiveBlockId: selection.activeBlockId,
    setSelection,
    clearSelectedSummary,
    summarizingSelectedBlocks,
    setSummarizingSelectedBlocks,
    selectedSummaryProgressText,
    setSelectedSummaryProgressText,
    selectedSummaryResult,
    setSelectedSummaryResult,
    selectedSummaryError,
    setSelectedSummaryError,
  };
}
