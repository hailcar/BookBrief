"use client";

import { useCallback, useEffect, useState } from "react";
import { listBooks } from "@/lib/db";
import type { DocumentFormat } from "@/lib/types";

export type BookLibraryItem = {
  id: string;
  fileName: string;
  format?: DocumentFormat;
  uploadedAt: number;
};

export type DownloadProgress = {
  receivedBytes: number;
  totalBytes: number | null;
  phase: "idle" | "downloading" | "processing";
};

export function useBookLibraryState() {
  const [library, setLibrary] = useState<BookLibraryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    receivedBytes: 0,
    totalBytes: null,
    phase: "idle",
  });
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    setLibrary(await listBooks());
  }, []);

  useEffect(() => {
    let cancelled = false;
    listBooks()
      .then((items) => {
        if (!cancelled) setLibrary(items);
      })
      .catch((err) => {
        console.error("IndexedDB listBooks failed", err);
        if (!cancelled) setLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    library,
    setLibrary,
    refreshLibrary,
    uploading,
    setUploading,
    downloadingUrl,
    setDownloadingUrl,
    downloadProgress,
    setDownloadProgress,
    downloadError,
    setDownloadError,
  };
}
