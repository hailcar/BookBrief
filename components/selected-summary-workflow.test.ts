import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("selected paragraph summary workflow", () => {
  it("passes Ctrl/Cmd reader click modifier keys from the iframe to the workspace", () => {
    const iframeScript = source("lib/epub/heading-interaction.ts");
    const preview = source("components/epub-section-preview.tsx");

    expect(iframeScript).toContain("ctrlKey: !!ev.ctrlKey");
    expect(iframeScript).toContain("metaKey: !!ev.metaKey");
    expect(iframeScript).not.toContain("shiftKey: !!ev.shiftKey");
    expect(preview).toContain("ctrlKey: data.ctrlKey");
    expect(preview).toContain("metaKey: data.metaKey");
    expect(preview).not.toContain("shiftKey: data.shiftKey");
  });

  it("accepts reader postMessage events only from the active EPUB iframe", () => {
    const preview = source("components/epub-section-preview.tsx");
    const listenerStart = preview.indexOf("const onMessage = (ev: MessageEvent)");
    const listenerEnd = preview.indexOf("window.addEventListener(\"message\", onMessage)");
    const listenerBody = preview.slice(listenerStart, listenerEnd);

    expect(listenerBody).toContain(
      "if (ev.source !== iframeForSlot(activeSlot)?.contentWindow) return;",
    );
    expect(listenerBody.indexOf("ev.source")).toBeLessThan(
      listenerBody.indexOf("const data = ev.data"),
    );
  });

  it("keeps Shift out of iframe range selection plumbing", () => {
    const iframeScript = source("lib/epub/heading-interaction.ts");
    const preview = source("components/epub-section-preview.tsx");
    const contentPane = source("components/reader-content-pane.tsx");
    const workspace = source("components/epub-workspace.tsx");

    expect(preview).not.toContain("selectionAnchorBlockId?: string | null");
    expect(preview).not.toContain("anchorBlockId: selectionAnchorBlockId ?? null");
    expect(contentPane).not.toContain("selectionAnchorBlockId={selectionAnchorBlockId}");
    expect(workspace).not.toContain("selectionAnchorBlockId={ws.selectionAnchorBlockId}");
    expect(iframeScript).toContain("applySelectedBlocks(data.blockIds)");
    expect(iframeScript).not.toContain("currentSelectionAnchorBlockId");
    expect(iframeScript).toContain("document.addEventListener('mousedown'");
    expect(iframeScript).toContain("clearTextSelectionAction");
    expect(iframeScript).toContain("summary-epub-clear-reader-selection");
    expect(iframeScript).toContain("function isReaderUiTarget");
    expect(preview).toContain("onClearSelectionStable");
    expect(preview).toContain('data?.type === "summary-epub-clear-reader-selection"');
    expect(preview).toContain("onClearSelectionStable();");
    expect(contentPane).toContain("onClearSelection={onClearSelection}");
  });

  it("keeps selected block state ordered and clears it when sections change", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const selection = source("lib/selection.ts");
    const selectedHook = source("hooks/use-selected-summary-state.ts");

    expect(hook).toContain("selectionAnchorBlockId");
    expect(hook).toContain("computeReaderBlockSelection");
    expect(hook).toContain("expandSelectedBlockRange");
    expect(hook).toContain("setSelection((current)");
    expect(selection).toContain("modifiers?.ctrlKey || modifiers?.metaKey");
    expect(selection).toContain("expandSelectedBoundaryRange");
    expect(selectedHook).toContain("clearSelectedSummary");
  });

  it("keeps workspace as a facade over domain hooks and helpers", () => {
    const workspaceHook = source("hooks/use-book-workspace.ts");

    expect(source("hooks/use-book-library-state.ts")).toContain(
      "useBookLibraryState",
    );
    expect(source("hooks/use-reader-section-state.ts")).toContain(
      "useReaderSectionState",
    );
    expect(source("hooks/use-selected-summary-state.ts")).toContain(
      "useSelectedSummaryState",
    );
    expect(source("hooks/use-book-search-state.ts")).toContain(
      "useBookSearchState",
    );
    expect(source("hooks/use-heading-summary-queue.ts")).toContain(
      "useHeadingSummaryQueue",
    );
    expect(workspaceHook).toContain("useBookLibraryState()");
    expect(workspaceHook).toContain("useReaderSectionState()");
    expect(workspaceHook).toContain("useHeadingSummaryQueue()");
  });

  it("restores the active book and immersive reader after a refresh", () => {
    const workspaceHook = source("hooks/use-book-workspace.ts");
    const fullscreenHook = source("hooks/use-reader-fullscreen.ts");

    expect(fullscreenHook).toContain("summary_epub_reader_fullscreen");
    expect(fullscreenHook).toContain("loadPersistedReaderFullscreen");
    expect(fullscreenHook).toContain("savePersistedReaderFullscreen(true)");
    expect(fullscreenHook).toContain("savePersistedReaderFullscreen(false)");
    expect(workspaceHook).toContain("summary_epub_active_book_id");
    expect(workspaceHook).toContain("getBrowserSessionItem(ACTIVE_BOOK_KEY)");
    expect(workspaceHook).toContain("setBrowserSessionItem(ACTIVE_BOOK_KEY");
    expect(workspaceHook).toContain("saveActiveBookId(hydratedMeta.id)");
    expect(workspaceHook).toContain("restoreActiveBookAttemptedRef");
    expect(workspaceHook).toContain("hasUrlImportParam()");
    expect(workspaceHook).toContain("await openBook(activeBookId");
    expect(workspaceHook).toContain("clearActiveBookId()");
  });

  it("adds settings data backup controls split by book", () => {
    const settings = source("components/epub-settings-dialog.tsx");
    const workspace = source("components/epub-workspace.tsx");
    const hook = source("hooks/use-book-workspace.ts");
    const exportHelpers = source("lib/export.ts");

    expect(settings).toContain('<TabsTrigger value="data"');
    expect(settings).toContain("导出当前书");
    expect(settings).toContain("导出全部书库");
    expect(settings).toContain("按书籍导出");
    expect(settings).toContain("加载备份 JSON");
    expect(settings).toContain("library.map((item)");
    expect(workspace).toContain("onExportBook={ws.exportBookBackup}");
    expect(workspace).toContain("onImportBackup={ws.importBackupFile}");
    expect(hook).toContain("const exportBookBackup");
    expect(hook).toContain("const exportLibraryBackup");
    expect(hook).toContain("const importBackupFile");
    expect(exportHelpers).toContain("version: 2");
    expect(exportHelpers).toContain("dataBase64");
  });

  it("persists the reader section offset for refresh restore", () => {
    const workspaceHook = source("hooks/use-book-workspace.ts");
    const workspace = source("components/epub-workspace.tsx");
    const preview = source("components/epub-section-preview.tsx");
    const iframeScript = source("lib/epub/heading-interaction.ts");

    expect(workspaceHook).toContain("lastSectionOffset");
    expect(workspaceHook).toContain("const saveReaderPosition");
    expect(workspaceHook).toContain("top: readerState.lastSectionOffset");
    expect(workspace).toContain("ws.saveReaderPosition(sectionId, scrollTop)");
    expect(preview).toContain("readerWindowRestoreGuardRef");
    expect(preview).toContain("armReaderWindowRestoreGuard(scrollTopRequest)");
    expect(preview).toContain("reportedSectionId !== guard.sectionId");
    expect(iframeScript).toContain("readerWindowLastPostedOffset");
    expect(iframeScript).not.toContain("if (!fullDocument && role === 'current')");
  });

  it("uses a selected-summary prompt without translation instructions", () => {
    const client = source("lib/summarize-client.ts");
    const selectedSummaryFn = client.slice(
      client.indexOf("export async function summarizeSelectedBlocks"),
      client.indexOf("export async function translateSelectedText"),
    );

    expect(selectedSummaryFn).toContain("summarize only the selected EPUB passages");
    expect(selectedSummaryFn).not.toContain("EPUB/PDF passages");
    expect(selectedSummaryFn).toContain("Do not summarize the whole section");
    expect(selectedSummaryFn).toContain("请只总结下面选中的段落");
    expect(selectedSummaryFn).not.toMatch(/translate|translation|翻译/i);
  });

  it("keeps AI summary entry points EPUB-only and hides them for PDF reading", () => {
    const workspace = source("components/epub-workspace.tsx");
    const toolbar = source("components/epub-reader-toolbar.tsx");
    const tools = source("components/epub-reader-tools.tsx");
    const panel = source("components/epub-reader-panel.tsx");
    const hook = source("hooks/use-book-workspace.ts");

    expect(workspace).toContain('const summaryEnabled = activeBookFormat !== "pdf"');
    expect(workspace).toContain('const readerTab: ReaderPanelTab = summaryEnabled ? activeTab : "preview"');
    expect(workspace).toContain("value={readerTab}");
    expect(workspace).toContain("summaryEnabled={summaryEnabled}");
    expect(workspace).toContain("{summaryEnabled ? (");
    expect(toolbar).toContain("summaryEnabled = true");
    expect(toolbar).toContain("{summaryEnabled ? (");
    expect(tools).toContain("summaryEnabled = true");
    expect(tools).toContain("{summaryEnabled ? (");
    expect(panel).toContain('const summaryAvailable = summaryEnabled && documentFormat !== "pdf"');
    expect(panel).toContain("{summaryAvailable ? (");
    expect(hook).toContain("summaryEnabledForActiveBook");
    expect(hook).toContain("if (!summaryEnabledForActiveBook) return null");
  });

  it("does not expose old primary action copy or Shift range hints", () => {
    const workspace = source("components/epub-workspace.tsx");
    const summaryPane = source("components/reader-summary-pane.tsx");
    const immersivePanel = source("components/immersive-summary-panel.tsx");
    const readerPanel = source("components/epub-reader-panel.tsx");
    const combined = [workspace, summaryPane, immersivePanel, readerPanel].join("\n");

    expect(combined).toContain("总结所选段落");
    expect(combined).toContain("锚点");
    expect(combined).toContain("选中中间所有段");
    expect(combined).toContain("Ctrl/Cmd 选择前后两段");
    expect(combined).not.toContain("Shift");
    expect(combined).not.toContain("翻译所选段落");
    expect(combined).not.toContain("总结当前章");
    expect(combined).not.toContain("总结当前章节");
    expect(combined).not.toContain("总结本段");
  });

  it("renders range and delete summary actions in embedded and immersive panels", () => {
    const workspace = source("components/epub-workspace.tsx");
    const summaryPane = source("components/reader-summary-pane.tsx");
    const immersivePanel = source("components/immersive-summary-panel.tsx");
    const readerPanel = source("components/epub-reader-panel.tsx");

    expect(summaryPane).toContain("选中中间所有段");
    expect(summaryPane).toContain("删除总结");
    expect(immersivePanel).toContain("选中中间所有段");
    expect(immersivePanel).toContain("删除总结");
    expect(readerPanel).toContain("onExpandSelectionRange={onExpandSelectionRange}");
    expect(readerPanel).toContain("onDeleteSummary={onDeleteSummary}");
    expect(workspace).toContain("canExpandSelectedBlockRange");
    expect(workspace).toContain("deleteActiveSummary");
  });

  it("deletes selected summaries from session state and cached summaries from IndexedDB", () => {
    const hook = source("hooks/use-book-workspace.ts");

    expect(hook).toContain("const deleteActiveSummary");
    expect(hook).toContain("if (selectedSummaryResult)");
    expect(hook).toContain("resetSelectedSummaryState()");
    expect(hook).toContain("delete summaries[activeSummaryKey]");
    expect(hook).toContain("await updateSummaries(current.id, summaries)");
    expect(hook).toContain("setActiveSummaryKey(null)");
  });

  it("uses first-selected-block cache keys for selected paragraph summaries", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const workspace = source("components/epub-workspace.tsx");
    const preview = source("components/epub-section-preview.tsx");

    expect(hook).toContain("selectedSummaryCacheKey");
    expect(hook).toContain("const anchorBlockId = blockIds[0]");
    expect(hook).toContain("selectedSummaryCacheKey(activeSectionId, anchorBlockId)");
    expect(hook).toContain("scopeType: \"selected_blocks\"");
    expect(hook).toContain("startBlockId: anchorBlockId");
    expect(workspace).toContain("summary.scopeType === \"selected_blocks\"");
    expect(preview).toContain("activeSummaryId");
  });

  it("reuses cached selected summaries before sending another model request", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const selectedSummaryFn = hook.slice(
      hook.indexOf("const summarizeSelectedBlocks = useCallback"),
      hook.indexOf("const blockIdsForSummary = useCallback"),
    );

    expect(selectedSummaryFn).toContain("const currentBeforeRequest");
    expect(selectedSummaryFn).toContain("sameStringArray(cached.blockIds, blockIds)");
    expect(selectedSummaryFn).toContain("(cached.sourceText ?? \"\") === sourceText");
    expect(selectedSummaryFn.indexOf("const cached")).toBeLessThan(
      selectedSummaryFn.indexOf("summarizeSelectedBlocksRequest"),
    );
  });

  it("reuses the current book buffer and guards stale preview/search writes", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const sections = source("lib/epub/sections.ts");

    expect(hook).toContain("bookBuffer");
    expect(hook).toContain("previewRequestSeqRef");
    expect(hook).toContain("searchRequestSeqRef");
    expect(hook).toContain("sectionTextCacheRef");
    expect(hook).toContain("if (previewRequestSeqRef.current !== requestId) return");
    expect(hook).toContain("if (searchRequestSeqRef.current !== requestId) return");
    expect(hook).toContain("const cachedText = sectionTextCache.get(section.id)");
    expect(hook).toContain("sectionTextCache.set(loadedSection.id, text)");
    expect(hook).toContain("sectionTextCacheRef.current.clear()");
    expect(hook).toContain("visitDocumentSectionTexts(");
    expect(hook).toContain("book.sections.slice(i)");
    expect(hook).toContain("maxResults: 80");
    expect(hook).toContain("documentFormatForBook(book.fileName, book.format)");
    expect(sections).toContain("export async function visitSectionTexts");
    expect(source("lib/documents.ts")).toContain(
      "export async function visitDocumentSectionTexts",
    );
    expect(sections).toContain("const book = await openBook(arrayBuffer)");
    expect(sections).toContain("for (const section of sections)");
    expect(hook).not.toContain("loadSectionText(buf.slice(0), section)");
    expect(hook).not.toContain("loadSectionText(buf, section)");
  });

  it("keeps queued heading summaries cancellable without cancelling on worker status updates", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const queueEffect = hook.slice(
      hook.indexOf("useEffect(() => {\n    if (summaryQueuePaused"),
      hook.indexOf("const previousSectionIdRef"),
    );

    expect(hook).toContain("queueWorkerAbortRef");
    expect(hook).toContain("queueWorkerTaskRef");
    expect(hook).toContain("const abortSummaryWorker");
    expect(hook).toContain("abortSummaryWorker(activeSectionId)");
    expect(hook).toContain("abortSummaryWorker(previous)");
    expect(queueEffect).toContain("const controller = new AbortController()");
    expect(queueEffect).toContain("queueWorkerAbortRef.current = controller");
    expect(queueEffect).toContain("queueWorkerTaskRef.current = nextTask");
    expect(queueEffect).toContain("signal: controller.signal");
    expect(queueEffect).toContain("taskCancelled");
    expect(queueEffect).not.toContain("let cancelled");
    expect(queueEffect).not.toContain("return () =>");
  });

  it("reuses exact duplicate document imports without overwriting cached summaries", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const workspace = source("components/epub-workspace.tsx");
    const importFn = hook.slice(
      hook.indexOf("const importDocumentBlob = useCallback"),
      hook.indexOf("const uploadFile = useCallback"),
    );
    const uploadFn = hook.slice(
      hook.indexOf("const uploadFile = useCallback"),
      hook.indexOf("const downloadDocumentFromUrl = useCallback"),
    );

    expect(importFn).toContain("const id = bookIdFromBlob");
    expect(importFn).toContain("const existing = await getBook(id)");
    expect(importFn).toContain("if (existing && (await getBookBlob(id)))");
    expect(importFn).toContain("return { reused: true, fileName: existing.fileName }");
    expect(importFn.indexOf("const existing = await getBook(id)")).toBeLessThan(
      importFn.indexOf("parseDocumentSections(buf, format)"),
    );
    expect(importFn.indexOf("return { reused: true")).toBeLessThan(
      importFn.indexOf("saveBook(id, fileName, documentBlob, sections, {}, format)"),
    );
    expect(uploadFn).toContain("Promise<{ reused: boolean; fileName: string }>");
    expect(uploadFn).toContain("return await importDocumentBlob");
    expect(workspace).toContain("result.reused");
    expect(workspace).toContain("已直接打开");
  });

  it("bounds URL document downloads with a timeout-driven abort signal", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const downloadFn = hook.slice(
      hook.indexOf("const downloadDocumentFromUrl = useCallback"),
      hook.indexOf("const downloadProgressLabel"),
    );

    expect(hook).toContain("const DOCUMENT_DOWNLOAD_TIMEOUT_MS");
    expect(hook).toContain("function downloadTimeoutMessage");
    expect(downloadFn).toContain("const controller = new AbortController()");
    expect(downloadFn).toContain("controller.abort()");
    expect(downloadFn).toContain("setTimeout(() =>");
    expect(downloadFn).toContain("await fetch(url, { signal: controller.signal })");
    expect(downloadFn).toContain("await readResponseBlobWithProgress");
    expect(downloadFn).toContain("controller.signal.aborted && timedOut");
    expect(downloadFn).toContain("downloadTimeoutMessage(DOCUMENT_DOWNLOAD_TIMEOUT_MS)");
    expect(downloadFn.indexOf("await readResponseBlobWithProgress")).toBeLessThan(
      downloadFn.indexOf("clearTimeout(timeoutId)"),
    );
  });

  it("renders selected summary text from selectedSummaryResult", () => {
    const workspace = source("components/epub-workspace.tsx");
    expect(workspace).toContain("ws.selectedSummaryResult?.summary");
  });

  it("renders selected summary results as markdown in a single scroll body", () => {
    const summaryPane = source("components/reader-summary-pane.tsx");
    const immersivePanel = source("components/immersive-summary-panel.tsx");

    expect(summaryPane).toContain("<SummaryMarkdown content={summaryText} />");
    expect(immersivePanel).toContain("summary-panel-scroll");
    expect(immersivePanel.match(/overflow-y-auto/g) ?? []).toHaveLength(1);
  });

  it("uses a continuous reader window and switches active sections by scroll position", () => {
    const iframeScript = source("lib/epub/heading-interaction.ts");
    const preview = source("components/epub-section-preview.tsx");
    const contentPane = source("components/reader-content-pane.tsx");
    const workspace = source("components/epub-workspace.tsx");
    const hook = source("hooks/use-book-workspace.ts");
    const readerWindow = source("lib/reader-window.ts");

    expect(readerWindow).toContain("buildReaderWindowHtml");
    expect(readerWindow).toContain("buildReaderDocumentHtml");
    expect(readerWindow).toContain("data-reader-window-full-document");
    expect(readerWindow).toContain('role: "prev"');
    expect(readerWindow).toContain('role: "current"');
    expect(readerWindow).toContain('role: "next"');
    expect(readerWindow).toContain('data-reader-window-role="${role}"');
    expect(readerWindow).toContain("summary-epub-reader-window-section");
    expect(hook).toContain("buildReaderWindowHtml");
    expect(hook).not.toContain("prevSection");
    expect(hook).not.toContain("nextSection");
    expect(hook).not.toContain("prevHtml");
    expect(hook).not.toContain("nextHtml");
    expect(hook).toContain('if (format === "pdf")');
    expect(hook).toContain("blocks: []");
    expect(hook).toContain('html: ""');
    expect(hook).toContain("preserveScroll?: boolean");
    expect(hook).not.toContain("loadDocumentPagesContent");
    expect(hook).not.toContain("fullDocumentBlocksRef");
    expect(hook).toContain("scrollSectionId");
    expect(hook).toContain(
      "format === \"pdf\" ? pdfPageAnchorIdForSection(section) : section.id",
    );
    expect(hook).toContain("pdfPageAnchorIdForSection(first) ?? first.id");
    expect(iframeScript).toContain(
      "summary-epub-reader-window-active-section",
    );
    expect(iframeScript).toContain("sectionAtViewportTop");
    expect(iframeScript).toContain("data-reader-window-section-id");
    expect(preview).toContain("data-reader-frame-active");
    expect(preview).toContain("data-reader-frame-loading");
    expect(preview).toContain("frameDocs[nextSlot] === srcDoc");
    expect(preview).toContain("scrollIframeToRequest");
    expect(preview).toContain("request.sectionId");
    expect(preview).not.toContain("key={`${sectionId");
    expect(preview).toContain(
      "onReaderWindowSectionChange?.(",
    );
    expect(contentPane).toContain(
      "onReaderWindowSectionChange={onReaderWindowSectionChange}",
    );
    expect(contentPane).toContain(
      "relative flex h-full min-h-0 w-full flex-1 flex-col",
    );
    expect(workspace).toContain("const onReaderWindowSectionChange = useCallback");
    expect(workspace).toContain("scrollSectionId: sectionId");
    expect(iframeScript).not.toContain("summary-epub-continuous-next");
    expect(iframeScript).not.toContain("summary-epub-boundary-navigate");
    expect(iframeScript).not.toContain("atDocumentEnd");
    expect(workspace).toContain("quiet: true");
  });

  it("adds EPUB comments to selected fragments and renders hover comments in the iframe", () => {
    const hook = source("hooks/use-book-workspace.ts");
    const workspace = source("components/epub-workspace.tsx");
    const preview = source("components/epub-section-preview.tsx");
    const iframeScript = source("lib/epub/heading-interaction.ts");
    const db = source("lib/db.ts");
    const types = source("lib/types.ts");

    expect(types).toContain("export type EpubComment");
    expect(db).toContain("export async function updateComments");
    expect(hook).toContain("const addCommentForTextSelection");
    expect(hook).toContain("const addTranslationForTextSelection");
    expect(hook).toContain("const deleteAnnotation");
    expect(hook).toContain("translateSelectedText(selectedText)");
    expect(hook).toContain("commentCacheKey(activeSectionId, anchorBlockId)");
    expect(hook).toContain("sourceText: selectedText");
    expect(hook).toContain("sourceFragments");
    expect(hook).toContain('kind: "translation"');
    expect(hook).toContain("await updateComments(current.id, comments)");
    expect(hook).toContain("if (activeSummaryKey === cacheKey)");
    expect(hook).toContain("clearSelectedSummary();");
    expect(workspace).toContain("pendingCommentSelection");
    expect(workspace).toContain("const onCommentTextSelection");
    expect(workspace).toContain("const onTranslateTextSelection");
    expect(workspace).toContain("const onDeleteAnnotation");
    expect(workspace).toContain("ws.addCommentForTextSelection({");
    expect(workspace).toContain("ws.addTranslationForTextSelection({");
    expect(workspace).toContain("<Textarea");
    expect(workspace).not.toContain("window.prompt");
    expect(workspace).toContain("comments={summaryEnabled ? activeComments : []}");
    expect(preview).toContain("summary-epub-render-comments");
    expect(preview).toContain("onCommentTextSelection?.(selection)");
    expect(preview).toContain("onTranslateTextSelection?.(selection)");
    expect(preview).toContain('data?.type === "summary-epub-delete-annotation"');
    expect(preview).toContain("onDeleteAnnotation?.(data.annotationId)");
    expect(preview).toContain("fragments: Array.isArray(data.fragments)");
    expect(iframeScript).toContain("data-se-commented");
    expect(iframeScript).toContain("data-se-comment");
    expect(iframeScript).toContain("content: attr(data-se-comment)");
    expect(iframeScript).toContain("summary-epub-comment-text-selection");
    expect(iframeScript).toContain("summary-epub-translate-text-selection");
    expect(iframeScript).toContain("summary-epub-delete-annotation");
    expect(iframeScript).toContain("summary-epub-text-selection-action");
    expect(iframeScript).toContain("summary-epub-annotation-popover");
    expect(iframeScript).toContain("includeCommentMarks: true");
    expect(iframeScript).toContain("addActionButton('翻译'");
    expect(iframeScript).toContain("function selectionFragments");
    expect(iframeScript).toContain("sourceFragments");
    expect(iframeScript).toContain("if (quote) return");
    expect(iframeScript).toContain("function wrapQuoteInBlock");
    expect(iframeScript).not.toContain("summary-epub-comment-selection");
  });
});
