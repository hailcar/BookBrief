"use client";

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
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div
        className="inline-flex flex-wrap rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs shadow-sm"
        role="group"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`rounded px-2.5 py-1.5 transition-colors ${
              value === o.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  readerSettings: ReaderSettings;
  onPatchReaderSettings: (patch: Partial<ReaderSettings>) => void;
  displayMode: EpubDisplayMode;
  onDisplayModeChange: (mode: EpubDisplayMode) => void;
};

export function ReaderSettingsControls({
  readerSettings,
  onPatchReaderSettings,
  displayMode,
  onDisplayModeChange,
}: Props) {
  return (
    <div className="space-y-4">
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
        options={(["small", "default", "large"] as const).map((id) => ({
          id,
          label: READER_FONT_SIZE_LABELS[id],
        }))}
        onChange={(v) =>
          onPatchReaderSettings({ fontSize: v as ReaderFontSize })
        }
      />
      <Segmented
        label="正文宽度"
        value={readerSettings.contentWidth}
        options={(["narrow", "standard", "wide"] as const).map((id) => ({
          id,
          label: READER_CONTENT_WIDTH_LABELS[id],
        }))}
        onChange={(v) =>
          onPatchReaderSettings({ contentWidth: v as ReaderContentWidth })
        }
      />
      <Segmented
        label="图片显示"
        value={readerSettings.imageMode}
        options={(["contain", "original", "full-width"] as const).map(
          (id) => ({
            id,
            label: READER_IMAGE_MODE_LABELS[id],
          }),
        )}
        onChange={(v) =>
          onPatchReaderSettings({ imageMode: v as ReaderImageMode })
        }
      />
    </div>
  );
}
