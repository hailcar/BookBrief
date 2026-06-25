"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EpubDisplayMode } from "@/lib/epub-display";
import { EPUB_DISPLAY_MODE_LABELS } from "@/lib/epub-display";
import {
  READER_CONTENT_WIDTH_LABELS,
  READER_FONT_SIZE_LABELS,
  READER_IMAGE_MODE_LABELS,
  type ReaderContentWidth,
  type ReaderFontSize,
  type ReaderImageMode,
  type ReaderSettings,
} from "@/lib/reader-settings";

export type ReaderPanelTab = "preview" | "summary";

type Props = {
  sectionTitle: string;
  activeTab: ReaderPanelTab;
  onTabChange: (tab: ReaderPanelTab) => void;
  displayMode: EpubDisplayMode;
  onDisplayModeChange: (mode: EpubDisplayMode) => void;
  readerSettings: ReaderSettings;
  onPatchReaderSettings: (patch: Partial<ReaderSettings>) => void;
  onExitFullscreen?: () => void;
  onEnterFullscreen?: () => void;
  isFullscreen: boolean;
  summaryEnabled?: boolean;
  readerSettingsEnabled?: boolean;
  compact?: boolean;
  positionLabel?: string | null;
  onPrevSection?: () => void;
  onNextSection?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  bookTitle?: string;
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-border/75 bg-white/55 p-0.5 text-xs shadow-sm shadow-black/[0.02]"
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`rounded-md px-2 py-1 transition-colors ${
            value === o.id
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/15"
              : "text-muted-foreground hover:bg-white/75 hover:text-foreground"
          }`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EpubReaderToolbar({
  sectionTitle,
  activeTab,
  onTabChange,
  displayMode,
  onDisplayModeChange,
  readerSettings,
  onPatchReaderSettings,
  onExitFullscreen,
  onEnterFullscreen,
  isFullscreen,
  summaryEnabled = true,
  readerSettingsEnabled = true,
  compact = false,
  positionLabel,
  onPrevSection,
  onNextSection,
  hasPrev = false,
  hasNext = false,
  bookTitle,
}: Props) {
  const fontOptions = (["small", "default", "large"] as const).map((id) => ({
    id,
    label: READER_FONT_SIZE_LABELS[id],
  }));
  const widthOptions = (["narrow", "standard", "wide", "full"] as const).map(
    (id) => ({
      id,
      label: READER_CONTENT_WIDTH_LABELS[id],
    }),
  );
  const imageOptions = (
    ["contain", "original", "full-width"] as const
  ).map((id) => ({
    id,
    label: READER_IMAGE_MODE_LABELS[id],
  }));

  const showNav = onPrevSection && onNextSection;

  return (
    <div
      className={`flex shrink-0 flex-col gap-2 border-b border-border/70 bg-card/80 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-3 ${
        isFullscreen ? "border-border/60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {showNav ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
                disabled={!hasPrev}
                aria-label="上一节"
                onClick={onPrevSection}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
                disabled={!hasNext}
                aria-label="下一节"
                onClick={onNextSection}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          <div className="min-w-0 flex-1">
            {isFullscreen && bookTitle ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {bookTitle}
              </p>
            ) : null}
            <p className="min-w-0 truncate text-sm font-medium">
              {sectionTitle || "选择位置"}
            </p>
          </div>
          {positionLabel ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {positionLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isFullscreen ? (
            <Button
              size="sm"
              variant="outline"
              className="h-10 sm:h-7"
              onClick={onExitFullscreen}
            >
              退出沉浸
            </Button>
          ) : onEnterFullscreen ? (
            <Button
              size="sm"
              variant="outline"
              className="h-10 bg-white/60 sm:h-7"
              onClick={onEnterFullscreen}
            >
              沉浸阅读
            </Button>
          ) : null}
          {summaryEnabled ? (
            <Segmented
              label="阅读面板"
              value={activeTab}
              options={[
                { id: "preview", label: "预览" },
                { id: "summary", label: "总结" },
              ]}
              onChange={onTabChange}
            />
          ) : null}
        </div>
      </div>
      {!compact && readerSettingsEnabled ? (
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Segmented
            label="版式"
            value={displayMode}
            options={(["global", "publisher"] as const).map((id) => ({
              id,
              label: EPUB_DISPLAY_MODE_LABELS[id],
            }))}
            onChange={onDisplayModeChange}
          />
          <Segmented
            label="字号"
            value={readerSettings.fontSize}
            options={fontOptions}
            onChange={(v) =>
              onPatchReaderSettings({ fontSize: v as ReaderFontSize })
            }
          />
          <Segmented
            label="正文宽度"
            value={readerSettings.contentWidth}
            options={widthOptions}
            onChange={(v) =>
              onPatchReaderSettings({ contentWidth: v as ReaderContentWidth })
            }
          />
          <Segmented
            label="图片"
            value={readerSettings.imageMode}
            options={imageOptions}
            onChange={(v) =>
              onPatchReaderSettings({ imageMode: v as ReaderImageMode })
            }
          />
        </div>
      ) : null}
      {isFullscreen ? (
        <p className="text-[11px] text-muted-foreground">
          Esc 退出沉浸 · ← → 切换位置
        </p>
      ) : null}
    </div>
  );
}
