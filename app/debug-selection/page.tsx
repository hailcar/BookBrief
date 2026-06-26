"use client";

import { useState } from "react";
import { EpubSectionPreview } from "@/components/epub-section-preview";
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-settings";

const DEBUG_HTML = `<!DOCTYPE html>
<html lang="zh-Hans">
<head><title>Selection debug</title></head>
<body>
  <main>
    <p data-se-block-id="debug-p-1" data-block-id="debug-p-1">
      第一段用于测试左键拖拽选中文本后是否会出现评论和翻译按钮。这段文字需要足够长，方便浏览器创建真实文本选区。
    </p>
    <p data-se-block-id="debug-p-2" data-block-id="debug-p-2">
      第二段继续提供可选择内容，确保跨段批量选择时可以收集多个 block id，并把选区发送给父页面。
    </p>
  </main>
</body>
</html>`;

export default function DebugSelectionPage() {
  const [lastAction, setLastAction] = useState("idle");

  return (
    <main className="flex h-screen flex-col gap-3 bg-stone-100 p-4">
      <p id="selection-action-state" className="text-sm">
        {lastAction}
      </p>
      <div className="min-h-0 flex-1">
        <EpubSectionPreview
          html={DEBUG_HTML}
          title="Selection debug"
          displayMode="global"
          readerSettings={DEFAULT_READER_SETTINGS}
          sectionId="debug-section"
          onCommentTextSelection={(selection) =>
            setLastAction(`comment:${selection.blockIds.join(",")}`)
          }
          onTranslateTextSelection={(selection) =>
            setLastAction(`translate:${selection.blockIds.join(",")}`)
          }
        />
      </div>
    </main>
  );
}
