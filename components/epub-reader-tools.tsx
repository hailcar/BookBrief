"use client";

import {
  Bookmark,
  BookmarkCheck,
  Languages,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { EpubSectionList } from "@/components/epub-section-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  EpubComment,
  EpubSearchResult,
  EpubSection,
  ReadingBookmark,
  SectionSummary,
  SummaryQueueStats,
  SummaryTask,
} from "@/lib/types";

type Props = {
  sections: EpubSection[];
  activeSectionId: string | null;
  summaries: Record<string, SectionSummary>;
  bookmarks: ReadingBookmark[];
  isActiveSectionBookmarked: boolean;
  searchQuery: string;
  searchResults: EpubSearchResult[];
  searchingBook: boolean;
  searchError: string | null;
  onSearchQueryChange: (value: string) => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onToggleBookmark: () => void;
  onSelectSection: (section: EpubSection) => void;
  summaryEnabled?: boolean;
  summaryTasks?: SummaryTask[];
  summaryQueueStats?: SummaryQueueStats;
  summaryQueueLabel?: string;
  summaryQueuePaused?: boolean;
  autoSummaryOnReading?: boolean;
  onAutoSummaryOnReadingChange?: (enabled: boolean) => void;
  onAutoSummarizeCurrent?: () => void;
  onPauseSummaryQueue?: () => void;
  onResumeSummaryQueue?: () => void;
  onCancelSummaryQueue?: () => void;
  onClearFinishedSummaryTasks?: () => void;
  onRetrySummaryTask?: (taskId: string) => void;
  comments?: Record<string, EpubComment>;
  onActivateAnnotation?: (annotationId: string) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
};

export function EpubReaderTools({
  sections,
  activeSectionId,
  summaries,
  bookmarks,
  isActiveSectionBookmarked,
  searchQuery,
  searchResults,
  searchingBook,
  searchError,
  onSearchQueryChange,
  onSearch,
  onClearSearch,
  onToggleBookmark,
  onSelectSection,
  summaryEnabled = true,
  summaryTasks = [],
  summaryQueueStats,
  summaryQueueLabel,
  summaryQueuePaused = false,
  autoSummaryOnReading = false,
  onAutoSummaryOnReadingChange,
  onAutoSummarizeCurrent,
  onPauseSummaryQueue,
  onResumeSummaryQueue,
  onCancelSummaryQueue,
  onClearFinishedSummaryTasks,
  onRetrySummaryTask,
  comments = {},
  onActivateAnnotation,
  onDeleteAnnotation,
}: Props) {
  const bookmarkedSectionIds = bookmarks.map((bookmark) => bookmark.sectionId);
  const byId = new Map(sections.map((section) => [section.id, section]));
  const sectionOrder = new Map(
    sections.map((section, index) => [section.id, index]),
  );
  const annotations = Object.values(comments).sort((a, b) => {
    const sectionDelta =
      (sectionOrder.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER) -
      (sectionOrder.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER);
    if (sectionDelta !== 0) return sectionDelta;
    return a.updatedAt - b.updatedAt;
  });

  const selectById = (sectionId: string) => {
    const section = byId.get(sectionId);
    if (section) onSelectSection(section);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 px-4 pb-4">
        <section className="space-y-2 border-b border-border/65 pb-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">搜索</h2>
            {searchQuery || searchResults.length > 0 ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="清除搜索"
                onClick={onClearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch(searchQuery);
            }}
          >
            <Input
              value={searchQuery}
              placeholder="搜索全书"
              className="h-8 bg-white/65"
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              disabled={searchingBook || !searchQuery.trim()}
              aria-label="搜索全书"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>
          {searchingBook ? (
            <p className="text-xs text-muted-foreground">正在搜索全书…</p>
          ) : null}
          {searchError ? (
            <p className="text-xs text-destructive">{searchError}</p>
          ) : null}
          {searchResults.length > 0 ? (
            <ul className="space-y-1">
              {searchResults.map((result) => (
                <li
                  key={`${result.sectionId}-${result.matchIndex}`}
                  className="rounded-lg border bg-white/45"
                >
                  <button
                    type="button"
                    className="w-full space-y-1 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-secondary/55"
                    onClick={() => selectById(result.sectionId)}
                  >
                    <span className="block font-medium">
                      {result.sectionTitle}
                    </span>
                    <span className="line-clamp-2 text-muted-foreground">
                      {result.snippet}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {summaryEnabled ? (
          <section className="space-y-2 border-b border-border/65 pb-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">自动总结</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={!onClearFinishedSummaryTasks}
                aria-label="清理已完成任务"
                onClick={onClearFinishedSummaryTasks}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 bg-white/55 px-2 text-xs"
                disabled={!activeSectionId || !onAutoSummarizeCurrent}
                onClick={onAutoSummarizeCurrent}
              >
                <Sparkles className="h-3.5 w-3.5" />
                当前位置
              </Button>
              <Button
                type="button"
                size="sm"
                variant={autoSummaryOnReading ? "secondary" : "outline"}
                className="h-8 gap-1 px-2 text-xs"
                disabled={!activeSectionId || !onAutoSummaryOnReadingChange}
                onClick={() =>
                  onAutoSummaryOnReadingChange?.(!autoSummaryOnReading)
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                阅读触发
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-xs"
                disabled={summaryQueuePaused || !onPauseSummaryQueue}
                onClick={onPauseSummaryQueue}
              >
                <Pause className="h-3.5 w-3.5" />
                暂停
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-xs"
                disabled={!summaryQueuePaused || !onResumeSummaryQueue}
                onClick={onResumeSummaryQueue}
              >
                <Play className="h-3.5 w-3.5" />
                继续
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={!onCancelSummaryQueue}
                onClick={onCancelSummaryQueue}
              >
                取消
              </Button>
            </div>
            {summaryQueueLabel ? (
              <p className="text-xs text-muted-foreground">
                {summaryQueueLabel}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">暂无自动总结任务</p>
            )}
            {summaryQueueStats ? (
              <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                <span className="rounded-md bg-white/50 px-1.5 py-1">排队 {summaryQueueStats.queued}</span>
                <span className="rounded-md bg-white/50 px-1.5 py-1">运行 {summaryQueueStats.running}</span>
                <span className="rounded-md bg-white/50 px-1.5 py-1">成功 {summaryQueueStats.success}</span>
                <span className="rounded-md bg-white/50 px-1.5 py-1">缓存 {summaryQueueStats.cached}</span>
                <span className="rounded-md bg-white/50 px-1.5 py-1">失败 {summaryQueueStats.failed}</span>
                <span className="rounded-md bg-white/50 px-1.5 py-1">取消 {summaryQueueStats.cancelled}</span>
              </div>
            ) : null}
            {summaryTasks.length > 0 ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
                {summaryTasks.slice(0, 8).map((task) => (
                  <li
                    key={task.id}
                    className="rounded-lg border bg-white/45 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 font-medium">
                          {task.headingText}
                        </span>
                        <span className="text-muted-foreground">
                          {task.status}
                          {task.retryCount ? ` · retry ${task.retryCount}` : ""}
                        </span>
                      </span>
                      {task.status === "failed" && onRetrySummaryTask ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          aria-label="重试总结任务"
                          onClick={() => onRetrySummaryTask(task.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {summaryEnabled ? (
          <section className="space-y-2 border-b border-border/65 pb-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                批注与翻译
              </h2>
              <span className="rounded-md bg-white/50 px-1.5 py-1 text-[11px] text-muted-foreground">
                {annotations.length}
              </span>
            </div>
            {annotations.length > 0 ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {annotations.map((annotation) => {
                  const sectionTitle =
                    byId.get(annotation.sectionId)?.title ?? annotation.sectionId;
                  const isTranslation = annotation.kind === "translation";
                  return (
                    <li
                      key={annotation.id}
                      className="rounded-lg border bg-white/45 p-2 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        {isTranslation ? (
                          <Languages className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : (
                          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => onActivateAnnotation?.(annotation.id)}
                        >
                          <span className="line-clamp-1 font-medium">
                            {sectionTitle}
                          </span>
                          {annotation.sourceText ? (
                            <span className="mt-0.5 line-clamp-2 text-muted-foreground">
                              {annotation.sourceText}
                            </span>
                          ) : null}
                          <span className="mt-1 line-clamp-3">
                            {annotation.comment}
                          </span>
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          aria-label="删除批注"
                          disabled={!onDeleteAnnotation}
                          onClick={() => onDeleteAnnotation?.(annotation.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">暂无批注或翻译</p>
            )}
          </section>
        ) : null}

        <section className="space-y-2 border-b border-border/65 pb-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">书签</h2>
            <Button
              type="button"
              size="sm"
              variant={isActiveSectionBookmarked ? "secondary" : "outline"}
              className="h-8 gap-1 px-2 text-xs"
              disabled={!activeSectionId}
              onClick={onToggleBookmark}
            >
              {isActiveSectionBookmarked ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {isActiveSectionBookmarked ? "已收藏" : "收藏本章"}
            </Button>
          </div>
          {bookmarks.length > 0 ? (
            <ul className="space-y-1">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.sectionId}>
                  <button
                    type="button"
                    className="line-clamp-2 w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary/55"
                    onClick={() => selectById(bookmark.sectionId)}
                  >
                    {bookmark.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">暂无书签</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">目录</h2>
          <EpubSectionList
            sections={sections}
            activeSectionId={activeSectionId}
            summaries={summaryEnabled ? summaries : {}}
            bookmarkedSectionIds={bookmarkedSectionIds}
            onSelectSection={onSelectSection}
            className="h-auto px-0 pb-0"
          />
        </section>
      </div>
    </ScrollArea>
  );
}
