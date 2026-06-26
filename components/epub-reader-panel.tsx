"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  LogOut,
  Minimize2,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { ImmersiveSummaryPanel } from "@/components/immersive-summary-panel";
import { ReaderContentPane } from "@/components/reader-content-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EpubDisplayMode } from "@/lib/epub-display";
import { EPUB_DISPLAY_MODE_LABELS } from "@/lib/epub-display";
import type { ReaderSettings } from "@/lib/reader-settings";
import {
  READER_CONTENT_WIDTH_LABELS,
  READER_FONT_FAMILY_LABELS,
  READER_FONT_SIZE_LABELS,
  READER_IMAGE_MODE_LABELS,
  type ReaderContentWidth,
  type ReaderFontFamily,
  type ReaderFontSize,
  type ReaderImageMode,
} from "@/lib/reader-settings";
import type {
  DocumentFormat,
  EpubComment,
  EpubSection,
  InlineSummaryActionState,
  InlineSummaryBubble,
  ReadingBookmark,
  SectionSummary,
} from "@/lib/types";

type Props = {
  isFullscreen: boolean;
  onExitFullscreen: () => void;
  bookTitle?: string;
  sectionTitle: string;
  sectionId: string | null;
  previewHtml: string;
  documentFormat?: DocumentFormat | null;
  bookBuffer?: ArrayBuffer | null;
  searchQuery?: string;
  loadingPreview: boolean;
  displayMode: EpubDisplayMode;
  onDisplayModeChange: (mode: EpubDisplayMode) => void;
  readerSettings: ReaderSettings;
  onPatchReaderSettings: (patch: Partial<ReaderSettings>) => void;
  summaryEnabled?: boolean;
  summaryText: string;
  summary?: SectionSummary | null;
  activeSummaryKey?: string | null;
  isSummaryPlaceholder?: boolean;
  summarizingSection?: boolean;
  selectedBlockCount?: number;
  selectionAnchorLabel?: string | null;
  onClearSelection?: () => void;
  onExpandSelectionRange?: () => void;
  expandSelectionRangeDisabled?: boolean;
  onDeleteSummary?: () => void;
  deleteSummaryDisabled?: boolean;
  onSummarizeCurrent: () => void;
  summarizeDisabled: boolean;
  highlightBlockIds?: string[];
  activeBlockId?: string | null;
  summarizedBlockIds?: string[];
  selectedBlockIds?: string[];
  comments?: EpubComment[];
  scrollToBlockRequest?: { blockId: string; nonce: number } | null;
  scrollTopRequest?: { top: number; sectionId?: string; nonce: number } | null;
  inlineSummaryBubbles?: InlineSummaryBubble[];
  inlineSummaryAction?: InlineSummaryActionState;
  onSummarizeHeading?: (headingBlockId: string) => void;
  onHeadingVisible?: (headingBlockId: string) => void;
  onReaderBlockClick?: (
    blockId: string,
    modifiers?: { ctrlKey?: boolean; metaKey?: boolean },
  ) => void;
  onActivateSummary?: (summaryId: string) => void;
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
  onDeleteActiveSummary?: () => void;
  onReaderWindowSectionChange?: (sectionId: string, offset: number) => void;
  positionLabel?: string | null;
  onPrevSection?: () => void;
  onNextSection?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  sections: EpubSection[];
  summaries: Record<string, SectionSummary>;
  bookmarks: ReadingBookmark[];
  isActiveSectionBookmarked: boolean;
  onToggleBookmark: () => void;
  onSelectSection: (section: EpubSection) => void;
  summaryQueueLabel?: string;
  summaryQueuePaused?: boolean;
  onPauseSummaryQueue?: () => void;
  onResumeSummaryQueue?: () => void;
  onCancelSummaryQueue?: () => void;
  loadingSection?: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    Boolean(target.closest("[data-ai-input]")) ||
    Boolean(target.closest("[data-command-panel]"))
  );
}

function MiniOption<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border bg-neutral-50 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`min-h-10 rounded px-2 py-2 text-xs transition sm:min-h-0 sm:py-1 ${
            value === option.id
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-white"
          }`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EpubReaderPanel({
  isFullscreen,
  onExitFullscreen,
  bookTitle,
  sectionTitle,
  sectionId,
  previewHtml,
  documentFormat,
  bookBuffer,
  searchQuery,
  loadingPreview,
  displayMode,
  onDisplayModeChange,
  readerSettings,
  onPatchReaderSettings,
  summaryEnabled = true,
  summaryText,
  summary,
  activeSummaryKey,
  isSummaryPlaceholder,
  summarizingSection = false,
  selectedBlockCount = 0,
  selectionAnchorLabel,
  onClearSelection,
  onExpandSelectionRange,
  expandSelectionRangeDisabled,
  onDeleteSummary,
  deleteSummaryDisabled,
  onSummarizeCurrent,
  summarizeDisabled,
  highlightBlockIds,
  activeBlockId,
  summarizedBlockIds,
  selectedBlockIds,
  comments,
  scrollToBlockRequest,
  scrollTopRequest,
  inlineSummaryBubbles,
  inlineSummaryAction,
  onSummarizeHeading,
  onHeadingVisible,
  onReaderBlockClick,
  onActivateSummary,
  onSummarizeSelection,
  onCommentTextSelection,
  onTranslateTextSelection,
  onDeleteAnnotation,
  onDeleteActiveSummary,
  onReaderWindowSectionChange,
  positionLabel,
  onPrevSection,
  onNextSection,
  hasPrev,
  hasNext,
  sections,
  summaries,
  bookmarks,
  isActiveSectionBookmarked,
  onToggleBookmark,
  onSelectSection,
  summaryQueueLabel,
  summaryQueuePaused = false,
  onPauseSummaryQueue,
  onResumeSummaryQueue,
  onCancelSummaryQueue,
  loadingSection = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chapterQuery, setChapterQuery] = useState("");
  const summaryAvailable = summaryEnabled && documentFormat !== "pdf";
  const readerSettingsAvailable = documentFormat !== "pdf";

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setChapterQuery("");
  }, []);

  const goPrev = useCallback(() => {
    if (!hasPrev || loadingPreview || loadingSection) return;
    onPrevSection?.();
  }, [hasPrev, loadingPreview, loadingSection, onPrevSection]);

  const goNext = useCallback(() => {
    if (!hasNext || loadingPreview || loadingSection) return;
    onNextSection?.();
  }, [hasNext, loadingPreview, loadingSection, onNextSection]);

  const filteredSections = useMemo(() => {
    const q = chapterQuery.trim().toLocaleLowerCase();
    if (!q) return sections;
    return sections.filter((section) =>
      section.title.toLocaleLowerCase().includes(q),
    );
  }, [chapterQuery, sections]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (menuOpen) {
          closeMenu();
        } else {
          onExitFullscreen();
        }
        return;
      }

      if (loadingPreview || loadingSection) return;

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        goPrev();
        return;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        goNext();
        return;
      }

      if (event.key.toLowerCase() === "m" || event.key === "Enter") {
        event.preventDefault();
        setMenuOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    closeMenu,
    goNext,
    goPrev,
    isFullscreen,
    loadingPreview,
    loadingSection,
    menuOpen,
    onExitFullscreen,
  ]);

  if (!isFullscreen) return null;
  if (typeof document === "undefined") return null;

  const navButtonClass =
    "pointer-events-auto absolute top-1/2 z-[10001] hidden h-32 w-20 -translate-y-1/2 items-center justify-center rounded-full bg-white/30 text-neutral-500 opacity-70 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/70 hover:text-neutral-900 hover:opacity-100 disabled:pointer-events-none disabled:opacity-20 sm:flex";

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] h-[100dvh] w-screen overflow-hidden bg-neutral-100 text-neutral-900"
      role="dialog"
      aria-modal="true"
      aria-label="沉浸全屏阅读"
      data-reader-fullscreen-overlay
    >
      <div className="relative h-full w-full">
        <div className="absolute inset-0 z-10 overflow-hidden">
          <ReaderContentPane
            activeTab="preview"
            loadingPreview={loadingPreview}
            previewHtml={previewHtml}
            documentFormat={documentFormat}
            bookBuffer={bookBuffer}
            sections={sections}
            searchQuery={searchQuery}
            sectionTitle={sectionTitle}
            sectionId={sectionId}
            displayMode={displayMode}
            readerSettings={readerSettings}
            layout="fullscreen"
            summaryText={summaryText}
            summary={summary}
            isSummaryPlaceholder={isSummaryPlaceholder}
            summarizing={summarizingSection}
            selectedBlockCount={selectedBlockCount}
            selectionAnchorLabel={selectionAnchorLabel}
            onClearSelection={onClearSelection}
            onSummarizeCurrent={onSummarizeCurrent}
            summarizeDisabled={summarizeDisabled}
            highlightBlockIds={highlightBlockIds}
            activeBlockId={activeBlockId}
            summarizedBlockIds={summarizedBlockIds}
            selectedBlockIds={selectedBlockIds}
            comments={comments}
            scrollToBlockRequest={scrollToBlockRequest}
            scrollTopRequest={scrollTopRequest}
            inlineSummaryBubbles={[]}
            inlineSummaryAction={inlineSummaryAction}
            activeSummaryId={activeSummaryKey}
            onSummarizeHeading={onSummarizeHeading}
            onHeadingVisible={onHeadingVisible}
            onReaderBlockClick={onReaderBlockClick}
            onSummarizeSelection={onSummarizeSelection}
            onCommentTextSelection={onCommentTextSelection}
            onTranslateTextSelection={onTranslateTextSelection}
            onDeleteAnnotation={onDeleteAnnotation}
            onActivateSummary={onActivateSummary}
            onDeleteActiveSummary={onDeleteActiveSummary}
            onReaderWindowSectionChange={onReaderWindowSectionChange}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[10000]">
          <button
            type="button"
            className={`${navButtonClass} left-4 md:left-6`}
            disabled={!hasPrev || loadingPreview || loadingSection}
            aria-label="上一章"
            onClick={goPrev}
          >
            <ChevronLeft size={56} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className={`${navButtonClass} right-4 md:right-6`}
            disabled={!hasNext || loadingPreview || loadingSection}
            aria-label="下一章"
            onClick={goNext}
          >
            <ChevronRight size={56} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute left-1/2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[10002] flex h-11 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white/90 text-neutral-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-neutral-950 sm:top-3 sm:h-8 sm:w-9 sm:rounded-md"
            aria-label="打开沉浸阅读菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[10002] flex h-12 w-12 items-center justify-center rounded-full border border-neutral-300 bg-white/90 text-neutral-700 shadow-lg backdrop-blur transition hover:bg-white hover:text-neutral-950 md:right-6 md:bottom-6 md:h-11 md:w-11"
            aria-label="缩小退出沉浸阅读"
            title="缩小退出沉浸阅读"
            onClick={onExitFullscreen}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        {summaryAvailable ? (
          <ImmersiveSummaryPanel
            sectionTitle={sectionTitle}
            summaryText={summaryText}
            summary={summary}
            isSummaryPlaceholder={isSummaryPlaceholder}
            summaries={inlineSummaryBubbles ?? []}
            activeSummaryId={activeSummaryKey}
            summarizing={summarizingSection}
            summarizeDisabled={!sectionId || summarizeDisabled}
            summaryQueueLabel={summaryQueueLabel}
            summaryQueuePaused={summaryQueuePaused}
            selectedBlockCount={selectedBlockCount}
            selectionAnchorLabel={selectionAnchorLabel}
            onClearSelection={onClearSelection}
            onExpandSelectionRange={onExpandSelectionRange}
            expandSelectionRangeDisabled={expandSelectionRangeDisabled}
            onDeleteSummary={onDeleteSummary}
            deleteSummaryDisabled={deleteSummaryDisabled}
            onSummarizeCurrent={onSummarizeCurrent}
            onSelectSummary={onActivateSummary}
            onPauseSummaryQueue={onPauseSummaryQueue}
            onResumeSummaryQueue={onResumeSummaryQueue}
          />
        ) : null}

        {menuOpen ? (
          <div className="absolute inset-0 z-[10003]">
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default bg-transparent"
              aria-label="关闭菜单"
              onClick={closeMenu}
            />
            <div
              className="pointer-events-auto absolute left-1/2 top-[calc(env(safe-area-inset-top)+3.75rem)] grid h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-5rem)] max-h-[720px] min-h-0 w-[min(calc(100vw-16px),760px)] -translate-x-1/2 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-xl border border-neutral-200 bg-white/95 text-neutral-900 shadow-xl backdrop-blur sm:top-12 sm:h-[calc(100dvh-64px)]"
              data-reader-menu-layout="two-column"
              onClick={(event) => event.stopPropagation()}
            >
              <aside
                className="flex min-h-0 flex-col border-r border-neutral-200 bg-neutral-50/70 p-3"
                data-reader-menu-toc
              >
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <List className="h-4 w-4 shrink-0" />
                  <span className="truncate">目录</span>
                </div>
                <div className="relative mt-3 min-w-0">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={chapterQuery}
                    className="h-10 pl-7 text-sm sm:h-8"
                    placeholder="搜索目录"
                    onChange={(event) => setChapterQuery(event.target.value)}
                  />
                </div>
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                  {filteredSections.map((section) => {
                    const active = section.id === sectionId;
                    const done = summaryAvailable && Boolean(summaries[section.id]);
                    const bookmarked = bookmarks.some(
                      (bookmark) => bookmark.sectionId === section.id,
                    );
                    return (
                      <button
                        key={section.id}
                        type="button"
                        className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-neutral-100 sm:min-h-0 sm:py-1.5 sm:text-sm ${
                          active
                            ? "bg-neutral-900 text-white hover:bg-neutral-900"
                            : ""
                        }`}
                        onClick={() => {
                          onSelectSection(section);
                          closeMenu();
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {section.title}
                        </span>
                        {bookmarked ? <Bookmark className="h-3 w-3" /> : null}
                        {done ? <Sparkles className="h-3 w-3" /> : null}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section
                className="min-h-0 overflow-y-auto p-3"
                data-reader-menu-actions
              >
                <div className="min-w-0 border-b border-neutral-200 pb-3">
                  <p className="truncate text-sm font-medium">
                    {bookTitle || "文档"}
                  </p>
                  <p className="mt-1 truncate text-xs text-neutral-500">
                    {sectionTitle}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {positionLabel ?? `${sections.length} 个小节`}
                  </p>
                  {summaryAvailable && summaryQueueLabel ? (
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {summaryQueueLabel}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 sm:h-7"
                      disabled={!hasPrev || loadingPreview || loadingSection}
                      onClick={goPrev}
                    >
                      上一节
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 sm:h-7"
                      disabled={!hasNext || loadingPreview || loadingSection}
                      onClick={goNext}
                    >
                      下一节
                    </Button>
                  </div>
                  {summaryAvailable ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 sm:h-7"
                          disabled={!summaryQueuePaused || !onResumeSummaryQueue}
                          onClick={onResumeSummaryQueue}
                        >
                          继续总结
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 sm:h-7"
                          disabled={summaryQueuePaused || !onPauseSummaryQueue}
                          onClick={onPauseSummaryQueue}
                        >
                          暂停总结
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full justify-start gap-2 text-neutral-600 sm:h-8"
                        disabled={!onCancelSummaryQueue}
                        onClick={onCancelSummaryQueue}
                      >
                        <X className="h-4 w-4" />
                        取消当前任务
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-start gap-2 sm:h-8"
                    disabled={!sectionId}
                    onClick={onToggleBookmark}
                  >
                    {isActiveSectionBookmarked ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                    {isActiveSectionBookmarked ? "取消书签" : "收藏当前位置"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-start gap-2 text-neutral-600 sm:h-8"
                    onClick={onExitFullscreen}
                  >
                    <LogOut className="h-4 w-4" />
                    退出沉浸
                  </Button>
                </div>

                {readerSettingsAvailable ? (
                  <div className="mt-4 space-y-3 border-t border-neutral-200 pt-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Settings className="h-4 w-4 shrink-0" />
                      <span>阅读设置</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500">版式</p>
                      <MiniOption
                        value={displayMode}
                        options={(["global", "publisher"] as const).map(
                          (id) => ({
                            id,
                            label: EPUB_DISPLAY_MODE_LABELS[id],
                          }),
                        )}
                        onChange={onDisplayModeChange}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500">字体</p>
                      <MiniOption
                        value={readerSettings.fontFamily}
                        options={(["book", "serif", "system"] as const).map(
                          (id) => ({
                            id,
                            label: READER_FONT_FAMILY_LABELS[id],
                          }),
                        )}
                        onChange={(fontFamily) =>
                          onPatchReaderSettings({
                            fontFamily: fontFamily as ReaderFontFamily,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500">字号</p>
                      <MiniOption
                        value={readerSettings.fontSize}
                        options={(["small", "default", "large"] as const).map(
                          (id) => ({
                            id,
                            label: READER_FONT_SIZE_LABELS[id],
                          }),
                        )}
                        onChange={(fontSize) =>
                          onPatchReaderSettings({
                            fontSize: fontSize as ReaderFontSize,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500">宽度</p>
                      <MiniOption
                        value={readerSettings.contentWidth}
                        options={(
                          ["narrow", "standard", "wide", "full"] as const
                        ).map((id) => ({
                          id,
                          label: READER_CONTENT_WIDTH_LABELS[id],
                        }))}
                        onChange={(contentWidth) =>
                          onPatchReaderSettings({
                            contentWidth: contentWidth as ReaderContentWidth,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500">图片</p>
                      <MiniOption
                        value={readerSettings.imageMode}
                        options={(
                          ["contain", "original", "full-width"] as const
                        ).map((id) => ({
                          id,
                          label: READER_IMAGE_MODE_LABELS[id],
                        }))}
                        onChange={(imageMode) =>
                          onPatchReaderSettings({
                            imageMode: imageMode as ReaderImageMode,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
