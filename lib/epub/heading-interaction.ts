/** Parent-controlled EPUB iframe reader UI: heading actions, selection, comments, and summary rail. */

export const HEADING_INTERACTION_STYLE = `
<style id="summary-epub-heading-ui">
  [data-se-heading-level] {
    position: relative;
  }
  .summary-epub-heading-actions {
    position: absolute;
    right: 0;
    top: 0;
    display: none;
    gap: 4px;
    z-index: 2;
  }
  [data-se-heading-level]:hover .summary-epub-heading-actions {
    display: inline-flex;
  }
  .summary-epub-heading-btn {
    font-family: system-ui, sans-serif;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #d6d3d1;
    background: #fafaf9;
    color: #1c1917;
    cursor: pointer;
    box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
  }
  .summary-epub-heading-btn:hover {
    background: #f5f5f4;
  }
  .summary-epub-selection-action {
    box-sizing: border-box;
    position: fixed;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    max-width: min(24rem, calc(100vw - 2rem));
    padding: 0.35rem;
    border: 1px solid rgb(214 211 209 / 88%);
    border-radius: 999px;
    background: rgb(255 255 255 / 94%);
    box-shadow: 0 12px 30px rgb(28 25 23 / 15%);
    backdrop-filter: blur(10px);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: auto;
  }
  .summary-epub-selection-action[data-hidden="true"] {
    display: none;
  }
  .summary-epub-text-selection-action {
    box-sizing: border-box;
    position: fixed;
    z-index: 45;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    max-width: min(20rem, calc(100vw - 2rem));
    padding: 0.35rem;
    border: 1px solid rgb(168 85 247 / 32%);
    border-radius: 999px;
    background: rgb(255 255 255 / 96%);
    box-shadow: 0 12px 30px rgb(59 7 100 / 16%);
    backdrop-filter: blur(10px);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: auto;
  }
  .summary-epub-text-selection-action button {
    min-width: 0;
    border: 0;
    border-radius: 999px;
    background: #581c87;
    color: white;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    padding: 0.45rem 0.75rem;
    white-space: nowrap;
  }
  .summary-epub-text-selection-action button:hover {
    background: #6b21a8;
  }
  .summary-epub-selection-action button {
    min-width: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #44403c;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    padding: 0.45rem 0.65rem;
    white-space: nowrap;
  }
  .summary-epub-selection-action button[data-primary="true"] {
    background: #1c1917;
    color: white;
  }
  .summary-epub-selection-action button:hover {
    background: #f5f5f4;
    color: #1c1917;
  }
  .summary-epub-selection-action button[data-primary="true"]:hover {
    background: #292524;
    color: white;
  }
  .summary-epub-selection-action button:disabled {
    cursor: default;
    opacity: 0.55;
  }
  [data-se-highlight="1"] {
    background: rgb(245 158 11 / 10%);
    box-shadow: inset 3px 0 0 rgb(245 158 11 / 45%);
  }
  [data-se-active-block="1"] {
    outline: 2px solid rgb(245 158 11 / 58%);
    outline-offset: 2px;
    background: rgb(245 158 11 / 16%);
  }
  [data-se-selected-block="1"] {
    background: rgb(14 165 233 / 12%);
    box-shadow: inset 3px 0 0 rgb(14 165 233 / 48%);
  }
  [data-se-commented="1"] {
    position: relative;
    background: rgb(168 85 247 / 12%);
    box-shadow: inset 3px 0 0 rgb(168 85 247 / 52%);
  }
  .summary-epub-comment-mark {
    position: relative;
    border-radius: 0.2em;
    background: rgb(168 85 247 / 16%);
    box-shadow: inset 0 -0.16em 0 rgb(168 85 247 / 38%);
    cursor: pointer;
  }
  .summary-epub-annotation-popover {
    box-sizing: border-box;
    position: fixed;
    z-index: 70;
    width: min(22rem, calc(100vw - 2rem));
    max-height: min(20rem, calc(100vh - 2rem));
    overflow: auto;
    padding: 0.6rem;
    border: 1px solid rgb(168 85 247 / 32%);
    border-radius: 10px;
    background: rgb(255 255 255 / 97%);
    color: #3b0764;
    box-shadow: 0 16px 38px rgb(59 7 100 / 18%);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 1.55;
  }
  .summary-epub-annotation-popover-item + .summary-epub-annotation-popover-item {
    margin-top: 0.55rem;
    padding-top: 0.55rem;
    border-top: 1px solid rgb(168 85 247 / 16%);
  }
  .summary-epub-annotation-popover-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .summary-epub-annotation-popover-label {
    font-weight: 750;
  }
  .summary-epub-annotation-popover-delete {
    border: 1px solid rgb(168 85 247 / 24%);
    border-radius: 999px;
    background: white;
    color: #6b21a8;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    padding: 0.25rem 0.5rem;
  }
  .summary-epub-annotation-popover-delete:hover {
    background: #faf5ff;
  }
  .summary-epub-annotation-popover-body {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  [data-se-commented="1"]:hover::after,
  .summary-epub-comment-mark:hover::after {
    content: attr(data-se-comment);
    position: absolute;
    left: min(1rem, 4vw);
    top: calc(100% + 0.35rem);
    z-index: 60;
    box-sizing: border-box;
    width: max-content;
    max-width: min(24rem, calc(100vw - 2rem));
    padding: 0.55rem 0.7rem;
    border: 1px solid rgb(168 85 247 / 35%);
    border-radius: 8px;
    background: rgb(255 255 255 / 96%);
    color: #3b0764;
    box-shadow: 0 12px 30px rgb(59 7 100 / 16%);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.55;
    white-space: pre-wrap;
    pointer-events: none;
  }
  [data-se-summarized="1"]:hover {
    background: rgb(245 158 11 / 7%);
  }
  .summary-epub-summary-rail {
    box-sizing: border-box;
    position: fixed;
    top: max(4rem, env(safe-area-inset-top, 0px) + 1rem);
    width: min(22rem, calc(100vw - 2rem));
    max-height: calc(100vh - 8rem);
    z-index: 30;
    display: grid;
    gap: 0.65rem;
    overflow: auto;
    pointer-events: none;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: rgb(120 113 108 / 38%) transparent;
    padding-inline-end: 0.15rem;
  }
  .summary-epub-summary-rail::-webkit-scrollbar,
  .summary-epub-summary-body pre::-webkit-scrollbar {
    width: 9px;
    height: 9px;
  }
  .summary-epub-summary-rail::-webkit-scrollbar-track,
  .summary-epub-summary-body pre::-webkit-scrollbar-track {
    background: transparent;
  }
  .summary-epub-summary-rail::-webkit-scrollbar-thumb,
  .summary-epub-summary-body pre::-webkit-scrollbar-thumb {
    border: 3px solid transparent;
    border-radius: 999px;
    background: rgb(120 113 108 / 34%);
    background-clip: content-box;
  }
  .summary-epub-summary-rail::-webkit-scrollbar-thumb:hover,
  .summary-epub-summary-body pre::-webkit-scrollbar-thumb:hover {
    background: rgb(120 113 108 / 52%);
    background-clip: content-box;
  }
  .summary-epub-summary-rail[data-side="right"] {
    right: var(--summary-epub-rail-gap, 1rem);
  }
  .summary-epub-summary-rail[data-side="left"] {
    left: var(--summary-epub-rail-gap, 1rem);
  }
  .summary-epub-summary-card {
    box-sizing: border-box;
    padding: 0.75rem 0.6rem 0.75rem 0.85rem;
    border: 1px solid rgb(214 211 209 / 88%);
    border-radius: 10px;
    background: rgb(255 255 255 / 94%);
    color: #1c1917;
    box-shadow: 0 12px 30px rgb(28 25 23 / 14%);
    backdrop-filter: blur(10px);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.65;
    pointer-events: auto;
  }
  .summary-epub-summary-card[data-status="loading"] {
    color: #78716c;
    background: rgb(250 250 249 / 88%);
  }
  .summary-epub-summary-card[data-status="failed"] {
    border-color: rgb(248 113 113 / 55%);
    background: rgb(254 242 242 / 95%);
    color: #7f1d1d;
  }
  .summary-epub-inline-bubble {
    margin: 0.25rem 0 1rem;
  }
  .summary-epub-inline-bubble .summary-epub-summary-card {
    box-shadow: 0 8px 22px rgb(28 25 23 / 10%);
  }
  .summary-epub-summary-retry {
    margin-top: 0.65rem;
    border: 1px solid rgb(248 113 113 / 45%);
    border-radius: 999px;
    background: white;
    color: #991b1b;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    font-weight: 650;
    padding: 0.35rem 0.65rem;
  }
  .summary-epub-summary-retry:hover {
    background: #fee2e2;
  }
  .summary-epub-summary-card[data-collapsed="true"] {
    width: max-content;
    max-width: 100%;
    padding: 0;
    overflow: hidden;
  }
  .summary-epub-summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
  }
  .summary-epub-summary-card[data-collapsed="true"] .summary-epub-summary-header {
    margin-bottom: 0;
  }
  .summary-epub-summary-label {
    color: #a16207;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .summary-epub-summary-toggle {
    border: 1px solid rgb(214 211 209 / 88%);
    border-radius: 999px;
    background: rgb(250 250 249 / 88%);
    color: #57534e;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    line-height: 1;
    padding: 0.25rem 0.5rem;
  }
  .summary-epub-summary-toggle:hover {
    background: #f5f5f4;
    color: #1c1917;
  }
  .summary-epub-summary-body {
    padding-inline-end: 0.35rem;
    overflow-wrap: anywhere;
  }
  .summary-epub-summary-body > * + * { margin-top: 0.65rem; }
  .summary-epub-summary-body :where(h1, h2, h3, h4, h5, h6) {
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.25;
  }
  .summary-epub-summary-body :where(ul, ol) {
    padding-inline-start: 1.2rem;
  }
  .summary-epub-summary-body ul { list-style: disc; }
  .summary-epub-summary-body ol { list-style: decimal; }
  .summary-epub-summary-body li + li { margin-top: 0.2rem; }
  .summary-epub-summary-body blockquote {
    border-inline-start: 3px solid #d6d3d1;
    color: #57534e;
    padding-inline-start: 0.7rem;
    margin-inline-start: 0;
  }
  .summary-epub-summary-body code {
    border-radius: 0.3rem;
    background: #f5f5f4;
    padding: 0.08rem 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }
  .summary-epub-summary-body pre {
    scrollbar-width: thin;
    overflow: auto;
    border: 1px solid #e7e5e4;
    border-radius: 0.45rem;
    background: #f5f5f4;
    padding: 0.65rem;
  }
  .summary-epub-summary-body pre code {
    background: transparent;
    padding: 0;
  }
  .summary-epub-summary-body a {
    color: #854d0e;
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }
  .summary-epub-summary-card[data-collapsed="true"] .summary-epub-summary-body {
    display: none;
  }
  @media (max-width: 900px) {
    .summary-epub-selection-action {
      right: 1rem !important;
      bottom: max(1rem, env(safe-area-inset-bottom, 0px) + 1rem) !important;
      left: 1rem !important;
      top: auto !important;
      justify-content: center;
      max-width: none;
      border-radius: 14px;
    }
    .summary-epub-selection-action button {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .summary-epub-summary-rail {
      top: auto;
      right: 1rem;
      bottom: max(1rem, env(safe-area-inset-bottom, 0px) + 1rem);
      left: auto;
      width: min(22rem, calc(100vw - 2rem));
      max-height: 42vh;
    }
    .summary-epub-summary-rail[data-side="left"],
    .summary-epub-summary-rail[data-side="right"] {
      right: 1rem;
      left: auto;
    }
  }
</style>
`;

export const HEADING_INTERACTION_SCRIPT = `
<script id="summary-epub-heading-script">
(function () {
  var currentSelectedBlockIds = [];
  var currentSelectionAction = null;
  var currentTextSelection = null;
  var textSelectionActionTimer = null;
  var currentAnnotationsById = {};
  function clearHighlights() {
    document.querySelectorAll('[data-se-highlight], [data-se-active-block]').forEach(function (el) {
      el.removeAttribute('data-se-highlight');
      el.removeAttribute('data-se-active-block');
    });
  }
  function applyHighlights(blockIds, activeBlockId) {
    clearHighlights();
    if (!blockIds || !blockIds.length) return;
    blockIds.forEach(function (id) {
      var el = document.querySelector('[data-se-block-id="' + id + '"]');
      if (el) el.setAttribute('data-se-highlight', '1');
    });
    if (activeBlockId) {
      var active = document.querySelector('[data-se-block-id="' + activeBlockId + '"]');
      if (active) active.setAttribute('data-se-active-block', '1');
    }
  }
  function applySummarizedBlocks(blockIds) {
    document.querySelectorAll('[data-se-summarized]').forEach(function (el) {
      el.removeAttribute('data-se-summarized');
    });
    if (!Array.isArray(blockIds)) return;
    blockIds.forEach(function (id) {
      var el = document.querySelector('[data-se-block-id="' + id + '"]');
      if (el) el.setAttribute('data-se-summarized', '1');
    });
  }
  function applySelectedBlocks(blockIds) {
    document.querySelectorAll('[data-se-selected-block]').forEach(function (el) {
      el.removeAttribute('data-se-selected-block');
    });
    currentSelectedBlockIds = Array.isArray(blockIds) ? blockIds.slice() : [];
    if (!Array.isArray(blockIds)) return;
    blockIds.forEach(function (id) {
      var el = document.querySelector('[data-se-block-id="' + id + '"]');
      if (el) el.setAttribute('data-se-selected-block', '1');
    });
  }
  function clearTextSelectionAction() {
    if (textSelectionActionTimer) {
      window.clearTimeout(textSelectionActionTimer);
      textSelectionActionTimer = null;
    }
    currentTextSelection = null;
    document.querySelectorAll('.summary-epub-text-selection-action').forEach(function (el) {
      el.remove();
    });
  }
  function clearAnnotationPopover() {
    document.querySelectorAll('.summary-epub-annotation-popover').forEach(function (el) {
      el.remove();
    });
  }
  function clearCommentMarks() {
    clearAnnotationPopover();
    document.querySelectorAll('.summary-epub-comment-mark').forEach(function (mark) {
      var parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      if (parent.normalize) parent.normalize();
    });
    document.querySelectorAll('[data-se-commented]').forEach(function (el) {
      el.removeAttribute('data-se-commented');
      el.removeAttribute('data-se-comment');
      el.removeAttribute('data-se-annotation-ids');
    });
  }
  function annotationLabel(annotation) {
    return annotation && annotation.kind === 'translation' ? '翻译' : '评论';
  }
  function annotationDisplayText(annotation) {
    return annotationLabel(annotation) + '：' + escapeText(annotation && annotation.comment);
  }
  function setAnnotationData(el, annotations) {
    var list = Array.isArray(annotations) ? annotations.filter(Boolean) : [];
    el.setAttribute('data-se-annotation-ids', list.map(function (annotation) {
      return annotation.id;
    }).filter(Boolean).join('|'));
    el.setAttribute('data-se-comment', list.map(annotationDisplayText).join('\\n\\n'));
  }
  function annotationsForElement(el) {
    var ids = (el && el.getAttribute('data-se-annotation-ids') || '').split('|').filter(Boolean);
    return ids.map(function (id) { return currentAnnotationsById[id]; }).filter(Boolean);
  }
  function renderAnnotationPopover(target) {
    clearAnnotationPopover();
    var annotations = annotationsForElement(target);
    if (!target || !annotations.length) return;
    var popover = document.createElement('div');
    popover.className = 'summary-epub-annotation-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', '文字标注');
    annotations.forEach(function (annotation) {
      var item = document.createElement('div');
      item.className = 'summary-epub-annotation-popover-item';
      var head = document.createElement('div');
      head.className = 'summary-epub-annotation-popover-head';
      var label = document.createElement('span');
      label.className = 'summary-epub-annotation-popover-label';
      label.textContent = annotationLabel(annotation);
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'summary-epub-annotation-popover-delete';
      del.textContent = '删除';
      del.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        postToParent({
          type: 'summary-epub-delete-annotation',
          annotationId: annotation.id
        });
        clearAnnotationPopover();
      });
      var body = document.createElement('div');
      body.className = 'summary-epub-annotation-popover-body';
      body.textContent = escapeText(annotation.comment);
      head.appendChild(label);
      head.appendChild(del);
      item.appendChild(head);
      item.appendChild(body);
      popover.appendChild(item);
    });
    document.body.appendChild(popover);
    var rect = target.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var left = Math.max(12, Math.min(rect.left, viewportWidth - (popover.offsetWidth || 280) - 12));
    var top = rect.bottom + 8;
    if (top + (popover.offsetHeight || 160) > viewportHeight - 12) {
      top = Math.max(12, rect.top - (popover.offsetHeight || 160) - 8);
    }
    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }
  function textNodesIn(root, options) {
    var includeCommentMarks = Boolean(options && options.includeCommentMarks);
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (!includeCommentMarks && parent.closest('.summary-epub-comment-mark')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('script, style, .summary-epub-selection-action, .summary-epub-text-selection-action, .summary-epub-annotation-popover')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }
  function wrapQuoteInBlock(block, quote, annotation, options) {
    if (!block || !quote) return false;
    var nodes = textNodesIn(block, options);
    var fullText = '';
    var ranges = [];
    nodes.forEach(function (node) {
      var start = fullText.length;
      fullText += node.nodeValue || '';
      ranges.push({ node: node, start: start, end: fullText.length });
    });
    var index = fullText.indexOf(quote);
    if (index < 0) return false;
    var endIndex = index + quote.length;
    var startInfo = null;
    var endInfo = null;
    ranges.forEach(function (item) {
      if (!startInfo && index >= item.start && index <= item.end) {
        startInfo = { node: item.node, offset: index - item.start };
      }
      if (!endInfo && endIndex >= item.start && endIndex <= item.end) {
        endInfo = { node: item.node, offset: endIndex - item.start };
      }
    });
    if (!startInfo || !endInfo) return false;
    try {
      var range = document.createRange();
      range.setStart(startInfo.node, startInfo.offset);
      range.setEnd(endInfo.node, endInfo.offset);
      var mark = document.createElement('span');
      mark.className = 'summary-epub-comment-mark';
      setAnnotationData(mark, [annotation]);
      range.surroundContents(mark);
      return true;
    } catch (_err) {
      return false;
    }
  }
  function appendCommentToExistingMark(block, quote, annotation) {
    if (!block || !quote) return false;
    var marks = Array.prototype.slice.call(block.querySelectorAll('.summary-epub-comment-mark'));
    for (var i = 0; i < marks.length; i += 1) {
      var mark = marks[i];
      if (escapeText(mark.textContent).indexOf(quote) < 0) continue;
      var annotations = annotationsForElement(mark);
      annotations.push(annotation);
      setAnnotationData(mark, annotations);
      return true;
    }
    return false;
  }
  function applyComments(comments) {
    clearCommentMarks();
    currentAnnotationsById = {};
    if (!Array.isArray(comments) || !comments.length) return;
    var byBlock = {};
    comments.forEach(function (comment) {
      if (!comment || !Array.isArray(comment.blockIds) || !comment.comment) return;
      if (comment.id) currentAnnotationsById[comment.id] = comment;
      var fragments = Array.isArray(comment.sourceFragments)
        ? comment.sourceFragments.filter(function (fragment) {
            return fragment && fragment.blockId && escapeText(fragment.text).trim();
          })
        : [];
      if (fragments.length) {
        var fragmentMarked = false;
        fragments.forEach(function (fragment) {
          var block = document.querySelector('[data-se-block-id="' + fragment.blockId + '"]');
          var text = escapeText(fragment.text).trim();
          if (
            wrapQuoteInBlock(block, text, comment, { includeCommentMarks: true }) ||
            appendCommentToExistingMark(block, text, comment)
          ) {
            fragmentMarked = true;
          }
        });
        if (fragmentMarked) return;
      }
      var quote = escapeText(comment.sourceText).trim();
      var marked = false;
      if (quote) {
        comment.blockIds.forEach(function (blockId) {
          if (marked) return;
          var block = document.querySelector('[data-se-block-id="' + blockId + '"]');
          marked =
            wrapQuoteInBlock(block, quote, comment, { includeCommentMarks: true }) ||
            appendCommentToExistingMark(block, quote, comment);
        });
      }
      if (marked) return;
      if (quote) return;
      comment.blockIds.forEach(function (blockId) {
        if (!blockId) return;
        if (!byBlock[blockId]) byBlock[blockId] = [];
        byBlock[blockId].push(comment);
      });
    });
    Object.keys(byBlock).forEach(function (blockId) {
      var el = document.querySelector('[data-se-block-id="' + blockId + '"]');
      if (!el) return;
      el.setAttribute('data-se-commented', '1');
      setAnnotationData(el, byBlock[blockId]);
    });
  }
  function closestReadableBlock(target) {
    if (!target || !target.closest) return null;
    if (target.closest('a, button, input, textarea, select')) return null;
    if (target.closest('[contenteditable=""], [contenteditable="true"]')) return null;
    return target.closest('[data-se-block-id], [data-block-id]');
  }
  function isReaderUiTarget(target) {
    return Boolean(
      target &&
      target.closest &&
      target.closest(
        '.summary-epub-selection-action, .summary-epub-text-selection-action, .summary-epub-summary-rail, .summary-epub-inline-bubble, .summary-epub-heading-actions'
      )
    );
  }
  function closestAnnotationTarget(target) {
    if (!target || !target.closest) return null;
    return target.closest('.summary-epub-comment-mark, [data-se-commented="1"]');
  }
  function scrollToBlock(blockId) {
    if (!blockId) return;
    var el = document.querySelector('[data-se-block-id="' + blockId + '"]');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function postToParent(payload) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, window.location.origin);
    }
  }
  function selectedReadableBlocks(range) {
    return selectionFragments(range).map(function (fragment) {
      return fragment.block;
    });
  }
  function selectionFragments(range) {
    var fragments = [];
    var byBlock = {};
    textNodesIn(getReadingRoot(), { includeCommentMarks: true }).forEach(function (node) {
      try {
        if (!range.intersectsNode(node)) return;
      } catch (_err) {
        return;
      }
      var parent = node.parentElement;
      var block = parent && parent.closest('[data-se-block-id], [data-block-id]');
      if (!block) return;
      var blockId = block.getAttribute('data-se-block-id') || block.getAttribute('data-block-id');
      if (!blockId) return;
      var start = 0;
      var end = (node.nodeValue || '').length;
      if (range.startContainer === node) start = range.startOffset;
      if (range.endContainer === node) end = range.endOffset;
      if (end <= start) return;
      var text = (node.nodeValue || '').slice(start, end);
      if (!text.trim()) return;
      if (!byBlock[blockId]) {
        byBlock[blockId] = { block: block, blockId: blockId, text: '' };
        fragments.push(byBlock[blockId]);
      }
      byBlock[blockId].text += text;
    });
    return fragments.map(function (fragment) {
      fragment.text = fragment.text.trim();
      return fragment;
    }).filter(function (fragment) {
      return fragment.text;
    });
  }
  function selectionPayload() {
    var selection = window.getSelection && window.getSelection();
    if (!selection || selection.isCollapsed || !String(selection).trim() || selection.rangeCount === 0) return null;
    var range = selection.getRangeAt(0);
    var fragments = selectionFragments(range);
    if (!fragments.length) return null;
    var blockIds = fragments.map(function (fragment) {
      return fragment.blockId;
    }).filter(Boolean);
    if (!blockIds.length) return null;
    var rect = range.getBoundingClientRect();
    return {
      text: String(selection).trim(),
      blockIds: blockIds,
      fragments: fragments.map(function (fragment) {
        return { blockId: fragment.blockId, text: fragment.text };
      }),
      rect: rect
    };
  }
  function renderTextSelectionAction(payload) {
    clearTextSelectionAction();
    if (!payload || !payload.text || !payload.blockIds || !payload.blockIds.length) return;
    currentTextSelection = {
      text: payload.text,
      blockIds: payload.blockIds,
      fragments: payload.fragments || []
    };
    var bar = document.createElement('div');
    bar.className = 'summary-epub-text-selection-action';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', '文字评论操作');
    function addActionButton(label, messageType) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (!currentTextSelection) return;
        postToParent({
          type: messageType,
          text: currentTextSelection.text,
          blockIds: currentTextSelection.blockIds,
          fragments: currentTextSelection.fragments
        });
        clearTextSelectionAction();
      });
      bar.appendChild(btn);
    }
    addActionButton('添加评论', 'summary-epub-comment-text-selection');
    addActionButton('翻译', 'summary-epub-translate-text-selection');
    document.body.appendChild(bar);
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var left = Math.max(12, Math.min(payload.rect.left, viewportWidth - (bar.offsetWidth || 120) - 12));
    var top = Math.max(12, payload.rect.top - (bar.offsetHeight || 36) - 8);
    if (payload.rect.top < 48) {
      top = Math.min(viewportHeight - 48, payload.rect.bottom + 8);
    }
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(top) + 'px';
  }
  function escapeText(value) {
    return String(value == null ? '' : value);
  }
  function escapeHtml(value) {
    return escapeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function safeHref(value) {
    var trimmed = escapeText(value).trim();
    return /^(https?:|mailto:)/i.test(trimmed) ? escapeHtml(trimmed) : '#';
  }
  function renderInlineMarkdown(value) {
    var html = escapeHtml(value);
    html = html.replace(/\\\`([^\\\`]+)\\\`/g, function (_match, code) {
      return '<code>' + code + '</code>';
    });
    html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function (_match, label, href) {
      return '<a href="' + safeHref(href) + '" target="_blank" rel="noreferrer">' + label + '</a>';
    });
    html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, '$1<em>$2</em>');
    html = html.replace(/(^|[^_])_([^_\\n]+)_/g, '$1<em>$2</em>');
    return html;
  }
  function renderParagraph(lines) {
    return '<p>' + renderInlineMarkdown(lines.join(' ')) + '</p>';
  }
  function renderList(items, ordered) {
    var tag = ordered ? 'ol' : 'ul';
    return '<' + tag + '>' + items.map(function (item) {
      return '<li>' + renderInlineMarkdown(item) + '</li>';
    }).join('') + '</' + tag + '>';
  }
  function renderMarkdown(markdown) {
    var lines = escapeText(markdown).replace(/\\r\\n?/g, '\\n').split('\\n');
    var html = [];
    var paragraph = [];
    var listItems = [];
    var orderedList = false;
    var quoteLines = [];
    var codeLines = [];
    var inCodeFence = false;
    function flushParagraph() {
      if (!paragraph.length) return;
      html.push(renderParagraph(paragraph));
      paragraph = [];
    }
    function flushList() {
      if (!listItems.length) return;
      html.push(renderList(listItems, orderedList));
      listItems = [];
    }
    function flushQuote() {
      if (!quoteLines.length) return;
      html.push('<blockquote>' + renderMarkdown(quoteLines.join('\\n')) + '</blockquote>');
      quoteLines = [];
    }
    lines.forEach(function (rawLine) {
      var line = rawLine.trimEnd();
      if (line.trim().slice(0, 3) === '\\\`\\\`\\\`') {
        if (inCodeFence) {
          html.push('<pre><code>' + escapeHtml(codeLines.join('\\n')) + '</code></pre>');
          codeLines = [];
          inCodeFence = false;
        } else {
          flushParagraph();
          flushList();
          flushQuote();
          inCodeFence = true;
        }
        return;
      }
      if (inCodeFence) {
        codeLines.push(rawLine);
        return;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushQuote();
        return;
      }
      var heading = /^(#{1,6})\\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        flushQuote();
        var level = heading[1].length;
        html.push('<h' + level + '>' + renderInlineMarkdown(heading[2]) + '</h' + level + '>');
        return;
      }
      var quote = /^>\\s?(.*)$/.exec(line);
      if (quote) {
        flushParagraph();
        flushList();
        quoteLines.push(quote[1]);
        return;
      }
      var unordered = /^\\s*[-*+]\\s+(.+)$/.exec(line);
      var ordered = /^\\s*\\d+[.)]\\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        flushParagraph();
        flushQuote();
        var nextOrdered = Boolean(ordered);
        if (listItems.length && orderedList !== nextOrdered) flushList();
        orderedList = nextOrdered;
        listItems.push((ordered || unordered)[1] || '');
        return;
      }
      flushList();
      flushQuote();
      paragraph.push(line.trim());
    });
    if (inCodeFence) html.push('<pre><code>' + escapeHtml(codeLines.join('\\n')) + '</code></pre>');
    flushParagraph();
    flushList();
    flushQuote();
    return html.join('\\n');
  }
  var collapsedSummaries = {};
  function getReadingRoot() {
    return document.getElementById('summary-epub-root') || document.body;
  }
  function positionSummaryRail(rail) {
    if (!rail) return;
    var root = getReadingRoot();
    var rect = root.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var cardWidth = Math.min(352, Math.max(260, viewportWidth - 32));
    var gap = 16;
    var rightSpace = Math.max(0, viewportWidth - rect.right);
    var leftSpace = Math.max(0, rect.left);
    var side = rightSpace >= Math.min(cardWidth + gap, 300) || rightSpace >= leftSpace ? 'right' : 'left';
    var space = side === 'right' ? rightSpace : leftSpace;
    var offset = Math.max(gap, (space - cardWidth) / 2);
    if (viewportWidth <= 900 || space < 240) {
      side = 'right';
      offset = gap;
    }
    rail.dataset.side = side;
    rail.style.setProperty('--summary-epub-rail-gap', Math.round(offset) + 'px');
  }
  function getOrCreateSummaryRail() {
    var rail = document.querySelector('.summary-epub-summary-rail');
    if (rail) return rail;
    rail = document.createElement('aside');
    rail.className = 'summary-epub-summary-rail';
    rail.setAttribute('aria-label', '本节总结');
    document.body.appendChild(rail);
    return rail;
  }
  function isSelectedSummaryBubble(bubble) {
    return Boolean(
      bubble &&
      (bubble.status === 'loading' ||
        bubble.status === 'failed' ||
        (bubble.summaryId && String(bubble.summaryId).indexOf('selected::') === 0) ||
        bubble.label === '所选段落总结')
    );
  }
  function createSummaryCard(bubble, activeSummaryId) {
    var heading = document.querySelector('[data-se-block-id="' + bubble.blockId + '"]');
    var summaryId = bubble.summaryId || bubble.blockId;
    var collapsed = activeSummaryId
      ? summaryId !== activeSummaryId
      : collapsedSummaries[summaryId] !== false && bubble.status !== 'loading' && bubble.status !== 'failed';
    var el = document.createElement('aside');
    el.className = 'summary-epub-summary-card';
    el.setAttribute('data-status', bubble.status || 'success');
    el.setAttribute('data-summary-for', bubble.blockId);
    el.setAttribute('data-summary-id', summaryId);
    el.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    if (heading && heading.textContent) {
      el.setAttribute('title', heading.textContent.trim());
    }
    var header = document.createElement('div');
    header.className = 'summary-epub-summary-header';
    var label = document.createElement('span');
    label.className = 'summary-epub-summary-label';
    label.textContent = bubble.label || (bubble.status === 'loading' ? '正在总结本节' : '本节总结');
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'summary-epub-summary-toggle';
    toggle.textContent = collapsed ? '展开' : '收回';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (bubble.status !== 'loading' && bubble.status !== 'failed' && summaryId) {
        postToParent({
          type: 'summary-epub-activate-summary',
          summaryId: summaryId
        });
      }
      collapsedSummaries[summaryId] = el.getAttribute('data-collapsed') !== 'true';
      el.setAttribute('data-collapsed', collapsedSummaries[summaryId] ? 'true' : 'false');
      toggle.textContent = collapsedSummaries[summaryId] ? '展开' : '收回';
      toggle.setAttribute('aria-expanded', collapsedSummaries[summaryId] ? 'false' : 'true');
    });
    var body = document.createElement('div');
    body.className = 'summary-epub-summary-body';
    body.innerHTML = renderMarkdown(bubble.summary || '正在生成总结...');
    header.appendChild(label);
    header.appendChild(toggle);
    el.appendChild(header);
    el.appendChild(body);
    if (bubble.status === 'failed') {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'summary-epub-summary-retry';
      retry.textContent = '重试';
      retry.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        postToParent({ type: 'summary-epub-summarize-selection' });
      });
      el.appendChild(retry);
    }
    return el;
  }
  function renderSelectedInlineBubble(bubble, activeSummaryId) {
    var anchor = document.querySelector('[data-se-block-id="' + bubble.blockId + '"]');
    if (!anchor || !anchor.parentNode) return;
    var wrap = document.createElement('div');
    wrap.className = 'summary-epub-inline-bubble';
    wrap.setAttribute('data-summary-for', bubble.blockId);
    wrap.appendChild(createSummaryCard(bubble, activeSummaryId));
    anchor.insertAdjacentElement('afterend', wrap);
  }
  function renderInlineBubbles(bubbles, activeSummaryId) {
    document.querySelectorAll('.summary-epub-inline-bubble').forEach(function (el) {
      el.remove();
    });
    var rail = getOrCreateSummaryRail();
    rail.replaceChildren();
    if (!Array.isArray(bubbles) || !bubbles.length) {
      rail.remove();
      return;
    }
    var railCount = 0;
    bubbles.forEach(function (bubble) {
      if (!bubble || !bubble.blockId) return;
      if (isSelectedSummaryBubble(bubble)) {
        renderSelectedInlineBubble(bubble, activeSummaryId);
        return;
      }
      rail.appendChild(createSummaryCard(bubble, activeSummaryId));
      railCount += 1;
    });
    if (railCount > 0) {
      positionSummaryRail(rail);
    } else {
      rail.remove();
    }
  }
  function getActionBlockId(action) {
    if (!action) return null;
    if (action.selectedSummaryBlockIds && action.selectedSummaryBlockIds.length) {
      return action.selectedSummaryBlockIds[0];
    }
    if (action.selectedBlockIds && action.selectedBlockIds.length) {
      return action.selectedBlockIds[0];
    }
    return action.activeBlockId || null;
  }
  function positionSelectionAction(bar, action) {
    if (!bar || !action) return;
    var blockId = getActionBlockId(action);
    var block = blockId ? document.querySelector('[data-se-block-id="' + blockId + '"]') : null;
    if (!block) {
      bar.setAttribute('data-hidden', 'true');
      return;
    }
    var rect = block.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    if (viewportWidth <= 900) {
      bar.style.left = '1rem';
      bar.style.top = 'auto';
      bar.style.right = '1rem';
      bar.style.bottom = 'max(1rem, env(safe-area-inset-bottom, 0px) + 1rem)';
      bar.removeAttribute('data-hidden');
      return;
    }
    var barWidth = Math.min(384, Math.max(260, bar.offsetWidth || 260));
    var left = rect.right + 14;
    if (left + barWidth > viewportWidth - 12) {
      left = Math.max(12, rect.left - barWidth - 14);
    }
    var top = Math.max(12, Math.min(rect.top, (window.innerHeight || 0) - 64));
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(top) + 'px';
    bar.style.right = 'auto';
    bar.style.bottom = 'auto';
    bar.removeAttribute('data-hidden');
  }
  function renderSelectionAction(action) {
    currentSelectionAction = action || null;
    var existing = document.querySelector('.summary-epub-selection-action');
    if (existing) existing.remove();
    if (!action || !action.activeBlockId || !action.selectedBlockIds || !action.selectedBlockIds.length) {
      return;
    }
    var bar = document.createElement('div');
    bar.className = 'summary-epub-selection-action';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', '所选段落操作');
    var summaryId = action.selectedSummaryId || null;
    function addButton(label, primary, onClick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      if (primary) btn.setAttribute('data-primary', 'true');
      btn.disabled = Boolean(action.summarizing);
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (btn.disabled) return;
        onClick();
      });
      bar.appendChild(btn);
    }
    if (summaryId) {
      addButton('查看总结', true, function () {
        postToParent({
          type: 'summary-epub-activate-summary',
          summaryId: summaryId
        });
      });
      addButton('重新总结', false, function () {
        postToParent({ type: 'summary-epub-summarize-selection' });
      });
      addButton('删除', false, function () {
        postToParent({ type: 'summary-epub-delete-active-summary' });
      });
    } else {
      var count = action.selectedBlockIds.length;
      addButton(count > 1 ? '总结所选 ' + count + ' 段' : '总结此段', true, function () {
        postToParent({ type: 'summary-epub-summarize-selection' });
      });
    }
    document.body.appendChild(bar);
    positionSelectionAction(bar, action);
  }
  function ensureHeadingButtons() {
    document.querySelectorAll('[data-se-heading-level]').forEach(function (el) {
      if (el.querySelector('.summary-epub-heading-actions')) return;
      var blockId = el.getAttribute('data-se-block-id');
      if (!blockId) return;
      var wrap = document.createElement('span');
      wrap.className = 'summary-epub-heading-actions';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'summary-epub-heading-btn';
      btn.textContent = '总结本节';
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        postToParent({
          type: 'summary-epub-summarize-heading',
          blockId: blockId
        });
      });
      wrap.appendChild(btn);
      el.appendChild(wrap);
    });
  }
  var visibleTimers = {};
  function notifyHeadingVisible(blockId) {
    if (!blockId || visibleTimers[blockId]) return;
    visibleTimers[blockId] = window.setTimeout(function () {
      delete visibleTimers[blockId];
      postToParent({
        type: 'summary-epub-heading-visible',
        blockId: blockId
      });
    }, 800);
  }
  function ensureHeadingObserver() {
    if (typeof IntersectionObserver === 'undefined') return;
    var headings = Array.prototype.slice.call(document.querySelectorAll('[data-se-heading-level]'));
    if (!headings.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var blockId = entry.target && entry.target.getAttribute('data-se-block-id');
        if (!blockId) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          notifyHeadingVisible(blockId);
        } else if (visibleTimers[blockId]) {
          window.clearTimeout(visibleTimers[blockId]);
          delete visibleTimers[blockId];
        }
      });
    }, { threshold: [0, 0.6, 1] });
    headings.forEach(function (heading) {
      observer.observe(heading);
    });
  }
  function onMessage(ev) {
    var data = ev.data;
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'summary-epub-highlight-blocks') {
      applyHighlights(data.blockIds, data.activeBlockId);
    }
    if (data.type === 'summary-epub-clear-highlight') {
      clearHighlights();
    }
    if (data.type === 'summary-epub-render-inline-bubbles') {
      renderInlineBubbles(data.bubbles, data.activeSummaryId);
    }
    if (data.type === 'summary-epub-render-selection-action') {
      renderSelectionAction(data.action);
    }
    if (data.type === 'summary-epub-render-comments') {
      applyComments(data.comments);
    }
    if (data.type === 'summary-epub-mark-summarized-blocks') {
      applySummarizedBlocks(data.blockIds);
    }
    if (data.type === 'summary-epub-mark-selected-blocks') {
      applySelectedBlocks(data.blockIds);
    }
    if (data.type === 'summary-epub-scroll-to-block') {
      scrollToBlock(data.blockId);
    }
  }
  function onReaderClick(ev) {
    var target = ev.target;
    var block = closestReadableBlock(target);
    if (!block) {
      if (isReaderUiTarget(target)) return;
      currentSelectedBlockIds = [];
      applySelectedBlocks([]);
      renderSelectionAction(null);
      clearAnnotationPopover();
      clearHighlights();
      postToParent({ type: 'summary-epub-clear-reader-selection' });
      return;
    }
    var selection = window.getSelection && window.getSelection();
    if (selection && !selection.isCollapsed && String(selection).trim()) {
      return;
    }
    var annotationTarget = closestAnnotationTarget(target);
    if (annotationTarget) {
      renderAnnotationPopover(annotationTarget);
      return;
    }
    var blockId = block.getAttribute('data-se-block-id') || block.getAttribute('data-block-id');
    if (!blockId) return;
    if (ev.ctrlKey || ev.metaKey) {
      if (currentSelectedBlockIds.indexOf(blockId) >= 0) {
        currentSelectedBlockIds = currentSelectedBlockIds.filter(function (id) { return id !== blockId; });
      } else {
        currentSelectedBlockIds = currentSelectedBlockIds.concat(blockId);
      }
    } else {
      currentSelectedBlockIds = [blockId];
    }
    postToParent({
      type: 'summary-epub-reader-block-click',
      blockId: blockId,
      headingLevel: block.getAttribute('data-se-heading-level') || block.getAttribute('data-heading-level') || null,
      ctrlKey: !!ev.ctrlKey,
      metaKey: !!ev.metaKey
    });
  }
  function onReaderMouseUp() {
    scheduleTextSelectionAction(0);
  }
  function scheduleTextSelectionAction(delay) {
    if (textSelectionActionTimer) window.clearTimeout(textSelectionActionTimer);
    textSelectionActionTimer = window.setTimeout(function () {
      textSelectionActionTimer = null;
      renderTextSelectionAction(selectionPayload());
    }, delay);
  }
  function onReaderTouchEnd() {
    scheduleTextSelectionAction(120);
  }
  function onReaderSelectionChange() {
    scheduleTextSelectionAction(80);
  }
  function onReaderMouseDown(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('.summary-epub-text-selection-action')) return;
    if (ev.target && ev.target.closest && ev.target.closest('.summary-epub-annotation-popover')) return;
    if (!(ev.target && ev.target.closest && ev.target.closest('.summary-epub-comment-mark, [data-se-commented="1"]'))) {
      clearAnnotationPopover();
    }
    clearTextSelectionAction();
  }
  var readerWindowTicking = false;
  var readerWindowLastPostedSectionId = null;
  var readerWindowLastPostedOffset = -1;
  function currentScrollTop() {
    var doc = document.documentElement;
    var body = document.body;
    return window.scrollY || doc.scrollTop || (body ? body.scrollTop : 0) || 0;
  }
  function sectionAtViewportTop() {
    var sections = Array.prototype.slice.call(
      document.querySelectorAll('[data-reader-window-section-id][data-reader-window-role]')
    );
    if (!sections.length) return null;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var referenceY = Math.min(160, Math.max(64, viewportHeight * 0.18));
    for (var i = 0; i < sections.length; i += 1) {
      var rect = sections[i].getBoundingClientRect();
      if (rect.top <= referenceY && rect.bottom > referenceY) {
        return sections[i];
      }
    }
    return null;
  }
  function maybeNotifyReaderWindowSection() {
    readerWindowTicking = false;
    var section = sectionAtViewportTop();
    if (!section) return;
    var sectionId = section.getAttribute('data-reader-window-section-id');
    if (!sectionId) return;
    var absoluteTop = section.getBoundingClientRect().top + currentScrollTop();
    var offset = Math.max(0, currentScrollTop() - absoluteTop);
    if (
      readerWindowLastPostedSectionId === sectionId &&
      Math.abs(offset - readerWindowLastPostedOffset) < 24
    ) {
      return;
    }
    readerWindowLastPostedSectionId = sectionId;
    readerWindowLastPostedOffset = offset;
    postToParent({
      type: 'summary-epub-reader-window-active-section',
      sectionId: sectionId,
      offset: offset
    });
  }
  function scheduleReaderWindowCheck() {
    if (readerWindowTicking) return;
    readerWindowTicking = true;
    window.requestAnimationFrame(maybeNotifyReaderWindowSection);
  }
  window.addEventListener('resize', function () {
    positionSummaryRail(document.querySelector('.summary-epub-summary-rail'));
    positionSelectionAction(document.querySelector('.summary-epub-selection-action'), currentSelectionAction);
    clearTextSelectionAction();
    scheduleReaderWindowCheck();
  });
  window.addEventListener('scroll', function () {
    positionSelectionAction(document.querySelector('.summary-epub-selection-action'), currentSelectionAction);
    scheduleReaderWindowCheck();
  }, { passive: true });
  function run() {
    ensureHeadingButtons();
    ensureHeadingObserver();
    window.addEventListener('message', onMessage);
    document.addEventListener('mousedown', onReaderMouseDown, true);
    document.addEventListener('mouseup', onReaderMouseUp);
    document.addEventListener('touchend', onReaderTouchEnd);
    document.addEventListener('selectionchange', onReaderSelectionChange);
    document.addEventListener('click', onReaderClick);
    scheduleReaderWindowCheck();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.addEventListener('load', function () {
    ensureHeadingButtons();
    scheduleReaderWindowCheck();
  });
})();
</script>
`;

export type HeadingInteractionMessage = {
  type?: string;
  [key: string]: unknown;
};

export type HeadingInteractionBridge = {
  postToParent: (payload: HeadingInteractionMessage) => void;
  receive?: (event: { data: HeadingInteractionMessage }) => void;
};

function headingRuntimeSource(): string {
  const start = HEADING_INTERACTION_SCRIPT.indexOf("(function () {");
  const end = HEADING_INTERACTION_SCRIPT.lastIndexOf("})();");
  if (start < 0 || end <= start) {
    throw new Error("EPUB heading interaction runtime is unavailable");
  }
  return HEADING_INTERACTION_SCRIPT.slice(start, end + "})();".length)
    .replace(
      "window.parent.postMessage(payload, window.location.origin);",
      "bridge.postToParent(payload);",
    )
    .replace(
      "if (typeof IntersectionObserver === 'undefined') return;",
      "if (!window.IntersectionObserver) return;",
    )
    .replace(
      "var observer = new IntersectionObserver(function (entries) {",
      "var observer = new window.IntersectionObserver(function (entries) {",
    )
    .replaceAll("NodeFilter.", "window.NodeFilter.")
    .replace(
      "window.addEventListener('message', onMessage);",
      "bridge.receive = onMessage;",
    );
}

export function installHeadingInteractionRuntime(
  iframeWindow: Window,
  iframeDocument: Document,
  bridge: HeadingInteractionBridge,
): void {
  const source = headingRuntimeSource();
  // The source is static application code. It is executed from the parent realm
  // so the iframe can stay sandboxed without allow-scripts.
  const run = new Function("window", "document", "bridge", source) as (
    iframeWindow: Window,
    iframeDocument: Document,
    bridge: HeadingInteractionBridge,
  ) => void;
  run(iframeWindow, iframeDocument, bridge);
}
