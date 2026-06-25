"use client";

import { useState } from "react";
import type { EpubBlock } from "@/lib/types";

export function useReaderSectionState() {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sectionBlocks, setSectionBlocks] = useState<EpubBlock[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [scrollToBlockRequest, setScrollToBlockRequest] = useState<{
    blockId: string;
    nonce: number;
  } | null>(null);
  const [scrollTopRequest, setScrollTopRequest] = useState<{
    top: number;
    sectionId?: string;
    nonce: number;
  } | null>(null);
  const [highlightBlockIds, setHighlightBlockIds] = useState<string[]>([]);

  return {
    activeSectionId,
    setActiveSectionId,
    previewHtml,
    setPreviewHtml,
    sectionBlocks,
    setSectionBlocks,
    loadingPreview,
    setLoadingPreview,
    activeBlockId,
    setActiveBlockId,
    scrollToBlockRequest,
    setScrollToBlockRequest,
    scrollTopRequest,
    setScrollTopRequest,
    highlightBlockIds,
    setHighlightBlockIds,
  };
}
