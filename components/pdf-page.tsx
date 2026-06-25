"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  extractPdfPageText,
  type PdfPageText,
  type PdfTextBlock,
  type PdfTextRect,
} from "@/lib/pdf/sections";
import {
  isPdfRenderCancelled,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from "@/lib/pdf/pdfjs";

type Props = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  fitWidth: boolean;
  zoomScale: number;
  renderEnabled: boolean;
  estimatedBaseSize: { width: number; height: number };
  searchQuery?: string;
  onPageMount?: (pageNumber: number, element: HTMLDivElement | null) => void;
  onPageMetrics?: (
    pageNumber: number,
    metrics: { width: number; height: number },
  ) => void;
};

const PAGE_GUTTER_PX = 40;
const MIN_SCALE = 0.35;
const MAX_SCALE = 3;

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function scaledRect(rect: PdfTextRect, scale: number): PdfTextRect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function rectStyle(rect: PdfTextRect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

function blockSearchMatches(block: PdfTextBlock, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return false;
  return block.text.toLocaleLowerCase().includes(normalized);
}

function searchHighlightClass(blockId: string, searchIds: Set<string>): string | null {
  return searchIds.has(blockId)
    ? "border border-sky-400/45 bg-sky-300/25"
    : null;
}

export function PdfPage({
  doc,
  pageNumber,
  containerWidth,
  fitWidth,
  zoomScale,
  renderEnabled,
  estimatedBaseSize,
  searchQuery = "",
  onPageMount,
  onPageMetrics,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [pageText, setPageText] = useState<PdfPageText | null>(null);
  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 });
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    onPageMount?.(pageNumber, pageRef.current);
    return () => onPageMount?.(pageNumber, null);
  }, [onPageMount, pageNumber]);

  useEffect(() => {
    if (!renderEnabled) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPage(null);
      setPageText(null);
      setRenderError(null);
    });
    doc
      .getPage(pageNumber)
      .then(async (loadedPage) => {
        if (cancelled) return;
        const viewport = loadedPage.getViewport({ scale: 1 });
        setBaseSize({ width: viewport.width, height: viewport.height });
        onPageMetrics?.(pageNumber, {
          width: viewport.width,
          height: viewport.height,
        });
        setPage(loadedPage);
        const text = await extractPdfPageText(loadedPage, { pageNumber });
        if (!cancelled) setPageText(text);
      })
      .catch((error) => {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : "PDF 页面加载失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doc, onPageMetrics, pageNumber, renderEnabled]);

  const effectiveBaseSize = baseSize.width > 0 ? baseSize : estimatedBaseSize;

  const scale = useMemo(() => {
    if (!fitWidth || effectiveBaseSize.width <= 0 || containerWidth <= 0) {
      return clampScale(zoomScale);
    }
    return clampScale((containerWidth - PAGE_GUTTER_PX) / effectiveBaseSize.width);
  }, [containerWidth, effectiveBaseSize.width, fitWidth, zoomScale]);

  const cssSize = useMemo(
    () => ({
      width: Math.max(0, effectiveBaseSize.width * scale),
      height: Math.max(0, effectiveBaseSize.height * scale),
    }),
    [effectiveBaseSize.height, effectiveBaseSize.width, scale],
  );

  useEffect(() => {
    if (
      !renderEnabled ||
      !page ||
      !canvasRef.current ||
      cssSize.width <= 0 ||
      cssSize.height <= 0
    ) {
      return;
    }

    try {
      renderTaskRef.current?.cancel();
    } catch {
      /* render task may already be settled */
    }
    renderTaskRef.current = null;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const viewport = page.getViewport({ scale });
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context?.setTransform(1, 0, 0, 1, 0, 0);
    context?.clearRect(0, 0, canvas.width, canvas.height);

    let disposed = false;
    const renderTask = page.render({
      canvas,
      viewport,
      transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      background: "rgb(255,255,255)",
    });
    renderTaskRef.current = renderTask;
    renderTask.promise.catch((error) => {
      if (disposed || isPdfRenderCancelled(error)) return;
      setRenderError(error instanceof Error ? error.message : "PDF 页面渲染失败");
    });

    return () => {
      disposed = true;
      try {
        renderTask.cancel();
      } catch {
        /* render task may already be settled */
      }
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    };
  }, [cssSize.height, cssSize.width, page, renderEnabled, scale]);

  const searchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of pageText?.blocks ?? []) {
      if (blockSearchMatches(block, searchQuery)) ids.add(block.id);
    }
    return ids;
  }, [pageText, searchQuery]);

  const blockHighlightRects = useMemo(() => {
    const blocks = pageText?.blocks ?? [];
    return blocks.flatMap((block) => {
      const className = searchHighlightClass(block.id, searchIds);
      if (!className) return [];
      return block.rects.map((rect, index) => ({
        key: `${block.id}-${index}`,
        blockId: block.id,
        className,
        rect: scaledRect(rect, scale),
      }));
    });
  }, [pageText, scale, searchIds]);

  return (
    <div
      ref={pageRef}
      className="pdf-page-shell relative shrink-0"
      data-pdf-page={pageNumber}
      data-pdf-render-enabled={renderEnabled ? "true" : "false"}
      data-reader-window-section-id={`page-${pageNumber}`}
    >
      <div
        className="relative overflow-hidden bg-white shadow-lg shadow-black/15 ring-1 ring-black/10"
        style={{
          width: cssSize.width || 320,
          height: cssSize.height || 420,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0 h-full w-full bg-white"
          aria-label={`PDF 第 ${pageNumber} 页`}
        />
        <div className="pointer-events-none absolute inset-0 z-10">
          {renderEnabled ? blockHighlightRects.map((item) => (
            <div
              key={item.key}
              data-pdf-block-id={item.blockId}
              className={`absolute rounded-[2px] ${item.className}`}
              style={rectStyle(item.rect)}
            />
          )) : null}
        </div>
        <div className="absolute inset-0 z-20 select-text">
          {renderEnabled ? (pageText?.spans ?? []).map((span) => {
            if (!span.rect) return null;
            const rect = scaledRect(span.rect, scale);
            return (
              <span
                key={`${span.blockId}-${span.itemIndex}`}
                data-pdf-block-id={span.blockId}
                className="absolute block cursor-text whitespace-pre text-transparent"
                style={{
                  ...rectStyle(rect),
                  fontSize: `${Math.max(1, rect.height)}px`,
                  lineHeight: `${Math.max(1, rect.height)}px`,
                }}
              >
                {span.text}
              </span>
            );
          }) : null}
        </div>
        {renderError ? (
          <div className="absolute inset-x-4 top-4 z-30 rounded border border-destructive/30 bg-white/95 px-3 py-2 text-xs text-destructive shadow">
            {renderError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
