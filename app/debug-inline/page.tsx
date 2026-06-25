"use client";

import { useState } from "react";

export default function DebugInlinePage() {
  const [count, setCount] = useState(0);

  return (
    <main style={{ padding: 20 }}>
      <button id="inline" onClick={() => setCount((c) => c + 1)}>
        {count}
      </button>
    </main>
  );
}
