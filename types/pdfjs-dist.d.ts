declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export type PageViewport = {
    width: number;
    height: number;
    scale: number;
    transform: number[];
    convertToViewportRectangle(rect: number[]): number[];
  };

  export type RenderTask = {
    promise: Promise<void>;
    cancel(): void;
  };

  export type PDFDocumentProxy = {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    getMetadata(): Promise<{ info?: unknown; metadata?: unknown }>;
    getOutline?: () => Promise<unknown[] | null>;
    getDestination?: (destinationId: string) => Promise<unknown[] | null>;
    getPageIndex?: (ref: unknown) => Promise<number>;
  };

  export type PDFPageProxy = {
    getTextContent(): Promise<{ items: unknown[] }>;
    getViewport(params: { scale: number; rotation?: number }): PageViewport;
    render(params: {
      canvas?: HTMLCanvasElement | null;
      canvasContext?: CanvasRenderingContext2D;
      viewport: PageViewport;
      transform?: number[];
      background?: string | CanvasGradient | CanvasPattern;
    }): RenderTask;
  };

  export type PDFDocumentLoadingTask = {
    promise: Promise<PDFDocumentProxy>;
    destroy(): Promise<void>;
  };

  export function getDocument(params: {
    data: Uint8Array;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
    wasmUrl?: string;
    iccUrl?: string;
    useWorkerFetch?: boolean;
    useWasm?: boolean;
  }): PDFDocumentLoadingTask;
}
