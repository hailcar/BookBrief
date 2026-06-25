import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";

export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
  RenderTask,
};

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfJsPromise: Promise<PdfJsModule> | null = null;

function publicAssetUrl(path: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URL(path, window.location.origin).toString();
}

function pdfDocumentOptions() {
  const cMapUrl = publicAssetUrl("/pdfjs/cmaps/");
  const standardFontDataUrl = publicAssetUrl("/pdfjs/standard_fonts/");
  const wasmUrl = publicAssetUrl("/pdfjs/wasm/");
  const iccUrl = publicAssetUrl("/pdfjs/iccs/");

  if (!cMapUrl || !standardFontDataUrl || !wasmUrl || !iccUrl) {
    return {};
  }

  return {
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    wasmUrl,
    iccUrl,
    useWorkerFetch: true,
    useWasm: true,
  };
}

export async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
      }
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

export function dataForPdf(arrayBuffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(arrayBuffer.slice(0));
}

export async function getPdfDocument(
  arrayBuffer: ArrayBuffer,
): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    data: dataForPdf(arrayBuffer),
    ...pdfDocumentOptions(),
  });
}

export function isPdfRenderCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "RenderingCancelledException";
}
