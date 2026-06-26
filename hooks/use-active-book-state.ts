"use client";

import { useState } from "react";
import type { StoredBook } from "@/lib/types";

export function useActiveBookState() {
  const [book, setBook] = useState<StoredBook | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [bookBuffer, setBookBuffer] = useState<ArrayBuffer | null>(null);

  return {
    book,
    setBook,
    blob,
    setBlob,
    bookBuffer,
    setBookBuffer,
  };
}
