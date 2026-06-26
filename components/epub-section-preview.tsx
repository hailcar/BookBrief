"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dispatchReaderViewportRelayout } from "@/hooks/use-reader-fullscreen";
import {
  applyEpubDisplayMode,
  type EpubDisplayMode,
  type EpubReaderLayout,
} from "@/lib/epub-display";
import {
  installHeadingInteractionRuntime,
  type HeadingInteractionBridge,
  type HeadingInteractionMessage,
} from "@/lib/epub/heading-interaction";
import type { ReaderSettings } from "@/lib/reader-settings";
import type {
  EpubComment,
  InlineSummaryActionState,
  InlineSummaryBubble,
} from "@/lib/types";

type Props = {
  html: string;
  title?: string;
  displayMode: EpubDisplayMode;
  readerSettings: ReaderSettings;
  layout?: EpubReaderLayout;
  sectionId?: string | null;
  className?: string;
  highlightBlockIds?: string[];
  activeBlockId?: string | null;
  summarizedBlockIds?: string[];
  selectedBlockIds?: string[];
  comments?: EpubComment[];
  scrollToBlockRequest?: { blockId: string; nonce: number } | null;
  scrollTopRequest?: { top: number; sectionId?: string; nonce: number } | null;
  inlineSummaryBubbles?: InlineSummaryBubble[];
  inlineSummaryAction?: InlineSummaryActionState;
  activeSummaryId?: string | null;
  onSummarizeHeading?: (headingBlockId: string) => void;
  onHeadingVisible?: (headingBlockId: string) => void;
  onReaderBlockClick?: (
    blockId: string,
    modifiers?: { ctrlKey?: boolean; metaKey?: boolean },
  ) => void;
  onClearSelection?: () => void;
  onSummarizeSelection?: () => void;
  onCommentTextSelection?: (selection: {
    text: string;
    blockIds: string[];
    fragments?: { blockId: string; text: string }[];
  }) => void;
  onTranslateTextSelection?: (selection: {
    text: string;
    blockIds: string[];
    fragments?: { blockId: string; text: string }[];
  }) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onActivateSummary?: (summaryId: string) => void;
  onDeleteActiveSummary?: () => void;
  onReaderWindowSectionChange?: (sectionId: string, offset: number) => void;
};

type FrameSlot = 0 | 1;
type ScrollTopRequest = NonNullable<Props["scrollTopRequest"]>;
type ReaderWindowRestoreGuard = {
  sectionId: string;
  top: number;
  nonce: number;
  expiresAt: number;
};

const FRAME_FADE_MS = 180;
const READER_WINDOW_RESTORE_GUARD_MS = 1400;
const READER_WINDOW_RESTORE_OFFSET_TOLERANCE = 180;

function relayoutIframeDocument(
  iframe: HTMLIFrameElement | null,
  publisherScale: boolean,
): void {
  if (!iframe) return;
  try {
    const win = iframe.contentWindow;
    const doc = win?.document;
    const root = doc?.getElementById("summary-epub-root");
    if (root) {
      root.style.transform = "";
      root.style.width = "";
      root.style.marginBottom = "";
      if (publisherScale && win) {
        const docWidth = root.scrollWidth;
        const viewWidth = win.innerWidth || docWidth;
        if (docWidth > viewWidth + 4) {
          const scale = Math.max(0.35, Math.min(1, viewWidth / docWidth));
          root.style.transform = `scale(${scale})`;
          root.style.width = `${docWidth}px`;
          const rect = root.getBoundingClientRect();
          root.style.marginBottom = `${rect.height * (scale - 1)}px`;
        }
      }
    }
    win?.dispatchEvent(new Event("resize"));
  } catch {
    /* sandbox */
  }
}

function scrollIframeTo(
  iframe: HTMLIFrameElement | null,
  top: number,
): void {
  if (!iframe) return;
  try {
    iframe.contentWindow?.scrollTo(0, Math.max(0, top));
  } catch {
    /* sandbox */
  }
}

function scrollIframeToRequest(
  iframe: HTMLIFrameElement | null,
  request: ScrollTopRequest | null | undefined,
): void {
  if (!request?.sectionId) {
    scrollIframeTo(iframe, request?.top ?? 0);
    return;
  }
  if (!iframe?.contentWindow?.document) return;
  try {
    const doc = iframe.contentWindow.document;
    const target = Array.from(
      doc.querySelectorAll<HTMLElement>("[data-reader-window-section-id]"),
    ).find(
      (item) =>
        item.getAttribute("data-reader-window-section-id") ===
        request.sectionId,
    );
    if (!target) {
      scrollIframeTo(iframe, request.top);
      return;
    }
    const currentTop =
      iframe.contentWindow.scrollY ||
      doc.documentElement.scrollTop ||
      doc.body.scrollTop ||
      0;
    const targetTop = target.getBoundingClientRect().top + currentTop;
    scrollIframeTo(iframe, targetTop + request.top);
  } catch {
    scrollIframeTo(iframe, request.top);
  }
}

export function EpubSectionPreview({
  html,
  title,
  displayMode,
  readerSettings,
  layout = "embedded",
  sectionId,
  className,
  highlightBlockIds,
  activeBlockId,
  summarizedBlockIds,
  selectedBlockIds,
  comments,
  scrollToBlockRequest,
  scrollTopRequest,
  inlineSummaryBubbles,
  inlineSummaryAction,
  activeSummaryId,
  onSummarizeHeading,
  onHeadingVisible,
  onReaderBlockClick,
  onClearSelection,
  onSummarizeSelection,
  onCommentTextSelection,
  onTranslateTextSelection,
  onDeleteAnnotation,
  onActivateSummary,
  onDeleteActiveSummary,
  onReaderWindowSectionChange,
}: Props) {
  const firstIframeRef = useRef<HTMLIFrameElement>(null);
  const secondIframeRef = useRef<HTMLIFrameElement>(null);
  const activeSlotRef = useRef<FrameSlot>(0);
  const interactionBridgesRef = useRef(new WeakMap<HTMLIFrameElement, HeadingInteractionBridge>());
  const pendingScrollRequestRef = useRef<ScrollTopRequest | null>(null);
  const readerWindowRestoreGuardRef =
    useRef<ReaderWindowRestoreGuard | null>(null);
  const readerWindowRestoreGuardTimerRef = useRef<number | null>(null);
  const [activeSlot, setActiveSlot] = useState<FrameSlot>(0);
  const [loadingSlot, setLoadingSlot] = useState<FrameSlot | null>(null);
  const [retiringSlot, setRetiringSlot] = useState<FrameSlot | null>(null);
  const retireTimerRef = useRef<number | null>(null);
  const highlightKey = useMemo(
    () => (highlightBlockIds ?? []).join("\u0000"),
    [highlightBlockIds],
  );
  const stableHighlightIds = useMemo(() => {
    if (!highlightKey) return [];
    return highlightKey.split("\u0000");
  }, [highlightKey]);

  const onSummarizeHeadingStable = useCallback(
    (blockId: string) => {
      onSummarizeHeading?.(blockId);
    },
    [onSummarizeHeading],
  );

  const onHeadingVisibleStable = useCallback(
    (blockId: string) => {
      onHeadingVisible?.(blockId);
    },
    [onHeadingVisible],
  );
  const onReaderBlockClickStable = useCallback(
    (
      blockId: string,
      modifiers?: { ctrlKey?: boolean; metaKey?: boolean },
    ) => {
      onReaderBlockClick?.(blockId, modifiers);
    },
    [onReaderBlockClick],
  );
  const onClearSelectionStable = useCallback(() => {
    onClearSelection?.();
  }, [onClearSelection]);

  const srcDoc = useMemo(
    () => applyEpubDisplayMode(html, displayMode, readerSettings, layout),
    [html, displayMode, readerSettings, layout],
  );
  const [frameDocs, setFrameDocs] = useState<[string | null, string | null]>([
    srcDoc,
    null,
  ]);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  const iframeForSlot = useCallback((slot: FrameSlot) => {
    return slot === 0 ? firstIframeRef.current : secondIframeRef.current;
  }, []);

  const clearReaderWindowRestoreGuard = useCallback(() => {
    readerWindowRestoreGuardRef.current = null;
    if (readerWindowRestoreGuardTimerRef.current !== null) {
      window.clearTimeout(readerWindowRestoreGuardTimerRef.current);
      readerWindowRestoreGuardTimerRef.current = null;
    }
  }, []);

  const armReaderWindowRestoreGuard = useCallback(
    (request: ScrollTopRequest | null | undefined) => {
      if (!request?.sectionId) return;
      const guard: ReaderWindowRestoreGuard = {
        sectionId: request.sectionId,
        top: Math.max(0, request.top),
        nonce: request.nonce,
        expiresAt: Date.now() + READER_WINDOW_RESTORE_GUARD_MS,
      };
      readerWindowRestoreGuardRef.current = guard;
      if (readerWindowRestoreGuardTimerRef.current !== null) {
        window.clearTimeout(readerWindowRestoreGuardTimerRef.current);
      }
      readerWindowRestoreGuardTimerRef.current = window.setTimeout(() => {
        if (readerWindowRestoreGuardRef.current?.nonce === guard.nonce) {
          readerWindowRestoreGuardRef.current = null;
        }
        readerWindowRestoreGuardTimerRef.current = null;
      }, READER_WINDOW_RESTORE_GUARD_MS);
    },
    [],
  );

  const shouldIgnoreReaderWindowSectionChange = useCallback(
    (reportedSectionId: string, reportedOffset: number) => {
      const guard = readerWindowRestoreGuardRef.current;
      if (!guard) return false;
      if (Date.now() > guard.expiresAt) {
        clearReaderWindowRestoreGuard();
        return false;
      }

      if (reportedSectionId !== guard.sectionId) return true;
      const offsetDelta = Math.abs(Math.max(0, reportedOffset) - guard.top);
      if (offsetDelta > READER_WINDOW_RESTORE_OFFSET_TOLERANCE) return true;

      clearReaderWindowRestoreGuard();
      return false;
    },
    [clearReaderWindowRestoreGuard],
  );

  const activateSlot = useCallback(
    (slot: FrameSlot) => {
      if (slot !== activeSlot) {
        setRetiringSlot(activeSlot);
      }
      setActiveSlot(slot);
      setLoadingSlot(null);

      if (retireTimerRef.current !== null) {
        window.clearTimeout(retireTimerRef.current);
      }
      retireTimerRef.current = window.setTimeout(() => {
        setRetiringSlot(null);
        retireTimerRef.current = null;
      }, FRAME_FADE_MS);
    },
    [activeSlot],
  );

  const sendToFrame = useCallback(
    (
      iframe: HTMLIFrameElement | null,
      payload: HeadingInteractionMessage,
    ) => {
      if (!iframe) return;
      interactionBridgesRef.current.get(iframe)?.receive?.({ data: payload });
    },
    [],
  );

  const hydrateFrame = useCallback(
    (slot: FrameSlot, request: ScrollTopRequest | null | undefined) => {
      const el = iframeForSlot(slot);
      if (!el) return;
      armReaderWindowRestoreGuard(request);
      scrollIframeToRequest(el, request);
      requestAnimationFrame(() => scrollIframeToRequest(el, request));
      window.setTimeout(() => scrollIframeToRequest(el, request), 80);
      relayoutIframeDocument(el, displayMode === "publisher");
      if (stableHighlightIds.length) {
        sendToFrame(el, {
          type: "summary-epub-highlight-blocks",
          blockIds: stableHighlightIds,
          activeBlockId,
        });
      }
      sendToFrame(el, {
        type: "summary-epub-mark-summarized-blocks",
        blockIds: summarizedBlockIds ?? [],
      });
      sendToFrame(el, {
        type: "summary-epub-mark-selected-blocks",
        blockIds: selectedBlockIds ?? [],
      });
      sendToFrame(el, {
        type: "summary-epub-render-inline-bubbles",
        bubbles: inlineSummaryBubbles ?? [],
        activeSummaryId,
      });
      sendToFrame(el, {
        type: "summary-epub-render-selection-action",
        action: inlineSummaryAction ?? null,
      });
      sendToFrame(el, {
        type: "summary-epub-render-comments",
        comments: comments ?? [],
      });
    },
    [
      activeBlockId,
      activeSummaryId,
      armReaderWindowRestoreGuard,
      displayMode,
      iframeForSlot,
      inlineSummaryAction,
      inlineSummaryBubbles,
      comments,
      sendToFrame,
      selectedBlockIds,
      stableHighlightIds,
      summarizedBlockIds,
    ],
  );

  const handleReaderMessage = useCallback((data: HeadingInteractionMessage) => {
    if (
      data?.type === "summary-epub-summarize-heading" &&
      typeof data.blockId === "string"
    ) {
      onSummarizeHeadingStable(data.blockId);
      return;
    }
    if (
      data?.type === "summary-epub-heading-visible" &&
      typeof data.blockId === "string"
    ) {
      onHeadingVisibleStable(data.blockId);
      return;
    }
    if (
      data?.type === "summary-epub-reader-block-click" &&
      typeof data.blockId === "string"
    ) {
      onReaderBlockClickStable(data.blockId, {
        ctrlKey: data.ctrlKey === true,
        metaKey: data.metaKey === true,
      });
      return;
    }
    if (data?.type === "summary-epub-summarize-selection") {
      onSummarizeSelection?.();
      return;
    }
    if (data?.type === "summary-epub-clear-reader-selection") {
      onClearSelectionStable();
      return;
    }
    if (
      (data?.type === "summary-epub-comment-text-selection" ||
        data?.type === "summary-epub-translate-text-selection") &&
      typeof data.text === "string" &&
      Array.isArray(data.blockIds)
    ) {
      const selection = {
        text: data.text,
        blockIds: data.blockIds.filter(
          (blockId): blockId is string => typeof blockId === "string",
        ),
        fragments: Array.isArray(data.fragments)
          ? data.fragments.filter(
              (
                fragment: unknown,
              ): fragment is { blockId: string; text: string } =>
                typeof fragment === "object" &&
                fragment !== null &&
                "blockId" in fragment &&
                "text" in fragment &&
                typeof fragment.blockId === "string" &&
                typeof fragment.text === "string",
            )
          : undefined,
      };
      if (data.type === "summary-epub-translate-text-selection") {
        onTranslateTextSelection?.(selection);
      } else {
        onCommentTextSelection?.(selection);
      }
      return;
    }
    if (
      data?.type === "summary-epub-delete-annotation" &&
      typeof data.annotationId === "string"
    ) {
      onDeleteAnnotation?.(data.annotationId);
      return;
    }
    if (
      data?.type === "summary-epub-activate-summary" &&
      typeof data.summaryId === "string"
    ) {
      onActivateSummary?.(data.summaryId);
      return;
    }
    if (data?.type === "summary-epub-delete-active-summary") {
      onDeleteActiveSummary?.();
      return;
    }
    if (
      data?.type === "summary-epub-reader-window-active-section" &&
      typeof data.sectionId === "string"
    ) {
      const offset = typeof data.offset === "number" ? data.offset : 0;
      if (shouldIgnoreReaderWindowSectionChange(data.sectionId, offset)) {
        return;
      }
      onReaderWindowSectionChange?.(data.sectionId, offset);
    }
  }, [
    onHeadingVisibleStable,
    onActivateSummary,
    onDeleteActiveSummary,
    onCommentTextSelection,
    onTranslateTextSelection,
    onDeleteAnnotation,
    onClearSelectionStable,
    onReaderBlockClickStable,
    onSummarizeSelection,
    onSummarizeHeadingStable,
    onReaderWindowSectionChange,
    shouldIgnoreReaderWindowSectionChange,
  ]);

  const installFrameInteraction = useCallback(
    (slot: FrameSlot) => {
      const iframe = iframeForSlot(slot);
      const win = iframe?.contentWindow;
      const doc = win?.document;
      if (!iframe || !win || !doc) return;
      if (
        doc.documentElement?.getAttribute("data-summary-epub-runtime") ===
          "ready" &&
        interactionBridgesRef.current.has(iframe)
      ) {
        return;
      }

      const bridge: HeadingInteractionBridge = {
        postToParent: (payload) => {
          if (iframeForSlot(activeSlotRef.current) !== iframe) return;
          handleReaderMessage(payload);
        },
      };
      interactionBridgesRef.current.set(iframe, bridge);
      installHeadingInteractionRuntime(win, doc, bridge);
    },
    [handleReaderMessage, iframeForSlot],
  );

  useEffect(() => {
    if (srcDoc === frameDocs[activeSlot]) return;
    const nextSlot: FrameSlot = activeSlot === 0 ? 1 : 0;
    const scrollRequest = scrollTopRequest ?? { top: 0, nonce: Date.now() };
    pendingScrollRequestRef.current = scrollRequest;

    if (frameDocs[nextSlot] === srcDoc) {
      if (loadingSlot === nextSlot) return;
      requestAnimationFrame(() => {
        hydrateFrame(nextSlot, scrollRequest);
        activateSlot(nextSlot);
      });
      return;
    }

    const raf = requestAnimationFrame(() => {
      setFrameDocs((current) => {
        const next: [string | null, string | null] = [...current];
        next[nextSlot] = srcDoc;
        return next;
      });
      setLoadingSlot(nextSlot);
    });
    return () => cancelAnimationFrame(raf);
  }, [
    activeSlot,
    activateSlot,
    frameDocs,
    hydrateFrame,
    loadingSlot,
    scrollTopRequest,
    srcDoc,
  ]);

  const onFrameLoad = useCallback(
    (slot: FrameSlot) => {
      const requestedTop =
        slot === loadingSlot
          ? pendingScrollRequestRef.current
          : slot === activeSlot
            ? scrollTopRequest
            : null;
      installFrameInteraction(slot);
      hydrateFrame(slot, requestedTop);
      if (slot === loadingSlot && frameDocs[slot] === srcDoc) {
        requestAnimationFrame(() => {
          activateSlot(slot);
        });
      }
    },
    [
      activeSlot,
      activateSlot,
      frameDocs,
      hydrateFrame,
      installFrameInteraction,
      loadingSlot,
      scrollTopRequest,
      srcDoc,
    ],
  );

  useEffect(() => {
    const iframe = iframeForSlot(activeSlot);
    const doc = iframe?.contentWindow?.document;
    if (!iframe || !doc || doc.readyState === "loading") return;
    installFrameInteraction(activeSlot);
    hydrateFrame(activeSlot, scrollTopRequest);
  }, [
    activeSlot,
    frameDocs,
    hydrateFrame,
    iframeForSlot,
    installFrameInteraction,
    scrollTopRequest,
  ]);

  useEffect(() => {
    return () => {
      if (retireTimerRef.current !== null) {
        window.clearTimeout(retireTimerRef.current);
      }
      clearReaderWindowRestoreGuard();
    };
  }, [clearReaderWindowRestoreGuard]);

  useEffect(() => {
    if (!scrollTopRequest) return;
    armReaderWindowRestoreGuard(scrollTopRequest);
    scrollIframeToRequest(iframeForSlot(activeSlot), scrollTopRequest);
  }, [activeSlot, armReaderWindowRestoreGuard, iframeForSlot, scrollTopRequest]);

  useEffect(() => {
    sendToFrame(iframeForSlot(activeSlot), {
      type: stableHighlightIds.length
        ? "summary-epub-highlight-blocks"
        : "summary-epub-clear-highlight",
      blockIds: stableHighlightIds,
      activeBlockId,
    });
  }, [activeSlot, iframeForSlot, sendToFrame, stableHighlightIds, activeBlockId]);

  useEffect(() => {
    sendToFrame(iframeForSlot(activeSlot), {
      type: "summary-epub-mark-summarized-blocks",
      blockIds: summarizedBlockIds ?? [],
    });
  }, [activeSlot, iframeForSlot, sendToFrame, summarizedBlockIds]);

  useEffect(() => {
    sendToFrame(iframeForSlot(activeSlot), {
      type: "summary-epub-mark-selected-blocks",
      blockIds: selectedBlockIds ?? [],
    });
  }, [activeSlot, iframeForSlot, sendToFrame, selectedBlockIds]);

  useEffect(() => {
    if (!scrollToBlockRequest) return;
    sendToFrame(iframeForSlot(activeSlot), {
      type: "summary-epub-scroll-to-block",
      blockId: scrollToBlockRequest.blockId,
    });
  }, [activeSlot, iframeForSlot, sendToFrame, scrollToBlockRequest]);

  useEffect(() => {
    sendToFrame(iframeForSlot(activeSlot), {
      type: "summary-epub-render-inline-bubbles",
      bubbles: inlineSummaryBubbles ?? [],
      activeSummaryId,
    });
  }, [activeSlot, iframeForSlot, sendToFrame, inlineSummaryBubbles, activeSummaryId]);

  useEffect(() => {
    sendToFrame(iframeForSlot(activeSlot), {
      type: "summary-epub-render-selection-action",
      action: inlineSummaryAction ?? null,
    });
  }, [activeSlot, iframeForSlot, sendToFrame, inlineSummaryAction]);

  useEffect(() => {
    sendToFrame(iframeForSlot(activeSlot), {
      type: "summary-epub-render-comments",
      comments: comments ?? [],
    });
  }, [activeSlot, iframeForSlot, sendToFrame, comments]);

  useEffect(() => {
    if (layout !== "fullscreen") return;
    const el = iframeForSlot(activeSlot);
    relayoutIframeDocument(el, displayMode === "publisher");
    dispatchReaderViewportRelayout();
    const raf = requestAnimationFrame(() =>
      relayoutIframeDocument(el, displayMode === "publisher"),
    );
    const t1 = window.setTimeout(
      () => relayoutIframeDocument(el, displayMode === "publisher"),
      120,
    );
    const t2 = window.setTimeout(
      () => relayoutIframeDocument(el, displayMode === "publisher"),
      400,
    );
    const onResize = () =>
      relayoutIframeDocument(
        iframeForSlot(activeSlot),
        displayMode === "publisher",
      );
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [activeSlot, displayMode, iframeForSlot, layout, sectionId, srcDoc]);

  const wrapClass =
    layout === "fullscreen"
      ? "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#e7e2d8]"
      : "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200/80 bg-gradient-to-b from-stone-200/50 to-stone-300/40 p-1 shadow-inner dark:border-stone-700/60 dark:from-stone-900/50 dark:to-stone-950/60";

  const frameClass =
    layout === "fullscreen"
      ? "h-full min-h-0 w-full flex-1 rounded-none border-0 bg-[#e7e2d8]"
      : "h-full min-h-0 w-full flex-1 rounded-lg bg-[#e7e2d8] shadow-sm";

  const renderFrame = (slot: FrameSlot, doc: string | null) => {
    if (!doc) return null;
    const active = slot === activeSlot;
    const retiring = slot === retiringSlot;
    return (
      <iframe
        ref={slot === 0 ? firstIframeRef : secondIframeRef}
        data-reader-frame-slot={slot}
        data-reader-frame-active={active ? "true" : "false"}
        data-reader-frame-loading={slot === loadingSlot ? "true" : "false"}
        data-reader-frame-retiring={retiring ? "true" : "false"}
        title={title ?? "Document section preview"}
        className={`absolute inset-0 block border-0 transition-opacity duration-200 ease-out will-change-[opacity] ${
          active
            ? "z-20 opacity-100"
            : retiring
              ? "pointer-events-none z-10 opacity-100"
              : "pointer-events-none z-0 opacity-0"
        } ${frameClass}`}
        sandbox="allow-same-origin"
        srcDoc={doc}
        onLoad={() => onFrameLoad(slot)}
      />
    );
  };

  return (
    <div className={`${wrapClass} ${className ?? ""}`}>
      <div className="relative h-full min-h-0 w-full flex-1">
        {renderFrame(0, frameDocs[0])}
        {renderFrame(1, frameDocs[1])}
      </div>
    </div>
  );
}
