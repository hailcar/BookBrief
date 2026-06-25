"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type EpubDisplayMode,
  loadEpubDisplayMode,
  saveEpubDisplayMode,
} from "@/lib/epub-display";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function emit() {
  listeners.forEach((l) => l());
}

export function useEpubDisplayMode() {
  const mode = useSyncExternalStore(
    subscribe,
    loadEpubDisplayMode,
    (): EpubDisplayMode => "global",
  );

  const setMode = useCallback((next: EpubDisplayMode) => {
    saveEpubDisplayMode(next);
    emit();
  }, []);

  return { mode, setMode };
}