"use client";

import { useEffect, useState } from "react";
import {
  extractEpubFontFaces,
  revokeEpubFontFaces,
  type EpubFontFace,
} from "@/lib/epub/fonts";

const EMPTY_FONT_FACES: EpubFontFace[] = [];

export function useEpubFontFaces(
  arrayBuffer: ArrayBuffer | null | undefined,
): EpubFontFace[] {
  const [loaded, setLoaded] = useState<{
    arrayBuffer: ArrayBuffer;
    fontFaces: EpubFontFace[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    let ownedFaces: EpubFontFace[] = [];

    if (!arrayBuffer) return;

    void extractEpubFontFaces(arrayBuffer)
      .then((faces) => {
        if (!active) {
          revokeEpubFontFaces(faces);
          return;
        }
        ownedFaces = faces;
        setLoaded({ arrayBuffer, fontFaces: faces });
      })
      .catch(() => {
        if (active) setLoaded({ arrayBuffer, fontFaces: [] });
      });

    return () => {
      active = false;
      revokeEpubFontFaces(ownedFaces);
    };
  }, [arrayBuffer]);

  if (!arrayBuffer || loaded?.arrayBuffer !== arrayBuffer) {
    return EMPTY_FONT_FACES;
  }
  return loaded.fontFaces;
}
