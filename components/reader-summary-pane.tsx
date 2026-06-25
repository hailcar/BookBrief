"use client";

import { Copy, Download, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SummaryMarkdown } from "@/components/summary-markdown";
import { Button } from "@/components/ui/button";
import type { SectionSummary } from "@/lib/types";

type Props = {
  summaryText: string;
  onSummarizeCurrent: () => void;
  summarizeDisabled: boolean;
  className?: string;
  sectionTitle?: string;
  summary?: SectionSummary | null;
  isPlaceholder?: boolean;
  summarizing?: boolean;
  selectedBlockCount?: number;
  selectionAnchorLabel?: string | null;
  onClearSelection?: () => void;
  onExpandSelectionRange?: () => void;
  expandSelectionRangeDisabled?: boolean;
  onDeleteSummary?: () => void;
  deleteSummaryDisabled?: boolean;
};

export function ReaderSummaryPane({
  summaryText,
  onSummarizeCurrent,
  summarizeDisabled,
  className,
  sectionTitle,
  summary,
  isPlaceholder = false,
  summarizing = false,
  selectedBlockCount = 0,
  selectionAnchorLabel,
  onClearSelection,
  onExpandSelectionRange,
  expandSelectionRangeDisabled = true,
  onDeleteSummary,
  deleteSummaryDisabled = true,
}: Props) {
  const canUseSummary = !isPlaceholder && summaryText.trim().length > 0;

  const copySummary = async () => {
    if (!canUseSummary) return;
    await navigator.clipboard.writeText(summaryText);
    toast.success("总结已复制");
  };

  const downloadSummary = () => {
    if (!canUseSummary) return;
    const safeTitle = (sectionTitle || "section-summary")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .slice(0, 80);
    const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle || "section-summary"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-3 overflow-hidden ${className ?? ""}`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">
            {sectionTitle || "当前总结"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {selectedBlockCount > 0
              ? `已选 ${selectedBlockCount} 段${selectionAnchorLabel ? ` · 锚点：${selectionAnchorLabel}` : ""}`
              : summary
              ? `${summary.mode === "heading_section_summary" ? "标题小节" : "整节按段"} · ${summary.model} · ${new Date(summary.updatedAt).toLocaleString()}`
              : "尚未生成总结"}
          </p>
          {selectedBlockCount > 0 && !summarizing ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ctrl/Cmd 选择前后两段，再点选中中间所有段。
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={!canUseSummary}
            aria-label="复制总结"
            onClick={() => void copySummary()}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={!canUseSummary}
            aria-label="下载当前总结"
            onClick={downloadSummary}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={expandSelectionRangeDisabled || !onExpandSelectionRange}
            onClick={onExpandSelectionRange}
          >
            选中中间所有段
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={summarizeDisabled}
            onClick={onSummarizeCurrent}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${summarizing ? "animate-spin" : ""}`} />
            {summarizing ? "总结中..." : "总结所选段落"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={deleteSummaryDisabled || !onDeleteSummary}
            onClick={onDeleteSummary}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除总结
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={selectedBlockCount === 0 || !onClearSelection}
            onClick={onClearSelection}
          >
            <X className="h-3.5 w-3.5" />
            清除选择
          </Button>
        </div>
      </div>
      <div className="summary-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-card/95 px-4 py-3 shadow-sm">
        {isPlaceholder ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summaryText}
          </p>
        ) : (
          <SummaryMarkdown content={summaryText} />
        )}
      </div>
    </div>
  );
}
