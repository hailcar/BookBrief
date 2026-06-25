"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Maximize2, Minus, Plus } from "lucide-react";
import { PdfPage } from "@/components/pdf-page";
import { Button } from "@/components/ui/button";
import {
  pageNumberFromPdfPageAnchorId,
  pdfPageAnchorIdForSection,
} from "@/lib/documents";
import {
  getPdfDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "@/lib/pdf/pdfjs";
import type { EpubSection } from "@/lib/types";

type Props = {
  arrayBuffer: ArrayBuffer | null;
  sections: EpubSection[];
  sectionId: string | null;
  layout?: "embedded" | "fullscreen";
  loadingPreview?: boolean;
  searchQuery?: string;
  scrollTopRequest?: { top: number; sectionId?: string; nonce: number } | null;
  onReaderWindowSectionChange?: (sectionId: string, offset: number) => void;
};

type ZoomMode = "fit" | "custom";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function pageNumberForSection(
  sectionId: string | null | undefined,
  sections: EpubSection[],
): number | null {
  if (!sectionId) return null;
  const fromAnchor = pageNumberFromPdfPageAnchorId(sectionId);
  if (fromAnchor) return fromAnchor;
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return null;
  const pageAnchor = pdfPageAnchorIdForSection(section);
  return pageAnchor ? pageNumberFromPdfPageAnchorId(pageAnchor) : null;
}

export function PdfReader({
  arrayBuffer,
  sections,
  sectionId,
  layout = "embedded",
  loadingPreview = false,
  searchQuery,
  scrollTopRequest,
  onReaderWindowSectionChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageObserverRef = useRef<IntersectionObserver | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const lastHandledScrollNonceRef = useRef<number | null>(null);
  const lastReportedRef = useRef<{ sectionId: string; offset: number } | null>(
    null,
  );
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [zoomScale, setZoomScale] = useState(1);
  const [renderPageNumbers, setRenderPageNumbers] = useState<Set<number>>(
    () => new Set([1]),
  );
  const [pageMetrics, setPageMetrics] = useState<
    Record<number, { width: number; height: number }>
  >({});

  useEffect(() => {
    if (!arrayBuffer) {
      let disposed = false;
      queueMicrotask(() => {
        if (disposed) return;
        setDoc(null);
        setLoading(false);
        setError(null);
      });
      return () => {
        disposed = true;
      };
    }

    let disposed = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    pageRefs.current.clear();
    queueMicrotask(() => {
      if (disposed) return;
      setLoading(true);
      setError(null);
      setDoc(null);
      setPageMetrics({});
    });

    void getPdfDocument(arrayBuffer)
      .then(async (task) => {
        loadingTask = task;
        const loadedDoc = await task.promise;
        if (!disposed) setDoc(loadedDoc);
      })
      .catch((err) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "PDF 加载失败");
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
      void loadingTask?.destroy().catch(() => undefined);
    };
  }, [arrayBuffer]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const currentFitScale = useMemo(() => {
    const first = pageMetrics[1];
    if (!first?.width || !containerWidth) return 1;
    return clampZoom((containerWidth - 40) / first.width);
  }, [containerWidth, pageMetrics]);

  const visibleZoomLabel =
    zoomMode === "fit"
      ? "适宽"
      : `${Math.round(clampZoom(zoomScale) * 100)}%`;

  const onPageMount = useCallback(
    (pageNumber: number, element: HTMLDivElement | null) => {
      if (element) {
        pageRefs.current.set(pageNumber, element);
        pageObserverRef.current?.observe(element);
      } else {
        const previous = pageRefs.current.get(pageNumber);
        if (previous) pageObserverRef.current?.unobserve(previous);
        pageRefs.current.delete(pageNumber);
      }
    },
    [],
  );

  useEffect(() => {
    if (!doc) {
      let disposed = false;
      queueMicrotask(() => {
        if (!disposed) setRenderPageNumbers(new Set([1]));
      });
      return () => {
        disposed = true;
      };
    }

    const scroller = scrollRef.current;
    if (!scroller) return;
    let disposed = false;

    const observer = new IntersectionObserver(
      (entries) => {
        setRenderPageNumbers((current) => {
          let next = current;
          for (const entry of entries) {
            const pageNumber = Number(
              (entry.target as HTMLElement).dataset.pdfPage,
            );
            if (!Number.isFinite(pageNumber) || pageNumber < 1) continue;
            if (entry.isIntersecting) {
              if (!next.has(pageNumber)) {
                if (next === current) next = new Set(current);
                next.add(pageNumber);
              }
            } else if (pageNumber !== 1 && next.has(pageNumber)) {
              if (next === current) next = new Set(current);
              next.delete(pageNumber);
            }
          }
          return next;
        });
      },
      {
        root: scroller,
        rootMargin: "1800px 0px",
        threshold: 0.01,
      },
    );

    pageObserverRef.current = observer;
    pageRefs.current.forEach((element) => observer.observe(element));
    queueMicrotask(() => {
      if (!disposed) setRenderPageNumbers(new Set([1]));
    });

    return () => {
      disposed = true;
      observer.disconnect();
      if (pageObserverRef.current === observer) {
        pageObserverRef.current = null;
      }
    };
  }, [doc]);

  const onPageMetrics = useCallback(
    (pageNumber: number, metrics: { width: number; height: number }) => {
      setPageMetrics((current) => {
        const existing = current[pageNumber];
        if (
          existing?.width === metrics.width &&
          existing.height === metrics.height
        ) {
          return current;
        }
        return { ...current, [pageNumber]: metrics };
      });
    },
    [],
  );

  const scrollToPage = useCallback(
    (pageNumber: number, offset = 0) => {
      const scroller = scrollRef.current;
      const target = pageRefs.current.get(pageNumber);
      if (!scroller || !target) return false;
      scroller.scrollTo({
        top: Math.max(0, target.offsetTop + offset),
        behavior: "auto",
      });
      return true;
    },
    [],
  );

  useEffect(() => {
    if (!doc || !scrollTopRequest) return;
    if (lastHandledScrollNonceRef.current === scrollTopRequest.nonce) return;
    lastHandledScrollNonceRef.current = scrollTopRequest.nonce;
    const targetPage =
      pageNumberForSection(scrollTopRequest.sectionId, sections) ??
      pageNumberForSection(sectionId, sections) ??
      1;
    const run = () => {
      if (!scrollToPage(targetPage, scrollTopRequest.top)) {
        window.setTimeout(() => scrollToPage(targetPage, scrollTopRequest.top), 80);
      }
    };
    requestAnimationFrame(run);
  }, [doc, scrollToPage, scrollTopRequest, sectionId, sections]);

  const reportActivePage = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const viewportTop = scroller.scrollTop;
    const probe = viewportTop + scroller.clientHeight * 0.28;
    let bestPage = 1;
    let bestTop = 0;

    for (const [pageNumber, element] of pageRefs.current.entries()) {
      const top = element.offsetTop;
      const bottom = top + element.offsetHeight;
      if (probe >= top && probe < bottom) {
        bestPage = pageNumber;
        bestTop = top;
        break;
      }
      if (top <= probe) {
        bestPage = pageNumber;
        bestTop = top;
      }
    }

    const next = {
      sectionId: `page-${bestPage}`,
      offset: Math.max(0, Math.round(viewportTop - bestTop)),
    };
    const previous = lastReportedRef.current;
    if (
      previous?.sectionId === next.sectionId &&
      Math.abs(previous.offset - next.offset) < 24
    ) {
      return;
    }
    lastReportedRef.current = next;
    onReaderWindowSectionChange?.(next.sectionId, next.offset);
  }, [onReaderWindowSectionChange]);

  const onScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      reportActivePage();
    });
  }, [reportActivePage]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const zoomIn = () => {
    setZoomMode("custom");
    setZoomScale((current) =>
      clampZoom((zoomMode === "fit" ? currentFitScale : current) + ZOOM_STEP),
    );
  };

  const zoomOut = () => {
    setZoomMode("custom");
    setZoomScale((current) =>
      clampZoom((zoomMode === "fit" ? currentFitScale : current) - ZOOM_STEP),
    );
  };

  const actualSize = () => {
    setZoomMode("custom");
    setZoomScale(1);
  };

  const fitWidth = () => {
    setZoomMode("fit");
  };

  const pageNumbers = useMemo(
    () =>
      doc
        ? Array.from({ length: doc.numPages }, (_, index) => index + 1)
        : [],
    [doc],
  );

  const estimatedPageMetrics = useMemo(() => {
    const firstPageMetrics = pageMetrics[1];
    if (firstPageMetrics) return firstPageMetrics;
    return Object.values(pageMetrics)[0] ?? { width: 612, height: 792 };
  }, [pageMetrics]);

  const wrapClass =
    layout === "fullscreen"
      ? "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-neutral-200"
      : "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-200 shadow-inner";

  return (
    <div className={wrapClass} data-pdf-reader>
      <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/10 bg-white/90 px-1.5 py-1 text-xs shadow-lg backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          aria-label="缩小 PDF"
          title="缩小 PDF"
          onClick={zoomOut}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          className="h-7 min-w-14 rounded-full px-2 font-medium text-neutral-700 hover:bg-neutral-100"
          onClick={fitWidth}
          title="适合宽度"
        >
          {visibleZoomLabel}
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          aria-label="放大 PDF"
          title="放大 PDF"
          onClick={zoomIn}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          aria-label="原始大小"
          title="原始大小"
          onClick={actualSize}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={zoomMode === "fit" ? "secondary" : "ghost"}
          className="h-7 w-7 rounded-full"
          aria-label="适合宽度"
          title="适合宽度"
          onClick={fitWidth}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading || loadingPreview ? (
        <div className="pointer-events-none absolute right-3 top-3 z-40 rounded-full border border-black/10 bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          加载中…
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="h-full min-h-0 flex-1 overflow-auto px-3 pb-8 pt-14"
        onScroll={onScroll}
      >
        {!arrayBuffer ? (
          <p className="p-3 text-sm text-muted-foreground">点击目录位置查看内容</p>
        ) : error ? (
          <div className="mx-auto mt-16 max-w-md rounded-lg border border-destructive/30 bg-white px-4 py-3 text-sm text-destructive shadow">
            {error}
          </div>
        ) : !doc ? (
          <p className="p-3 text-sm text-muted-foreground">加载 PDF…</p>
        ) : (
          <div className="mx-auto flex w-fit min-w-0 flex-col items-center gap-4">
            {pageNumbers.map((pageNumber) => (
              <PdfPage
                key={pageNumber}
                doc={doc}
                pageNumber={pageNumber}
                containerWidth={containerWidth}
                fitWidth={zoomMode === "fit"}
                zoomScale={zoomScale}
                renderEnabled={renderPageNumbers.has(pageNumber)}
                estimatedBaseSize={estimatedPageMetrics}
                searchQuery={searchQuery}
                onPageMount={onPageMount}
                onPageMetrics={onPageMetrics}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
