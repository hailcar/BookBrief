"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getBrowserStorageItem,
  setBrowserStorageItem,
} from "@/lib/browser-storage";

/** Notify iframe-injected layout scripts (fit/scale) after viewport changes. */
export function dispatchReaderViewportRelayout(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("resize"));
}

const READER_FULLSCREEN_KEY = "summary_epub_reader_fullscreen";

function loadPersistedReaderFullscreen(): boolean {
  return getBrowserStorageItem(READER_FULLSCREEN_KEY) === "1";
}

function savePersistedReaderFullscreen(value: boolean): void {
  setBrowserStorageItem(READER_FULLSCREEN_KEY, value ? "1" : "0");
}

export function useReaderFullscreen() {
  const [isReaderFullscreen, setIsReaderFullscreen] = useState(false);

  const enterReaderFullscreen = useCallback(() => {
    savePersistedReaderFullscreen(true);
    setIsReaderFullscreen(true);
  }, []);

  const exitReaderFullscreen = useCallback(() => {
    savePersistedReaderFullscreen(false);
    setIsReaderFullscreen(false);
  }, []);

  const toggleReaderFullscreen = useCallback(() => {
    setIsReaderFullscreen((v) => {
      const next = !v;
      savePersistedReaderFullscreen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      if (loadPersistedReaderFullscreen()) {
        setIsReaderFullscreen(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!isReaderFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isReaderFullscreen]);

  useEffect(() => {
    if (!isReaderFullscreen) return;
    dispatchReaderViewportRelayout();
    const raf = requestAnimationFrame(dispatchReaderViewportRelayout);
    const t1 = window.setTimeout(dispatchReaderViewportRelayout, 120);
    const t2 = window.setTimeout(dispatchReaderViewportRelayout, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isReaderFullscreen]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== "f") {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleReaderFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleReaderFullscreen]);

  return {
    isReaderFullscreen,
    enterReaderFullscreen,
    exitReaderFullscreen,
    toggleReaderFullscreen,
  };
}
