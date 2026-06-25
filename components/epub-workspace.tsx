"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  KeyRound,
  Link,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { EpubReaderPanel } from "@/components/epub-reader-panel";
import { EpubReaderTools } from "@/components/epub-reader-tools";
import {
  EpubReaderToolbar,
  type ReaderPanelTab,
} from "@/components/epub-reader-toolbar";
import { EpubSettingsDialog } from "@/components/epub-settings-dialog";
import { ReaderContentPane } from "@/components/reader-content-pane";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBookWorkspace } from "@/hooks/use-book-workspace";
import { useEpubDisplayMode } from "@/hooks/use-epub-display-mode";
import { useReaderFullscreen } from "@/hooks/use-reader-fullscreen";
import { useReaderSettings } from "@/hooks/use-reader-settings";
import { useSectionNavigation } from "@/hooks/use-section-navigation";
import {
  documentFormatForBook,
  documentFormatFromFileName,
  documentFormatLabel,
  documentSectionUnitLabel,
  isSupportedDocumentFileName,
  sectionForPdfPageAnchor,
} from "@/lib/documents";
import { assertHttpDocumentUrl } from "@/lib/epub-url";
import { isMobileViewport } from "@/lib/viewport";
import type {
  DocumentFormat,
  EpubComment,
  EpubSection,
  InlineSummaryActionState,
  InlineSummaryBubble,
} from "@/lib/types";

export function EpubWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ReaderPanelTab>("preview");
  const [bookBarExpanded, setBookBarExpanded] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [urlParamError, setUrlParamError] = useState<string | null>(null);
  const [pendingCommentSelection, setPendingCommentSelection] = useState<{
    text: string;
    blockIds: string[];
    fragments?: { blockId: string; text: string }[];
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const urlParamHandledRef = useRef(false);
  const readerWindowNavigationPendingRef = useRef(false);
  const ws = useBookWorkspace();
  const { mode: displayMode, setMode: setDisplayMode } = useEpubDisplayMode();
  const { settings: readerSettings, patchSettings: patchReaderSettings } =
    useReaderSettings();
  const {
    isReaderFullscreen,
    enterReaderFullscreen,
    exitReaderFullscreen,
  } = useReaderFullscreen();

  const activeBookFormat: DocumentFormat | null = ws.book
    ? documentFormatForBook(ws.book.fileName, ws.book.format)
    : null;
  const summaryEnabled = activeBookFormat !== "pdf";
  const activeSectionUnitLabel = activeBookFormat
    ? documentSectionUnitLabel(activeBookFormat)
    : "小节";

  const readerTab: ReaderPanelTab = summaryEnabled ? activeTab : "preview";

  const labelForFileName = (fileName: string) =>
    documentFormatLabel(documentFormatFromFileName(fileName) ?? "epub");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedDocumentFileName(file.name)) {
      toast.error("请选择 .epub 或 .pdf 文件");
      return;
    }
    try {
      const result = await ws.uploadFile(file);
      const formatLabel = labelForFileName(result.fileName);
      if (isMobileViewport()) {
        setActiveTab("preview");
        enterReaderFullscreen();
      }
      toast.success(
        result.reused
          ? `书库已存在「${result.fileName}」，已直接打开`
          : `${formatLabel} 已保存到浏览器`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    }
  };

  const onDownloadUrl = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUrlParamError(null);
    try {
      const result = await ws.downloadDocumentFromUrl(documentUrl);
      const formatLabel = labelForFileName(result.fileName);
      setDocumentUrl("");
      if (isMobileViewport()) {
        setActiveTab("preview");
        enterReaderFullscreen();
      }
      toast.success(
        result.reused
          ? `书库已存在「${result.fileName}」，已直接打开`
          : `${formatLabel} 已下载并保存到浏览器`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "URL 加载失败");
    }
  };

  useEffect(() => {
    if (urlParamHandledRef.current) return;
    urlParamHandledRef.current = true;

    const queryUrl = new URLSearchParams(window.location.search).get("url");
    if (!queryUrl) return;

    const clearUrlParam = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("url");
      window.history.replaceState(null, "", nextUrl.toString());
    };

    const run = async () => {
      try {
        const documentDownloadUrl = assertHttpDocumentUrl(queryUrl);
        setDocumentUrl(documentDownloadUrl);
        const result = await ws.downloadDocumentFromUrl(documentDownloadUrl);
        const formatLabel = labelForFileName(result.fileName);
        setActiveTab("preview");
        enterReaderFullscreen();
        clearUrlParam();
        toast.success(
          result.reused
            ? `书库已存在「${result.fileName}」，已直接打开`
            : `${formatLabel} 已下载，已进入沉浸模式`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "URL 加载失败";
        setUrlParamError(message);
        toast.error(message);
      }
    };

    void run();
  }, [enterReaderFullscreen, ws]);

  const activeSection = ws.book?.sections.find(
    (s) => s.id === ws.activeSectionId,
  );

  const sectionNav = useSectionNavigation(
    ws.book?.sections,
    ws.activeSectionId,
  );

  const onSelectSection = useCallback(
    async (section: EpubSection) => {
      try {
        await ws.loadPreview(section);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "预览加载失败");
      }
    },
    [ws],
  );

  const onOpenLibraryBook = useCallback(
    async (id: string) => {
      try {
        await ws.openBook(id);
        if (isMobileViewport()) {
          setActiveTab("preview");
          enterReaderFullscreen();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "打开失败");
      }
    },
    [enterReaderFullscreen, ws],
  );

  const onReaderWindowSectionChange = useCallback(
    (sectionId: string, offset: number) => {
      const scrollTop = Math.max(0, offset);
      if (!readerWindowNavigationPendingRef.current && !ws.loadingPreview) {
        ws.saveReaderPosition(sectionId, scrollTop);
      }
      if (
        readerWindowNavigationPendingRef.current ||
        ws.loadingPreview ||
        sectionId === ws.activeSectionId
      ) {
        return;
      }
      const section = ws.book
        ? sectionForPdfPageAnchor(ws.book.sections, sectionId)
        : undefined;
      if (!section) return;
      readerWindowNavigationPendingRef.current = true;
      void ws
        .loadPreview(section, {
          quiet: true,
          scrollSectionId: sectionId,
          scrollTop,
          preserveScroll: activeBookFormat === "pdf",
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "预览加载失败");
        })
        .finally(() => {
          readerWindowNavigationPendingRef.current = false;
        });
    },
    [activeBookFormat, ws],
  );

  const onSummarizeSelectedBlocks = async () => {
    if (!summaryEnabled) return;
    if (!activeSection) {
      toast.error(`请先在目录中选择${activeSectionUnitLabel}`);
      return;
    }
    try {
      await ws.summarizeSelectedBlocks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "总结失败");
    }
  };

  const onSummarizeHeading = async (headingBlockId: string) => {
    if (!summaryEnabled) return;
    if (!activeSection) return;
    try {
      await ws.summarizeHeading(headingBlockId);
    } catch (e) {
      ws.clearHighlights();
      toast.error(e instanceof Error ? e.message : "总结失败");
    }
  };

  const onCommentTextSelection = useCallback(
    (selection: {
      text: string;
      blockIds: string[];
      fragments?: { blockId: string; text: string }[];
    }) => {
      if (!summaryEnabled) return;
      const text = selection.text.trim();
      const blockIds = selection.blockIds.filter(Boolean);
      const fragments = selection.fragments
        ?.map((fragment) => ({
          blockId: fragment.blockId,
          text: fragment.text.trim(),
        }))
        .filter((fragment) => fragment.blockId && fragment.text);
      if (!text || blockIds.length === 0) return;
      setPendingCommentSelection({ text, blockIds, fragments });
      setCommentDraft("");
    },
    [summaryEnabled],
  );

  const onCloseCommentEditor = useCallback(() => {
    if (savingComment) return;
    setPendingCommentSelection(null);
    setCommentDraft("");
  }, [savingComment]);

  const onSaveComment = useCallback(async () => {
    if (!summaryEnabled) return;
    if (!activeSection) {
      toast.error(`请先在目录中选择${activeSectionUnitLabel}`);
      return;
    }
    if (!pendingCommentSelection) return;
    const commentText = commentDraft.trim();
    if (!commentText) {
      toast.error("请输入评论内容");
      return;
    }
    setSavingComment(true);
    try {
      const saved = await ws.addCommentForTextSelection({
        commentText,
        selectedText: pendingCommentSelection.text,
        blockIds: pendingCommentSelection.blockIds,
        fragments: pendingCommentSelection.fragments,
      });
      if (saved) {
        toast.success("评论已添加，悬浮在标注片段上可查看");
        setPendingCommentSelection(null);
        setCommentDraft("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "添加评论失败");
    } finally {
      setSavingComment(false);
    }
  }, [
    activeSection,
    activeSectionUnitLabel,
    commentDraft,
    pendingCommentSelection,
    summaryEnabled,
    ws,
  ]);

  const onTranslateTextSelection = useCallback(
    async (selection: {
      text: string;
      blockIds: string[];
      fragments?: { blockId: string; text: string }[];
    }) => {
      if (!summaryEnabled) return;
      const text = selection.text.trim();
      const blockIds = selection.blockIds.filter(Boolean);
      if (!text || blockIds.length === 0) return;
      try {
        toast.info("正在翻译选中文字…");
        const saved = await ws.addTranslationForTextSelection({
          selectedText: text,
          blockIds,
          fragments: selection.fragments,
        });
        if (saved) {
          toast.success("翻译已添加，悬浮在标注文字上可查看");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "翻译失败");
      }
    },
    [summaryEnabled, ws],
  );

  const onDeleteAnnotation = useCallback(
    async (annotationId: string) => {
      if (!summaryEnabled) return;
      try {
        const deleted = await ws.deleteAnnotation(annotationId);
        if (deleted) {
          toast.success("标注已删除");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除标注失败");
      }
    },
    [summaryEnabled, ws],
  );

  const onHeadingVisible = (headingBlockId: string) => {
    if (!summaryEnabled) return;
    if (!ws.autoSummaryOnReading || !activeSection) return;
    ws.enqueueHeadingSummary(headingBlockId, "auto_on_reading");
  };

  const onAutoSummarizeCurrentChapter = () => {
    if (!summaryEnabled) return;
    if (!activeSection) {
      toast.error(`请先在目录中选择${activeSectionUnitLabel}`);
      return;
    }
    const count = ws.autoSummarizeCurrentChapter();
    if (count > 0) {
      toast.success(`已加入 ${count} 个标题总结任务`);
    } else {
      toast.info(`当前${activeSectionUnitLabel}没有可自动总结的大标题`);
    }
  };

  const selectedSummaryPlaceholder =
    ws.selectedBlockIds.length > 0
      ? `已选择 ${ws.selectedBlockIds.length} 个段落${ws.selectionAnchorLabel ? `，锚点：${ws.selectionAnchorLabel}` : ""}。点击「总结所选段落」开始。`
      : "点击正文段落选择要总结的内容；Ctrl/Cmd 选择前后两段，再点选中中间所有段。";

  const selectedSummaryText =
    ws.selectedSummaryResult?.summary ?? selectedSummaryPlaceholder;
  const summaryText = ws.summarizingSelectedBlocks
    ? (ws.selectedSummaryProgressText ?? "正在总结所选段落…")
    : ws.selectedSummaryError
      ? `总结失败：${ws.selectedSummaryError}`
      : selectedSummaryText;
  const isSummaryPlaceholder =
    !ws.selectedSummaryResult && !ws.summarizingSelectedBlocks && !ws.selectedSummaryError;
  const activeHeadingBubbleId =
    ws.activeSummaryKey && ws.activeSummaryKey.includes("::h::")
      ? ws.activeSummaryKey.split("::h::")[1]
      : null;
  const inlineSummaryBubbles = useMemo<InlineSummaryBubble[]>(() => {
    if (!summaryEnabled || !activeSection || !ws.book) return [];
    const byBlockId = new Map<string, InlineSummaryBubble>();
    for (const [cacheKey, summary] of Object.entries(ws.book.summaries)) {
      if (
        summary.sectionId === activeSection.id &&
        summary.scopeType === "selected_blocks" &&
        summary.summary.trim()
      ) {
        const blockIds = summary.blockIds ?? [];
        const anchorBlockId =
          summary.startBlockId ?? blockIds[0] ?? cacheKey.split("::").at(-1);
        if (anchorBlockId) {
          byBlockId.set(cacheKey, {
            summaryId: cacheKey,
            blockId: anchorBlockId,
            blockIds,
            summary: summary.summary,
            status: summary.status === "cached" ? "cached" : "success",
            label: "所选段落总结",
          });
        }
        continue;
      }
      if (
        summary.sectionId !== activeSection.id ||
        !summary.headingBlockId ||
        summary.mode !== "heading_section_summary" ||
        !summary.summary.trim()
      ) {
        continue;
      }
      const blockIds =
        summary.blockIds ??
        (summary.headingBlockId ? [summary.headingBlockId] : []);
      byBlockId.set(cacheKey, {
        summaryId: cacheKey,
        blockId: summary.headingBlockId,
        blockIds,
        summary: summary.summary,
        status: summary.status === "cached" ? "cached" : "success",
        label: "本节总结",
        headingText: summary.headingText,
        headingLevel: summary.headingLevel,
      });
    }
    if (activeHeadingBubbleId && ws.summarizingSection) {
      byBlockId.set(activeHeadingBubbleId, {
        blockId: activeHeadingBubbleId,
        summary:
          ws.streamingSummary ||
          ws.progressMessage ||
          `正在生成总结 ${ws.progress.done}/${ws.progress.total || 1}`,
        status: "loading",
        label: "正在总结本节",
        headingText: "正在总结本节",
      });
    }
    if (ws.selectionAnchorBlockId && ws.summarizingSelectedBlocks) {
      const summaryId = `selected::${activeSection.id}::${ws.selectionAnchorBlockId}`;
      byBlockId.set(summaryId, {
        summaryId,
        blockId: ws.selectionAnchorBlockId,
        blockIds: ws.selectedBlockIds,
        summary: ws.selectedSummaryProgressText || "正在总结所选段落...",
        status: "loading",
        label: "正在总结所选段落",
      });
    }
    if (
      ws.selectionAnchorBlockId &&
      ws.selectedSummaryError &&
      !ws.summarizingSelectedBlocks
    ) {
      const summaryId = `selected::${activeSection.id}::${ws.selectionAnchorBlockId}`;
      byBlockId.set(summaryId, {
        summaryId,
        blockId: ws.selectionAnchorBlockId,
        blockIds: ws.selectedBlockIds,
        summary: `总结失败：${ws.selectedSummaryError}`,
        status: "failed",
        label: "总结失败",
      });
    }
    return Array.from(byBlockId.values());
  }, [
    activeHeadingBubbleId,
    activeSection,
    summaryEnabled,
    ws.book,
    ws.progress.done,
    ws.progress.total,
    ws.progressMessage,
    ws.selectedBlockIds,
    ws.selectedSummaryError,
    ws.selectedSummaryProgressText,
    ws.selectionAnchorBlockId,
    ws.streamingSummary,
    ws.summarizingSelectedBlocks,
    ws.summarizingSection,
  ]);
  const inlineSummaryAction = useMemo<InlineSummaryActionState>(
    () =>
      summaryEnabled
        ? {
            activeBlockId: ws.activeBlockId,
            selectedBlockIds: ws.selectedBlockIds,
            selectedSummaryId: ws.selectedSummaryResult?.summaryKey ?? null,
            selectedSummaryBlockIds: ws.selectedSummaryResult?.blockIds ?? [],
            summarizing: ws.summarizingSelectedBlocks,
          }
        : {
            activeBlockId: null,
            selectedBlockIds: [],
            selectedSummaryId: null,
            selectedSummaryBlockIds: [],
            summarizing: false,
          },
    [
      summaryEnabled,
      ws.activeBlockId,
      ws.selectedBlockIds,
      ws.selectedSummaryResult,
      ws.summarizingSelectedBlocks,
    ],
  );
  const summarizedBlockIds = useMemo(() => {
    if (!summaryEnabled || !activeSection || !ws.book) return [];
    const ids = new Set<string>();
    for (const summary of Object.values(ws.book.summaries)) {
      if (summary.sectionId !== activeSection.id) continue;
      for (const id of summary.blockIds ?? []) ids.add(id);
      if (summary.headingBlockId) ids.add(summary.headingBlockId);
    }
    return Array.from(ids);
  }, [activeSection, summaryEnabled, ws.book]);
  const activeComments = useMemo<EpubComment[]>(() => {
    if (!summaryEnabled || !activeSection || !ws.book) return [];
    return Object.values(ws.book.comments ?? {}).filter(
      (comment) => comment.sectionId === activeSection.id,
    );
  }, [activeSection, summaryEnabled, ws.book]);

  const readerPanelProps = {
    isFullscreen: isReaderFullscreen,
    onExitFullscreen: exitReaderFullscreen,
    bookTitle: ws.book?.fileName,
    sectionTitle: activeSection?.title ?? `选择${activeSectionUnitLabel}`,
    sectionId: ws.activeSectionId,
    previewHtml: ws.previewHtml,
    documentFormat: activeBookFormat,
    bookBuffer: ws.bookBuffer,
    searchQuery: ws.searchQuery,
    loadingPreview: ws.loadingPreview,
    displayMode,
    onDisplayModeChange: setDisplayMode,
    readerSettings,
    onPatchReaderSettings: patchReaderSettings,
    summaryEnabled,
    summaryText,
    summary: null,
    activeSummaryKey: summaryEnabled ? ws.activeSummaryKey : null,
    isSummaryPlaceholder: summaryEnabled ? isSummaryPlaceholder : true,
    summarizingSection: summaryEnabled ? ws.summarizingSelectedBlocks : false,
    selectedBlockIds: summaryEnabled ? ws.selectedBlockIds : [],
    selectedBlockCount: summaryEnabled ? ws.selectedBlockIds.length : 0,
    selectionAnchorLabel: summaryEnabled ? ws.selectionAnchorLabel : null,
    onSummarizeCurrent: () => void onSummarizeSelectedBlocks(),
    onClearSelection: summaryEnabled ? ws.clearSelectedSummary : undefined,
    onExpandSelectionRange: summaryEnabled ? ws.expandSelectedBlockRange : undefined,
    expandSelectionRangeDisabled: !summaryEnabled || !ws.canExpandSelectedBlockRange,
    onDeleteSummary: () => void ws.deleteActiveSummary(),
    deleteSummaryDisabled: !summaryEnabled || !ws.canDeleteActiveSummary,
    summarizeDisabled:
      !summaryEnabled ||
      !activeSection ||
      ws.summarizingSelectedBlocks ||
      ws.selectedBlockIds.length === 0,
    highlightBlockIds: summaryEnabled && ws.selectedBlockIds.length
      ? ws.selectedBlockIds
      : summaryEnabled
        ? ws.highlightBlockIds
        : [],
    activeBlockId: summaryEnabled ? ws.activeBlockId : null,
    summarizedBlockIds,
    comments: summaryEnabled ? activeComments : [],
    scrollToBlockRequest: ws.scrollToBlockRequest,
    scrollTopRequest: ws.scrollTopRequest,
    inlineSummaryBubbles,
    inlineSummaryAction,
    activeSummaryId: summaryEnabled ? ws.activeSummaryKey : null,
    onSummarizeHeading: (id: string) => void onSummarizeHeading(id),
    onHeadingVisible,
    onReaderBlockClick: summaryEnabled ? ws.selectSummaryBlock : undefined,
    onActivateSummary: summaryEnabled ? ws.activateSummaryKey : undefined,
    onSummarizeSelection: () => void onSummarizeSelectedBlocks(),
    onCommentTextSelection: summaryEnabled ? onCommentTextSelection : undefined,
    onTranslateTextSelection: summaryEnabled
      ? onTranslateTextSelection
      : undefined,
    onDeleteAnnotation: summaryEnabled ? onDeleteAnnotation : undefined,
    onDeleteActiveSummary: () => void ws.deleteActiveSummary(),
    onReaderWindowSectionChange,
    positionLabel: sectionNav.positionLabel,
    onPrevSection: () => sectionNav.goPrev((s) => void onSelectSection(s)),
    onNextSection: () => sectionNav.goNext((s) => void onSelectSection(s)),
    hasPrev: !!sectionNav.prev,
    hasNext: !!sectionNav.next,
    sections: ws.book?.sections ?? [],
    summaries: summaryEnabled ? (ws.book?.summaries ?? {}) : {},
    bookmarks: ws.bookmarks,
    isActiveSectionBookmarked: ws.isActiveSectionBookmarked,
    onToggleBookmark: ws.toggleBookmark,
    onSelectSection: (section: EpubSection) => void onSelectSection(section),
    summaryQueueLabel: summaryEnabled ? ws.summaryQueueLabel : undefined,
    summaryQueuePaused: summaryEnabled ? ws.summaryQueuePaused : false,
    onPauseSummaryQueue: summaryEnabled ? ws.pauseSummaryQueue : undefined,
    onResumeSummaryQueue: summaryEnabled ? ws.resumeSummaryQueue : undefined,
    onCancelSummaryQueue: summaryEnabled
      ? ws.cancelSummaryTasksForCurrentChapter
      : undefined,
    loadingSection: ws.loadingPreview,
  };

  return (
    <div className="reader-shell flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:gap-3 sm:p-3 md:gap-4 md:overflow-hidden md:p-4">
      {!isReaderFullscreen ? (
        <header className="reader-panel flex shrink-0 flex-col gap-3 rounded-lg p-3 backdrop-blur sm:rounded-xl sm:p-4 md:gap-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="reader-icon-tile hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  BookBrief
                </h1>
                <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">
                  本地优先的 EPUB/PDF AI 阅读助手；EPUB 支持总结、批注和翻译，PDF 专注原版阅读、搜索和书签。
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="reader-pill rounded-lg px-2.5 py-1">
                书库 {ws.library.length}
              </span>
              {ws.book ? (
                <span className="reader-pill rounded-lg px-2.5 py-1">
                  {activeSectionUnitLabel} {ws.book.sections.length}
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 flex-col gap-1">
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={onDownloadUrl}
              >
                <Input
                  type="url"
                  value={documentUrl}
                  placeholder="输入 EPUB/PDF URL"
                  className="h-11 min-w-0 bg-white/75 shadow-inner shadow-black/[0.02] sm:h-10 sm:min-w-[260px]"
                  disabled={ws.downloadingUrl}
                  onChange={(e) => {
                    setUrlParamError(null);
                    setDocumentUrl(e.target.value);
                  }}
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 shrink-0 gap-1.5 bg-white/70 sm:h-10"
                  disabled={ws.downloadingUrl || !documentUrl.trim()}
                >
                  <Link className="h-4 w-4" />
                  {ws.downloadingUrl ? "下载中…" : "从 URL 加载"}
                </Button>
              </form>
              {ws.downloadingUrl ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{ws.downloadProgressLabel}</span>
                    {ws.downloadProgressPercent !== null ? (
                      <span className="tabular-nums">
                        {Math.round(ws.downloadProgressPercent)}%
                      </span>
                    ) : null}
                  </div>
                  {ws.downloadProgressPercent !== null ? (
                    <Progress value={ws.downloadProgressPercent} />
                  ) : null}
                </div>
              ) : ws.downloadError || urlParamError ? (
                <p className="text-xs text-destructive">
                  {ws.downloadError ?? urlParamError}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-[44px_44px_minmax(0,1fr)] items-center gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <Button
                variant="outline"
                className="h-11 w-11 gap-1.5 bg-white/70 sm:h-10 sm:w-auto"
                aria-label="设置"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">设置</span>
              </Button>
              <Button
                variant="outline"
                className="h-11 w-11 gap-1.5 bg-white/70 sm:h-10 sm:w-auto"
                disabled={!ws.book}
                aria-label="导出 JSON"
                onClick={() => ws.exportData()}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">导出 JSON</span>
              </Button>
              <Button
                className="h-11 min-w-0 gap-1.5 shadow-sm shadow-primary/15 sm:h-10"
                disabled={ws.uploading || ws.downloadingUrl}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {ws.uploading ? "解析中…" : "上传 EPUB/PDF"}
              </Button>
              <Input
                ref={inputRef}
                type="file"
                accept=".epub,.pdf,application/epub+zip,application/pdf"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </header>
      ) : null}

      {!isReaderFullscreen ? (
        <div className="grid min-h-0 flex-1 gap-3 md:gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
          <Card
            className={`reader-panel-subtle min-h-0 min-w-0 flex-col rounded-xl ${
              ws.book || ws.library.length === 0 ? "hidden md:flex" : "flex"
            }`}
          >
            <CardHeader className="shrink-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                书库
              </CardTitle>
              <CardDescription>本地已保存的 EPUB/PDF</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-4 pb-4">
                {ws.library.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-white/45 px-3 py-5 text-center text-sm text-muted-foreground">
                    暂无书籍
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {ws.library.map((item) => (
                      <li
                        key={item.id}
                        className={`rounded-lg border bg-white/55 p-2 text-sm shadow-sm shadow-black/[0.02] transition ${
                          ws.book?.id === item.id
                            ? "border-primary/35 bg-secondary/65"
                            : "hover:border-primary/25 hover:bg-white/85"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left font-medium"
                          onClick={() => void onOpenLibraryBook(item.id)}
                        >
                          {item.fileName}
                        </button>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {documentFormatLabel(
                            documentFormatForBook(item.fileName, item.format),
                          )}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => void ws.removeBook(item.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:gap-3 md:gap-4">
            {!ws.book ? (
              <Card className="reader-empty-panel reader-panel flex min-h-[340px] flex-1 items-center justify-center rounded-xl border-dashed md:min-h-[420px]">
                <div className="max-w-md space-y-5 px-6 text-center">
                  <div className="reader-icon-tile mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      打开一本 EPUB 或 PDF 开始
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      支持本地上传或 URL 导入。EPUB 可生成本地缓存总结，PDF 保留原版页面、图片和全文搜索。
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      className="gap-1.5 shadow-sm shadow-primary/15"
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      上传 EPUB/PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5 bg-white/70"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <KeyRound className="h-4 w-4" />
                      设置模型
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <Card className="reader-panel-subtle shrink-0 rounded-lg sm:rounded-xl">
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-3 py-2.5 sm:px-4">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-expanded={bookBarExpanded}
                      aria-label={bookBarExpanded ? "收起书籍信息" : "展开书籍信息"}
                      onClick={() => setBookBarExpanded((v) => !v)}
                    >
                      {bookBarExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <CardTitle className="min-w-0 flex-1 truncate text-base">
                      {ws.book.fileName}
                    </CardTitle>
                    {summaryEnabled ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 shrink-0 px-2 text-xs sm:h-7 sm:text-[0.8rem]"
                          disabled={!ws.canExpandSelectedBlockRange}
                          onClick={ws.expandSelectedBlockRange}
                        >
                          <span className="sm:hidden">扩选</span>
                          <span className="hidden sm:inline">选中中间所有段</span>
                        </Button>
                        <Button
                          size="sm"
                          className="h-9 shrink-0 gap-1.5 px-2 text-xs sm:h-7 sm:text-[0.8rem]"
                          disabled={
                            !activeSection ||
                            ws.summarizingSelectedBlocks ||
                            ws.selectedBlockIds.length === 0
                          }
                          onClick={() => void onSummarizeSelectedBlocks()}
                        >
                          {ws.summarizingSelectedBlocks
                            ? (ws.selectedSummaryProgressText ?? "总结中…")
                            : `总结${ws.selectedBlockIds.length ? ` (${ws.selectedBlockIds.length})` : ""}`}
                        </Button>
                      </>
                    ) : null}
                  </CardHeader>
                  {bookBarExpanded ? (
                    <CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
                      <p>
                        {ws.book.sections.length} 个{activeSectionUnitLabel}
                        {activeBookFormat === "epub" ? "（spine）" : "（PDF 书签/页）"}
                      </p>
                    </CardContent>
                  ) : null}
                  {summaryEnabled && ws.summarizingSection ? (
                    <CardContent className="pt-0 pb-3">
                      <Progress
                        value={
                          ws.progress.total
                            ? (ws.progress.done / ws.progress.total) * 100
                            : 0
                        }
                      />
                    </CardContent>
                  ) : null}
                </Card>

                <div className="grid min-h-0 flex-1 gap-3 md:gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
                  <Card className="reader-panel-subtle hidden min-h-0 min-w-0 flex-col rounded-xl md:flex">
                    <CardHeader className="shrink-0 pb-2">
                      <CardTitle className="text-base">阅读工具</CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
                      <EpubReaderTools
                        sections={ws.book.sections}
                        activeSectionId={ws.activeSectionId}
                        summaries={ws.book.summaries}
                        bookmarks={ws.bookmarks}
                        isActiveSectionBookmarked={
                          ws.isActiveSectionBookmarked
                        }
                        searchQuery={ws.searchQuery}
                        searchResults={ws.searchResults}
                        searchingBook={ws.searchingBook}
                        searchError={ws.searchError}
                        onSearchQueryChange={ws.setSearchQuery}
                        onSearch={(query) => void ws.searchBook(query)}
                        onClearSearch={ws.clearSearch}
                        onToggleBookmark={ws.toggleBookmark}
                        onSelectSection={(section) =>
                          void onSelectSection(section)
                        }
                        summaryEnabled={summaryEnabled}
                        summaryTasks={summaryEnabled ? ws.summaryTasks : []}
                        summaryQueueStats={
                          summaryEnabled ? ws.summaryQueueStats : undefined
                        }
                        summaryQueueLabel={
                          summaryEnabled ? ws.summaryQueueLabel : undefined
                        }
                        summaryQueuePaused={
                          summaryEnabled ? ws.summaryQueuePaused : false
                        }
                        autoSummaryOnReading={
                          summaryEnabled ? ws.autoSummaryOnReading : false
                        }
                        onAutoSummaryOnReadingChange={
                          summaryEnabled ? ws.setAutoSummaryOnReading : undefined
                        }
                        onAutoSummarizeCurrent={
                          summaryEnabled ? onAutoSummarizeCurrentChapter : undefined
                        }
                        onPauseSummaryQueue={
                          summaryEnabled ? ws.pauseSummaryQueue : undefined
                        }
                        onResumeSummaryQueue={
                          summaryEnabled ? ws.resumeSummaryQueue : undefined
                        }
                        onCancelSummaryQueue={
                          summaryEnabled
                            ? ws.cancelSummaryTasksForCurrentChapter
                            : undefined
                        }
                        onClearFinishedSummaryTasks={
                          summaryEnabled ? ws.clearFinishedSummaryTasks : undefined
                        }
                        onRetrySummaryTask={
                          summaryEnabled ? ws.retrySummaryTask : undefined
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card className="reader-panel flex min-h-[72dvh] min-w-0 flex-1 flex-col overflow-hidden rounded-lg sm:rounded-xl md:min-h-0">
                    <Tabs
                      value={readerTab}
                      onValueChange={(v) => setActiveTab(v as ReaderPanelTab)}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      <EpubReaderToolbar
                        sectionTitle={activeSection?.title ?? `选择${activeSectionUnitLabel}`}
                        activeTab={readerTab}
                        onTabChange={setActiveTab}
                        displayMode={displayMode}
                        onDisplayModeChange={setDisplayMode}
                        readerSettings={readerSettings}
                        onPatchReaderSettings={patchReaderSettings}
                        onEnterFullscreen={enterReaderFullscreen}
                        isFullscreen={false}
                        summaryEnabled={summaryEnabled}
                        readerSettingsEnabled={activeBookFormat !== "pdf"}
                        positionLabel={sectionNav.positionLabel}
                        onPrevSection={() =>
                          sectionNav.goPrev((s) => void onSelectSection(s))
                        }
                        onNextSection={() =>
                          sectionNav.goNext((s) => void onSelectSection(s))
                        }
                        hasPrev={!!sectionNav.prev}
                        hasNext={!!sectionNav.next}
                      />
                      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-0 pb-2 sm:px-4 sm:pb-4">
                        <TabsContent
                          value="preview"
                          className="mt-0 flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                        >
                          <ReaderContentPane
                            activeTab="preview"
                            loadingPreview={ws.loadingPreview}
                            previewHtml={ws.previewHtml}
                            documentFormat={activeBookFormat}
                            bookBuffer={ws.bookBuffer}
                            sections={ws.book.sections}
                            searchQuery={ws.searchQuery}
                            sectionTitle={activeSection?.title}
                            sectionId={ws.activeSectionId}
                            displayMode={displayMode}
                            readerSettings={readerSettings}
                            layout="embedded"
                            summaryText={summaryText}
                            summary={null}
                            isSummaryPlaceholder={
                              summaryEnabled ? isSummaryPlaceholder : true
                            }
                            summarizing={
                              summaryEnabled ? ws.summarizingSelectedBlocks : false
                            }
                            selectedBlockCount={
                              summaryEnabled ? ws.selectedBlockIds.length : 0
                            }
                            selectionAnchorLabel={
                              summaryEnabled ? ws.selectionAnchorLabel : null
                            }
                            onClearSelection={
                              summaryEnabled ? ws.clearSelectedSummary : undefined
                            }
                            onExpandSelectionRange={
                              summaryEnabled
                                ? ws.expandSelectedBlockRange
                                : undefined
                            }
                            expandSelectionRangeDisabled={
                              !summaryEnabled || !ws.canExpandSelectedBlockRange
                            }
                            onDeleteSummary={() =>
                              void ws.deleteActiveSummary()
                            }
                            deleteSummaryDisabled={
                              !summaryEnabled || !ws.canDeleteActiveSummary
                            }
                            onSummarizeCurrent={() =>
                              activeSection &&
                              void onSummarizeSelectedBlocks()
                            }
                            summarizeDisabled={
                              !summaryEnabled ||
                              !activeSection ||
                              ws.summarizingSelectedBlocks ||
                              ws.selectedBlockIds.length === 0
                            }
                            highlightBlockIds={
                              summaryEnabled && ws.selectedBlockIds.length
                                ? ws.selectedBlockIds
                                : summaryEnabled
                                  ? ws.highlightBlockIds
                                  : []
                            }
                            activeBlockId={summaryEnabled ? ws.activeBlockId : null}
                            summarizedBlockIds={summarizedBlockIds}
                            comments={summaryEnabled ? activeComments : []}
                            selectedBlockIds={
                              summaryEnabled ? ws.selectedBlockIds : []
                            }
                            scrollToBlockRequest={
                              summaryEnabled ? ws.scrollToBlockRequest : null
                            }
                            scrollTopRequest={ws.scrollTopRequest}
                            inlineSummaryBubbles={inlineSummaryBubbles}
                            inlineSummaryAction={inlineSummaryAction}
                            activeSummaryId={
                              summaryEnabled ? ws.activeSummaryKey : null
                            }
                            onSummarizeHeading={(id) =>
                              void onSummarizeHeading(id)
                            }
                            onHeadingVisible={
                              summaryEnabled ? onHeadingVisible : undefined
                            }
                            onReaderBlockClick={
                              summaryEnabled ? ws.selectSummaryBlock : undefined
                            }
                            onSummarizeSelection={() =>
                              void onSummarizeSelectedBlocks()
                            }
                            onCommentTextSelection={
                              summaryEnabled ? onCommentTextSelection : undefined
                            }
                            onTranslateTextSelection={
                              summaryEnabled
                                ? onTranslateTextSelection
                                : undefined
                            }
                            onDeleteAnnotation={
                              summaryEnabled ? onDeleteAnnotation : undefined
                            }
                            onActivateSummary={
                              summaryEnabled ? ws.activateSummaryKey : undefined
                            }
                            onDeleteActiveSummary={() =>
                              void ws.deleteActiveSummary()
                            }
                            onReaderWindowSectionChange={
                              onReaderWindowSectionChange
                            }
                            onEnterImmersive={enterReaderFullscreen}
                          />
                        </TabsContent>
                        {summaryEnabled ? (
                          <TabsContent
                            value="summary"
                            className="mt-0 flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                          >
                            <ReaderContentPane
                              activeTab="summary"
                              loadingPreview={false}
                              previewHtml=""
                              documentFormat={activeBookFormat}
                              bookBuffer={ws.bookBuffer}
                              sections={ws.book.sections}
                              searchQuery={ws.searchQuery}
                              sectionId={ws.activeSectionId}
                              displayMode={displayMode}
                              readerSettings={readerSettings}
                              layout="embedded"
                              summaryText={summaryText}
                              summary={null}
                              isSummaryPlaceholder={isSummaryPlaceholder}
                              summarizing={ws.summarizingSelectedBlocks}
                              selectedBlockCount={ws.selectedBlockIds.length}
                              selectionAnchorLabel={ws.selectionAnchorLabel}
                              onClearSelection={ws.clearSelectedSummary}
                              onExpandSelectionRange={
                                ws.expandSelectedBlockRange
                              }
                              expandSelectionRangeDisabled={
                                !ws.canExpandSelectedBlockRange
                              }
                              onDeleteSummary={() =>
                                void ws.deleteActiveSummary()
                              }
                              deleteSummaryDisabled={
                                !ws.canDeleteActiveSummary
                              }
                              onSummarizeCurrent={() =>
                                activeSection &&
                                void onSummarizeSelectedBlocks()
                              }
                              summarizeDisabled={
                                !activeSection ||
                                ws.summarizingSelectedBlocks ||
                                ws.selectedBlockIds.length === 0
                              }
                              onEnterImmersive={enterReaderFullscreen}
                            />
                          </TabsContent>
                        ) : null}
                      </CardContent>
                    </Tabs>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {!isReaderFullscreen ? (
        <p className="reader-pill hidden w-fit shrink-0 rounded-lg px-2.5 py-1 text-xs sm:block">
          数据仅存于本机浏览器（IndexedDB + localStorage）。AI 请求从浏览器直连模型服务。
        </p>
      ) : null}

      {ws.book && isReaderFullscreen ? (
        <EpubReaderPanel {...readerPanelProps} />
      ) : null}

      {settingsOpen ? (
        <EpubSettingsDialog
          open
          library={ws.library}
          currentBookId={ws.book?.id ?? null}
          onClose={() => setSettingsOpen(false)}
          onExportBook={ws.exportBookBackup}
          onExportCurrentBook={ws.exportCurrentBookBackup}
          onExportLibrary={ws.exportLibraryBackup}
          onImportBackup={ws.importBackupFile}
        />
      ) : null}

      {pendingCommentSelection ? (
        <div
          className="fixed inset-0 z-[10020] flex items-end justify-center bg-black/20 p-3 backdrop-blur-[1px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comment-editor-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseCommentEditor();
          }}
        >
          <div className="w-full max-w-lg rounded-xl border bg-background p-4 shadow-2xl shadow-black/20 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="comment-editor-title"
                  className="text-base font-semibold tracking-tight"
                >
                  添加评论
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  已选择 {pendingCommentSelection.blockIds.length} 个相关段落
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={savingComment}
                onClick={onCloseCommentEditor}
              >
                取消
              </Button>
            </div>
            <blockquote className="mt-3 max-h-28 overflow-y-auto rounded-lg border-l-4 border-primary/40 bg-muted/55 px-3 py-2 text-sm leading-6 text-muted-foreground">
              {pendingCommentSelection.text}
            </blockquote>
            <Textarea
              autoFocus
              value={commentDraft}
              placeholder="写下这段文字的批注..."
              className="mt-3 min-h-28 resize-y bg-white/80"
              disabled={savingComment}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  (event.ctrlKey || event.metaKey) &&
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  void onSaveComment();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCloseCommentEditor();
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={savingComment}
                onClick={onCloseCommentEditor}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={savingComment || !commentDraft.trim()}
                onClick={() => void onSaveComment()}
              >
                {savingComment ? "保存中..." : "保存评论"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
