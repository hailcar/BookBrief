import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("pdf.js loader assets", () => {
  it("passes bundled pdf.js asset directories to document loading", () => {
    const loader = source("lib/pdf/pdfjs.ts");

    expect(loader).toContain('publicAssetUrl("/pdfjs/cmaps/")');
    expect(loader).toContain('publicAssetUrl("/pdfjs/standard_fonts/")');
    expect(loader).toContain('publicAssetUrl("/pdfjs/wasm/")');
    expect(loader).toContain('publicAssetUrl("/pdfjs/iccs/")');
    expect(loader).toContain("useWorkerFetch: true");
    expect(loader).toContain("useWasm: true");
  });
});
