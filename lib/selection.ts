import type { EpubBlock } from "@/lib/types";

export type ReaderBlockSelectionModifiers = {
  ctrlKey?: boolean;
  metaKey?: boolean;
};

export type ReaderBlockSelectionState = {
  selectedBlockIds: string[];
  anchorBlockId: string | null;
  activeBlockId: string | null;
};

export type ReaderBlockSelectionResult = ReaderBlockSelectionState & {
  clickedBlockId: string | null;
};

export type BoundaryRangeExpansionResult =
  | {
      ok: true;
      selectedBlockIds: string[];
      activeBlockId: string;
    }
  | {
      ok: false;
      selectedBlockIds: string[];
      activeBlockId: null;
    };

const SUMMARIZABLE_BLOCK_TYPES = new Set<EpubBlock["type"]>([
  "paragraph",
  "quote",
  "list_item",
  "code",
  "image_caption",
  "table",
]);

export function isSummarizableBlock(block: EpubBlock): boolean {
  return SUMMARIZABLE_BLOCK_TYPES.has(block.type);
}

export function orderedSummarizableBlockIds(blocks: EpubBlock[]): string[] {
  return blocks.filter(isSummarizableBlock).map((block) => block.id);
}

export function resolveSummarizableBlockId(
  blocks: EpubBlock[],
  blockId: string,
): string | null {
  const block = blocks.find((item) => item.id === blockId);
  if (!block) return null;
  if (isSummarizableBlock(block)) return blockId;

  const next = blocks.find(
    (item) => isSummarizableBlock(item) && item.index > block.index,
  );
  return next?.id ?? null;
}

export function computeReaderBlockSelection({
  blocks,
  clickedBlockId,
  currentSelectedBlockIds,
  anchorBlockId,
  modifiers,
}: {
  blocks: EpubBlock[];
  clickedBlockId: string;
  currentSelectedBlockIds: string[];
  anchorBlockId: string | null;
  modifiers?: ReaderBlockSelectionModifiers;
}): ReaderBlockSelectionResult {
  const orderedIds = orderedSummarizableBlockIds(blocks);
  const resolvedBlockId = resolveSummarizableBlockId(blocks, clickedBlockId);

  if (!resolvedBlockId) {
    return {
      selectedBlockIds: currentSelectedBlockIds,
      anchorBlockId,
      activeBlockId: null,
      clickedBlockId: null,
    };
  }

  if (modifiers?.ctrlKey || modifiers?.metaKey) {
    const selected = currentSelectedBlockIds.includes(resolvedBlockId)
      ? currentSelectedBlockIds.filter((id) => id !== resolvedBlockId)
      : [...currentSelectedBlockIds, resolvedBlockId];

    return {
      selectedBlockIds: selected.sort(
        (a, b) => orderedIds.indexOf(a) - orderedIds.indexOf(b),
      ),
      anchorBlockId: resolvedBlockId,
      activeBlockId: resolvedBlockId,
      clickedBlockId: resolvedBlockId,
    };
  }

  return {
    selectedBlockIds: [resolvedBlockId],
    anchorBlockId: resolvedBlockId,
    activeBlockId: resolvedBlockId,
    clickedBlockId: resolvedBlockId,
  };
}

export function expandSelectedBoundaryRange(
  blocks: EpubBlock[],
  selectedBlockIds: string[],
): BoundaryRangeExpansionResult {
  if (selectedBlockIds.length !== 2) {
    return {
      ok: false,
      selectedBlockIds,
      activeBlockId: null,
    };
  }

  const orderedIds = orderedSummarizableBlockIds(blocks);
  const start = orderedIds.indexOf(selectedBlockIds[0]);
  const end = orderedIds.indexOf(selectedBlockIds[1]);
  if (start < 0 || end < 0) {
    return {
      ok: false,
      selectedBlockIds,
      activeBlockId: null,
    };
  }

  const [from, to] = start <= end ? [start, end] : [end, start];
  return {
    ok: true,
    selectedBlockIds: orderedIds.slice(from, to + 1),
    activeBlockId: selectedBlockIds[1],
  };
}

export function selectionAnchorLabel(
  blocks: EpubBlock[],
  anchorBlockId: string | null,
): string | null {
  if (!anchorBlockId) return null;
  const block = blocks.find((item) => item.id === anchorBlockId);
  if (!block) return null;
  const compact = block.text.replace(/\s+/g, " ").trim();
  if (!compact) return `第 ${block.index + 1} 段`;
  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact;
}
