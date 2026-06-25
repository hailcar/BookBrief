"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_READER_SETTINGS,
  type ReaderSettings,
  getReaderSettingsSnapshot,
  invalidateReaderSettingsSnapshot,
  loadReaderSettings,
  saveReaderSettings,
} from "@/lib/reader-settings";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function emit() {
  listeners.forEach((l) => l());
}

export function useReaderSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    getReaderSettingsSnapshot,
    () => DEFAULT_READER_SETTINGS,
  );

  const setSettings = useCallback((next: ReaderSettings) => {
    saveReaderSettings(next);
    invalidateReaderSettingsSnapshot();
    emit();
  }, []);

  const patchSettings = useCallback((patch: Partial<ReaderSettings>) => {
    const current = loadReaderSettings();
    saveReaderSettings({ ...current, ...patch });
    invalidateReaderSettingsSnapshot();
    emit();
  }, []);

  return { settings, setSettings, patchSettings };
}