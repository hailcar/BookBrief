"use client";

import { useCallback, useState } from "react";
import type { EpubSearchResult } from "@/lib/types";

export function useBookSearchState() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EpubSearchResult[]>([]);
  const [searchingBook, setSearchingBook] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchingBook,
    setSearchingBook,
    searchError,
    setSearchError,
    clearSearch,
  };
}
