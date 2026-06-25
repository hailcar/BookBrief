"use client";

import { Maximize2 } from "lucide-react";
import { EpubSectionPreview } from "@/components/epub-section-preview";
import { PdfReader } from "@/components/pdf-reader";
import { ReaderSummaryPane } from "@/components/reader-summary-pane";
import { Button } from "@/components/ui/button";
import type { EpubDisplayMode, EpubReaderLayout } from "@/lib/epub-display";
import type { ReaderSettings } from "@/lib/reader-settings";
import type { ReaderPanelTab } from "@/components/epub-reader-toolbar";
import type {
  DocumentFormat,
  EpubComment,
  EpubSection,
  InlineSummaryActionState,
  InlineSummaryBubble,
  SectionSummary,
} from "@/lib/types";

type Props = {
  activeTab: ReaderPanelTab;
  loadingPreview: boolean;
  previewHtml: string;
  documentFormat?: DocumentFormat | null;
  bookBuffer?: ArrayBuffer | null;
  sections?: EpubSection[];
  searchQuery?: string;
  sectionTitle?: string;
  sectionId: string | null;
  displayMode: EpubDisplayMode;
  readerSettings: ReaderSettings;
  layout: EpubReaderLayout;
  summaryText: string;
  summary?: SectionSummary | null;
  isSummaryPlaceholder?: boolean;
  summarizing?: boolean;
  selectedBlockCount?: number;
  selectionAnchorLabel?: string | null;
  onClearSelection?: () => void;
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
  activeSummaryId?: string | null;
  onExpandSelectionRange?: () => void;
  expandSelectionRangeDisabled?: boolean;
  onDeleteSummary?: () => void;
  deleteSummaryDisabled?: boolean;
  onSummarizeHeading?: (headingBlockId: string) => void;
  onHeadingVisible?: (headingBlockId: string) => void;
  onReaderBlockClick?: (
    blockId: string,
    modifiers?: { ctrlKey?: boolean; metaKey?: boolean },
  ) => void;
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
  onEnterImmersive?: () => void;
};

export function ReaderContentPane({
  activeTab,
  loadingPreview,
  previewHtml,
  documentFormat,
  bookBuffer,
  sections,
  searchQuery,
  sectionTitle,
  sectionId,
  displayMode,
  readerSettings,
  layout,
  summaryText,
  summary,
  isSummaryPlaceholder,
  summarizing,
  selectedBlockCount,
  selectionAnchorLabel,
  onClearSelection,
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
  activeSummaryId,
  onExpandSelectionRange,
  expandSelectionRangeDisabled,
  onDeleteSummary,
  deleteSummaryDisabled,
  onSummarizeHeading,
  onHeadingVisible,
  onReaderBlockClick,
  onSummarizeSelection,
  onCommentTextSelection,
  onTranslateTextSelection,
  onDeleteAnnotation,
  onActivateSummary,
  onDeleteActiveSummary,
  onReaderWindowSectionChange,
  onEnterImmersive,
}: Props) {
  const withEnterImmersive = (content: React.ReactNode) => {
    if (layout === "fullscreen" || !onEnterImmersive) return content;
    return (
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
        {content}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 h-12 w-12 rounded-full border bg-background/95 shadow-xl backdrop-blur hover:bg-background md:absolute md:right-4 md:bottom-4 md:z-30 md:h-10 md:w-10"
          aria-label="放大进入沉浸阅读"
          title="放大进入沉浸阅读"
          onClick={onEnterImmersive}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  if (activeTab === "summary" && documentFormat !== "pdf") {
    return withEnterImmersive(
      <ReaderSummaryPane
        className={layout === "fullscreen" ? "p-3 md:p-4" : "pt-1"}
        summaryText={summaryText}
        sectionTitle={sectionTitle}
        summary={summary}
        isPlaceholder={isSummaryPlaceholder}
        summarizing={summarizing}
        selectedBlockCount={selectedBlockCount}
        selectionAnchorLabel={selectionAnchorLabel}
        onClearSelection={onClearSelection}
        onExpandSelectionRange={onExpandSelectionRange}
        expandSelectionRangeDisabled={expandSelectionRangeDisabled}
        onDeleteSummary={onDeleteSummary}
        deleteSummaryDisabled={deleteSummaryDisabled}
        onSummarizeCurrent={onSummarizeCurrent}
        summarizeDisabled={summarizeDisabled}
      />,
    );
  }

  if (documentFormat === "pdf") {
    return withEnterImmersive(
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
        <PdfReader
          arrayBuffer={bookBuffer ?? null}
          sections={sections ?? []}
          sectionId={sectionId}
          layout={layout}
          loadingPreview={loadingPreview}
          searchQuery={searchQuery}
          scrollTopRequest={scrollTopRequest}
          onReaderWindowSectionChange={onReaderWindowSectionChange}
        />
      </div>,
    );
  }

  if (loadingPreview && !previewHtml) {
    return withEnterImmersive(
      <p className="shrink-0 p-3 text-sm text-muted-foreground">加载预览…</p>
    );
  }

  if (!previewHtml) {
    return withEnterImmersive(
      <p className="shrink-0 p-3 text-sm text-muted-foreground">
        点击目录位置查看内容
      </p>
    );
  }

  return withEnterImmersive(
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
      <EpubSectionPreview
        html={previewHtml}
        title={sectionTitle}
        displayMode={displayMode}
        readerSettings={readerSettings}
        layout={layout}
        sectionId={sectionId}
        highlightBlockIds={highlightBlockIds}
        activeBlockId={activeBlockId}
        summarizedBlockIds={summarizedBlockIds}
        selectedBlockIds={selectedBlockIds}
        comments={comments}
        scrollToBlockRequest={scrollToBlockRequest}
        scrollTopRequest={scrollTopRequest}
        inlineSummaryBubbles={inlineSummaryBubbles}
        inlineSummaryAction={inlineSummaryAction}
        activeSummaryId={activeSummaryId}
        onSummarizeHeading={onSummarizeHeading}
        onHeadingVisible={onHeadingVisible}
        onReaderBlockClick={onReaderBlockClick}
        onClearSelection={onClearSelection}
        onSummarizeSelection={onSummarizeSelection}
        onCommentTextSelection={onCommentTextSelection}
        onTranslateTextSelection={onTranslateTextSelection}
        onDeleteAnnotation={onDeleteAnnotation}
        onActivateSummary={onActivateSummary}
        onDeleteActiveSummary={onDeleteActiveSummary}
        onReaderWindowSectionChange={onReaderWindowSectionChange}
      />
      {loadingPreview ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full border border-border/60 bg-background/85 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          加载中…
        </div>
      ) : null}
    </div>,
  );
}
