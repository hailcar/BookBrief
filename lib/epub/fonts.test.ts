import { describe, expect, it } from "vitest";
import { inferEpubFontFace } from "@/lib/epub/fonts";

describe("inferEpubFontFace", () => {
  it("recognizes the O'Reilly EPUB font names from the referenced book", () => {
    expect(inferEpubFontFace("OEBPS/DejaVuSerif.otf", "blob:serif")).toMatchObject(
      {
        family: "DejaVu Serif",
        weight: 400,
        style: "normal",
        format: "opentype",
      },
    );
    expect(
      inferEpubFontFace("OEBPS/DejaVuSans-Bold.otf", "blob:sans-bold"),
    ).toMatchObject({
      family: "DejaVu Sans",
      weight: 700,
      style: "normal",
      format: "opentype",
    });
    expect(
      inferEpubFontFace("OEBPS/UbuntuMono-BoldItalic.otf", "blob:mono-bold-italic"),
    ).toMatchObject({
      family: "Ubuntu Mono",
      weight: 700,
      style: "italic",
      format: "opentype",
    });
  });
});
