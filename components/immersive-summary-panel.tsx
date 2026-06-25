"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { SummaryMarkdown } from "@/components/summary-markdown";
import { Button } from "@/components/ui/button";
import {
  getBrowserStorageItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";
import type { InlineSummaryBubble, SectionSummary } from "@/lib/types";

type Props = {
  sectionTitle: string;
  summaryText: string;
  summary?: SectionSummary | null;
  isSummaryPlaceholder?: boolean;
  summaries: InlineSummaryBubble[];
  activeSummaryId?: string | null;
  summarizing: boolean;
  summarizeDisabled: boolean;
  selectedBlockCount?: number;
  selectionAnchorLabel?: string | null;
  summaryQueueLabel?: string;
  summaryQueuePaused?: boolean;
  onSummarizeCurrent: () => void;
  onClearSelection?: () => void;
  onExpandSelectionRange?: () => void;
  expandSelectionRangeDisabled?: boolean;
  onDeleteSummary?: () => void;
  deleteSummaryDisabled?: boolean;
  onSelectSummary?: (summaryId: string) => void;
  onPauseSummaryQueue?: () => void;
  onResumeSummaryQueue?: () => void;
};

const DRAG_HANDLE_CLASS = "summary-panel-drag-handle";
const PANEL_STATE_KEY = "summary_epub_immersive_summary_panel";
const EDGE_GUARD = 12;
const DRAG_MOVE_THRESHOLD = 4;

type PanelPoint = {
  x: number;
  y: number;
};

type DragPointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  startPanelX: number;
  startPanelY: number;
  suppressClickOnDrag: boolean;
  moved: boolean;
};

type PersistedPanelState = {
  open: boolean;
  position: PanelPoint | null;
  scrollTop: number;
};

const DEFAULT_PANEL_STATE: PersistedPanelState = {
  open: false,
  position: null,
  scrollTop: 0,
};

function validPanelPoint(value: unknown): PanelPoint | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<PanelPoint>;
  if (
    typeof point.x !== "number" ||
    typeof point.y !== "number" ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return null;
  }
  return {
    x: point.x,
    y: point.y,
  };
}

function loadPersistedPanelState(): PersistedPanelState {
  try {
    const raw = getBrowserStorageItem(PANEL_STATE_KEY);
    if (!raw) return DEFAULT_PANEL_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedPanelState>;
    return {
      open: parsed.open === true,
      position: validPanelPoint(parsed.position),
      scrollTop:
        typeof parsed.scrollTop === "number" &&
        Number.isFinite(parsed.scrollTop) &&
        parsed.scrollTop > 0
          ? parsed.scrollTop
          : 0,
    };
  } catch {
    return DEFAULT_PANEL_STATE;
  }
}

function savePersistedPanelState(state: PersistedPanelState): void {
  setBrowserStorageItem(PANEL_STATE_KEY, JSON.stringify(state));
}

function setPointerCaptureIfPossible(element: HTMLElement | null, pointerId: number) {
  try {
    element?.setPointerCapture?.(pointerId);
  } catch {
    // Synthetic pointer events do not always create an active pointer capture target.
  }
}

function releasePointerCaptureIfPossible(
  element: HTMLElement | null,
  pointerId: number,
) {
  try {
    if (element?.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // Ignore stale pointer ids from cancelled or synthetic drag sequences.
  }
}

function summaryStatusLabel({
  isSummaryPlaceholder,
  summarizing,
  summary,
  summaries,
}: {
  isSummaryPlaceholder?: boolean;
  summarizing: boolean;
  summary?: SectionSummary | null;
  summaries: InlineSummaryBubble[];
}) {
  if (summarizing) return "总结中";
  if (summary?.status === "cached" || summaries.some((s) => s.status === "cached")) {
    return "使用缓存";
  }
  if (!isSummaryPlaceholder || summaries.length > 0) return "已总结";
  return "未总结";
}

export function ImmersiveSummaryPanel({
  sectionTitle,
  summaryText,
  summary,
  isSummaryPlaceholder,
  summaries,
  activeSummaryId,
  summarizing,
  summarizeDisabled,
  selectedBlockCount = 0,
  selectionAnchorLabel,
  summaryQueueLabel,
  summaryQueuePaused = false,
  onSummarizeCurrent,
  onClearSelection,
  onExpandSelectionRange,
  expandSelectionRangeDisabled = true,
  onDeleteSummary,
  deleteSummaryDisabled = true,
  onSelectSummary,
  onPauseSummaryQueue,
  onResumeSummaryQueue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragPointerState | null>(null);
  const suppressNextCollapsedClickRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelStateRef = useRef<PersistedPanelState>(DEFAULT_PANEL_STATE);
  const pendingScrollTopRef = useRef<number | null>(null);
  const [panelStateRestored, setPanelStateRestored] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(["chapter"]),
  );

  const status = summaryStatusLabel({
    isSummaryPlaceholder,
    summarizing,
    summary,
    summaries,
  });

  const items = useMemo(() => {
    const list = summaries.map((item, index) => ({
      id: item.summaryId ?? item.blockId,
      summaryId: item.summaryId,
      title: item.headingText || item.label || `标题总结 ${index + 1}`,
      content: item.summary,
      status: item.status,
    }));
    const hasPrimarySummary =
      summaryText.trim() &&
      (!summary || summary.mode !== "heading_section_summary");
    const primaryTitle = "所选段落总结";
    if (!isSummaryPlaceholder && hasPrimarySummary) {
      return [
        {
          id: "chapter",
          summaryId: activeSummaryId ?? summary?.sectionId,
          title: primaryTitle,
          content: summaryText,
          status: summary?.status ?? "success",
        },
        ...list,
      ];
    }
    if (summarizing && hasPrimarySummary) {
      return [
        {
          id: "chapter",
          summaryId: activeSummaryId ?? summary?.sectionId,
          title: primaryTitle,
          content: summaryText,
          status: "loading",
        },
        ...list,
      ];
    }
    return list;
  }, [
    activeSummaryId,
    isSummaryPlaceholder,
    summaries,
    summarizing,
    summary,
    summaryText,
  ]);

  const clampPanelPosition = useCallback((nextPosition: PanelPoint): PanelPoint => {
    if (typeof window === "undefined") return nextPosition;

    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return nextPosition;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const maxX = Math.max(
      EDGE_GUARD,
      viewportWidth - rect.width - EDGE_GUARD,
    );
    const minX = Math.min(
      EDGE_GUARD,
      viewportWidth - rect.width - EDGE_GUARD,
    );
    const maxY = Math.max(
      EDGE_GUARD,
      viewportHeight - rect.height - EDGE_GUARD,
    );
    const minY = Math.min(
      EDGE_GUARD,
      viewportHeight - rect.height - EDGE_GUARD,
    );

    return {
      x: Math.max(minX, Math.min(nextPosition.x, maxX)),
      y: Math.max(minY, Math.min(nextPosition.y, maxY)),
    };
  }, []);

  const setClampedPosition = useCallback(
    (nextPosition: PanelPoint) => {
      const clampedPosition = clampPanelPosition(nextPosition);
      setPosition(clampedPosition);
    },
    [clampPanelPosition],
  );

  const persistPanelState = useCallback(
    (nextState: Partial<PersistedPanelState> = {}) => {
      if (!panelStateRestored) return;
      const current = panelStateRef.current;
      const persisted = {
        open,
        position,
        scrollTop: scrollRef.current?.scrollTop ?? current.scrollTop,
        ...nextState,
      };
      panelStateRef.current = persisted;
      savePersistedPanelState(persisted);
    },
    [open, panelStateRestored, position],
  );

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const persisted = loadPersistedPanelState();
      panelStateRef.current = persisted;
      pendingScrollTopRef.current = persisted.scrollTop;
      setOpen(persisted.open);
      setPosition(persisted.position);
      setPanelStateRestored(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    persistPanelState({ open });
  }, [open, persistPanelState]);

  useEffect(() => {
    persistPanelState({ position });
  }, [persistPanelState, position]);

  useEffect(() => {
    if (!open || pendingScrollTopRef.current === null) return;
    const scrollTop = pendingScrollTopRef.current;
    const restore = window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollTop;
      }
      pendingScrollTopRef.current = null;
    });
    return () => window.cancelAnimationFrame(restore);
  }, [items.length, open]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button > 0) return;

      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;

      const initialPosition =
        position ?? clampPanelPosition({ x: rect.left, y: rect.top });
      if (!position) {
        setPosition(initialPosition);
      }
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanelX: initialPosition.x,
        startPanelY: initialPosition.y,
        suppressClickOnDrag: !open,
        moved: false,
      };
      setIsDragging(true);
      event.preventDefault();
      setPointerCaptureIfPossible(panelRef.current, event.pointerId);
    },
    [clampPanelPosition, open, position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (
        !dragState.moved &&
        (Math.abs(deltaX) > DRAG_MOVE_THRESHOLD ||
          Math.abs(deltaY) > DRAG_MOVE_THRESHOLD)
      ) {
        dragState.moved = true;
      }

      setClampedPosition({
        x: dragState.startPanelX + deltaX,
        y: dragState.startPanelY + deltaY,
      });
    };

    const stopDrag = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      if (dragState.moved && dragState.suppressClickOnDrag) {
        suppressNextCollapsedClickRef.current = true;
      }
      dragStateRef.current = null;
      setIsDragging(false);
      releasePointerCaptureIfPossible(panelRef.current, event.pointerId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [isDragging, setClampedPosition]);

  useEffect(() => {
    if (position === null) return;
    const clampAndSet = () => {
      setClampedPosition(position);
    };

    window.addEventListener("resize", clampAndSet);
    return () => window.removeEventListener("resize", clampAndSet);
  }, [position, setClampedPosition]);

  const panelStyle = position
    ? {
        position: "fixed" as const,
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : undefined;

  const panelClass =
    open && !position
      ? "pointer-events-auto absolute inset-x-3 bottom-3 z-[10002] flex max-h-[60dvh] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/92 text-neutral-900 shadow-2xl backdrop-blur-md md:inset-x-auto md:right-6 md:top-16 md:bottom-8 md:max-h-[calc(100dvh-96px)] md:w-[min(380px,calc(100vw-48px))]"
      : "pointer-events-auto z-[10002] w-[calc(100vw-24px)] flex max-h-[60dvh] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/92 text-neutral-900 shadow-2xl backdrop-blur-md md:max-h-[calc(100dvh-96px)] md:w-[min(380px,calc(100vw-48px))]";

  const toggleItem = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const scrollSummaryWithWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      const scroller = scrollRef.current;
      if (!scroller || event.defaultPrevented || event.deltaY === 0) return;

      const target = event.target;
      if (target instanceof Node && scroller.contains(target)) return;

      const previousTop = scroller.scrollTop;
      scroller.scrollTop += event.deltaY;
      if (scroller.scrollTop !== previousTop) {
        event.preventDefault();
      }
    },
    [],
  );

  const openCollapsedPanel = useCallback(() => {
    if (suppressNextCollapsedClickRef.current) {
      suppressNextCollapsedClickRef.current = false;
      return;
    }
    setOpen(true);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        ref={panelRef as RefObject<HTMLButtonElement>}
        className={`summary-panel-collapsed-drag-handle pointer-events-auto z-[10002] min-h-11 cursor-grab touch-none rounded-full border border-neutral-200/80 bg-white/85 px-4 py-2 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-neutral-950 active:cursor-grabbing md:min-h-0 md:px-3 ${
          position
            ? ""
            : "absolute right-4 top-4 md:right-6 md:top-6"
        }`}
        style={panelStyle}
        onPointerDown={startDrag}
        onClick={openCollapsedPanel}
      >
        AI 总结
      </button>
    );
  }

  return (
    <aside
      ref={panelRef}
      className={panelClass}
      style={panelStyle}
      onWheel={scrollSummaryWithWheel}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200/80 px-4 py-3">
        <div
          className={`${DRAG_HANDLE_CLASS} ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } flex min-w-0 flex-1 touch-none items-center gap-2`}
          onPointerDown={startDrag}
          role="button"
          aria-label="拖动 AI 总结面板"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-700" />
              <p className="text-sm font-semibold">AI 总结</p>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                {status}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-neutral-500">
              已选 {selectedBlockCount} 段
              {selectionAnchorLabel ? ` · 锚点：${selectionAnchorLabel}` : ""} ·{" "}
              {sectionTitle}
            </p>
            {selectedBlockCount > 0 && !summarizing ? (
              <p className="mt-1 text-xs text-neutral-400">
                Ctrl/Cmd 选择前后两段，再点选中中间所有段。
              </p>
            ) : null}
            {summaryQueueLabel ? (
              <p className="mt-1 truncate text-xs text-neutral-400">
                {summaryQueueLabel}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-neutral-200 bg-white/70 p-1.5 text-neutral-500 shadow-sm transition hover:bg-white hover:text-neutral-950"
          aria-label="收起 AI 总结"
          onClick={() => setOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200/70 px-4 py-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-10 gap-1.5 rounded-full px-3 text-xs sm:h-7 sm:px-2.5"
          disabled={summarizeDisabled}
          onClick={onSummarizeCurrent}
        >
          <Sparkles className={`h-3.5 w-3.5 ${summarizing ? "animate-spin" : ""}`} />
          {summarizing ? "总结中..." : "总结所选段落"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 gap-1.5 rounded-full px-3 text-xs sm:h-7 sm:px-2.5"
          disabled={expandSelectionRangeDisabled || !onExpandSelectionRange}
          onClick={onExpandSelectionRange}
        >
          选中中间所有段
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 gap-1.5 rounded-full px-3 text-xs sm:h-7 sm:px-2.5"
          disabled={selectedBlockCount === 0 || !onClearSelection}
          onClick={onClearSelection}
        >
          清除选择
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 gap-1.5 rounded-full px-3 text-xs sm:h-7 sm:px-2.5"
          disabled={deleteSummaryDisabled || !onDeleteSummary}
          onClick={onDeleteSummary}
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除总结
        </Button>
        {summaryQueuePaused ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full sm:h-7 sm:w-7"
            disabled={!onResumeSummaryQueue}
            aria-label="继续总结队列"
            onClick={onResumeSummaryQueue}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full sm:h-7 sm:w-7"
            disabled={!onPauseSummaryQueue}
            aria-label="暂停总结队列"
            onClick={onPauseSummaryQueue}
          >
            <Pause className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="summary-panel-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-3"
        onScroll={(event) => {
          persistPanelState({ scrollTop: event.currentTarget.scrollTop });
        }}
      >
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => {
              const expanded =
                item.summaryId
                  ? item.summaryId === activeSummaryId
                  : expandedIds.has(item.id);
              return (
                <section
                  key={item.id}
                  className="rounded-xl border border-neutral-200/75 bg-white/70 p-3 shadow-sm"
                >
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left transition ${
                      item.summaryId === activeSummaryId ||
                      item.id === activeSummaryId
                        ? "bg-amber-50 text-amber-950"
                        : "hover:bg-neutral-50"
                    }`}
                    onClick={() => {
                      if (item.summaryId) {
                        onSelectSummary?.(item.summaryId);
                      } else {
                        toggleItem(item.id);
                      }
                    }}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                      {item.status === "loading"
                        ? "生成中"
                        : item.status === "cached"
                          ? "缓存"
                          : "完成"}
                    </span>
                  </button>
                  {expanded ? (
                    <SummaryMarkdown
                      content={item.content}
                      className="mt-3 break-words text-neutral-700"
                    />
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white/60 px-4 py-6 text-sm leading-6 text-neutral-500">
            点击正文段落选择内容后，可在这里生成所选段落总结。
          </div>
        )}
      </div>
    </aside>
  );
}
