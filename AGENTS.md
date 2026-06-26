# summary_epub — agent notes

**Status:** Next.js app live. EPUB/PDF blob + summaries in **IndexedDB** (`lib/db.ts`); AI key in **localStorage**. Summaries: browser → provider API via `lib/summarize-client.ts` (one section/page per request; no server proxy).

**Product intent:** Pure frontend app (Next.js + shadcn/ui) that ingests EPUB or copyable-text PDF files, splits them into **sections** (EPUB = OPF spine item; PDF = page), and produces per-section AI summaries with a readable UI.

## Stack (target)

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| UI | shadcn/ui + Tailwind (via `components.json`) |
| EPUB/PDF | Client-side parse first (`epub.js` for EPUB; `pdfjs-dist` text layer for PDF); avoid shipping whole book to the server unless you add an explicit upload API |
| AI | Client-side `fetch` to OpenAI-compatible `/chat/completions`; key in localStorage. CORS must be allowed by the provider or use a CORS-enabled gateway |

## Intended layout (create on scaffold)

```
app/                 # routes, layouts (no summarize API — client-only AI)
components/          # shadcn + app-specific (upload, section list, summary panel)
lib/                 # document parsing, section/page extraction, prompt assembly (no UI)
hooks/               # upload progress, section selection, summary fetch state
```

Add nested `AGENTS.md` only when a folder grows non-obvious rules (e.g. `lib/epub/` or `lib/pdf/` with custom section logic).

## Domain rules agents often get wrong

1. **Section definition:** EPUB section = OPF `spine` item (`spine-{index}`); PDF section = page (`page-{pageNumber}`). Mixing models breaks summary boundaries and retries.
2. **HTML cleanup:** EPUB content is XHTML in zip; strip scripts, resolve `href`/`src` against the package base path before sending text to the model. PDF previews are generated HTML from extracted text.
3. **Size limits:** Summarize **one section per request** (or fixed token chunks inside a section). Do not dump the full book into one prompt.
4. **Idempotency:** Cache summaries by stable section id (`spine-{index}` or `page-{pageNumber}`) so re-clicks do not re-bill the API.
5. **PII / copyright:** Summaries are derived works; keep processing local + user-initiated unless product requirements say otherwise.

## shadcn / Next conventions (when present)

- Run `npx shadcn@latest init` once; add components with `npx shadcn@latest add <name>` — do not hand-copy Radix primitives into random folders.
- Prefer `components/ui/*` untouched; put feature UI in `components/epub-*` or similar.
- Use `loading.tsx` / `error.tsx` on routes that wait on EPUB parse or AI calls.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run test:all
npm run build
npm run start
```

Package manager: **npm** (`package-lock.json`).

## Environment

No server env required for summarization. User configures API key + base URL + model in the UI (localStorage).

## Verification checklist (post-implementation)

- Upload or open a multi-chapter EPUB; section list matches OPF spine choice.
- Upload a copyable-text PDF; page list, preview, search, and selected text summaries work.
- Summarize two sections/pages; second request uses cache or shows distinct loading state.
- `npm run build` succeeds; summarization does not use `app/api/*`.

## Related repos (not this codebase)

Sibling `/home/containers/ebook-to-mindmap` is Vite + React + shadcn — useful for Radix patterns only; do not copy its build tooling into this Next app.

## Maintenance

When structure or scripts change, update **Commands** in the same PR. Remove stale claims; this file should stay short (roughly under 120 lines).
