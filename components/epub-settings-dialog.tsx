"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { ReaderSettingsControls } from "@/components/reader-settings-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEpubDisplayMode } from "@/hooks/use-epub-display-mode";
import { useReaderSettings } from "@/hooks/use-reader-settings";
import type { BookLibraryItem } from "@/hooks/use-book-library-state";
import type { ImportBackupResult } from "@/hooks/use-book-workspace";
import { documentFormatForBook, documentFormatLabel } from "@/lib/documents";
import { loadAiSettings, saveAiSettings } from "@/lib/settings";
import {
  DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_HEADING_SUMMARY_USER_TEMPLATE,
  DEFAULT_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_SUMMARY_USER_TEMPLATE,
} from "@/lib/summary-prompt";
import type { AiSettings } from "@/lib/types";

type AiProviderPreset = {
  id: string;
  name: string;
  description: string;
  baseUrl?: string;
  models: string[];
};

const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "官方 OpenAI Chat Completions",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek OpenAI-compatible API",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat"],
  },
  {
    id: "openai-compatible",
    name: "OpenAI Compatible",
    description: "自定义兼容 /chat/completions 的服务",
    models: ["gpt-4o-mini", "deepseek-chat"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "OpenAI-compatible 聚合网关",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "openai/gpt-4o-mini",
      "deepseek/deepseek-chat",
      "anthropic/claude-3.5-haiku",
    ],
  },
];

export function EpubSettingsDialog({
  open,
  onClose,
  library,
  currentBookId,
  onExportBook,
  onExportCurrentBook,
  onExportLibrary,
  onImportBackup,
}: {
  open: boolean;
  onClose: () => void;
  library: BookLibraryItem[];
  currentBookId: string | null;
  onExportBook: (bookId: string) => Promise<void>;
  onExportCurrentBook: () => Promise<void>;
  onExportLibrary: () => Promise<void>;
  onImportBackup: (file: File) => Promise<ImportBackupResult>;
}) {
  const [ai, setAi] = useState<AiSettings>(() => loadAiSettings());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [dataBusy, setDataBusy] = useState<string | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { mode: displayMode, setMode: setDisplayMode } = useEpubDisplayMode();
  const { settings: readerSettings, patchSettings: patchReaderSettings } =
    useReaderSettings();
  const matchingPreset = AI_PROVIDER_PRESETS.find(
    (preset) => preset.baseUrl && preset.baseUrl === ai.baseUrl,
  );
  const selectedPreset = AI_PROVIDER_PRESETS.find(
    (preset) => preset.id === selectedPresetId,
  );
  const currentPreset = selectedPreset ?? matchingPreset;
  const modelOptions =
    currentPreset?.models.includes(ai.model) || !currentPreset
      ? currentPreset?.models
      : [ai.model, ...currentPreset.models];

  const applyPreset = (preset: AiProviderPreset) => {
    setSelectedPresetId(preset.id);
    setAi((settings) => ({
      ...settings,
      baseUrl: preset.baseUrl ?? settings.baseUrl,
      model: preset.models[0],
    }));
  };

  const runDataAction = async (
    busyLabel: string,
    action: () => Promise<string | void>,
  ) => {
    setDataBusy(busyLabel);
    setDataMessage(null);
    try {
      const message = await action();
      setDataMessage(message ?? "操作完成");
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setDataBusy(null);
    }
  };

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    void runDataAction("import", async () => {
      const result = await onImportBackup(file);
      const skippedText =
        result.skipped > 0 ? `，跳过 ${result.skipped} 本 summary-only 备份` : "";
      return `已加载 ${result.imported} 本书${skippedText}`;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>设置</CardTitle>
          <CardDescription>AI 与阅读偏好均保存在本机 localStorage。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <Tabs defaultValue="ai">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="ai" className="flex-1">
                AI
              </TabsTrigger>
              <TabsTrigger value="reader" className="flex-1">
                阅读
              </TabsTrigger>
              <TabsTrigger value="data" className="flex-1">
                数据
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="space-y-4">
              <div className="space-y-2">
                <Label>常用供应商</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AI_PROVIDER_PRESETS.map((preset) => {
                    const active = selectedPresetId
                      ? selectedPresetId === preset.id
                      : preset.baseUrl === ai.baseUrl;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`rounded-md border p-2 text-left transition hover:bg-muted ${
                          active ? "border-primary bg-muted" : "bg-background"
                        }`}
                        onClick={() => applyPreset(preset)}
                      >
                        <span className="block text-sm font-medium">
                          {preset.name}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  官方和聚合商预设会填充 Base URL 和默认 Model；OpenAI Compatible 会保留当前 Base URL，只切换模型建议。所有预设都不会修改 API key。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={ai.apiKey}
                  onChange={(e) =>
                    setAi((s) => ({ ...s, apiKey: e.target.value }))
                  }
                  placeholder="sk-..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={ai.baseUrl}
                  onChange={(e) => {
                    setSelectedPresetId(null);
                    setAi((s) => ({ ...s, baseUrl: e.target.value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={ai.model}
                  onChange={(e) =>
                    setAi((s) => ({ ...s, model: e.target.value }))
                  }
                />
                {modelOptions && modelOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {modelOptions.map((model) => (
                      <Button
                        key={model}
                        type="button"
                        size="sm"
                        variant={ai.model === model ? "secondary" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          setAi((settings) => ({ ...settings, model }))
                        }
                      >
                        {model}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="summarySystem">按段总结 System Prompt</Label>
                <Textarea
                  id="summarySystem"
                  rows={4}
                  value={ai.summarySystemPrompt ?? ""}
                  onChange={(e) =>
                    setAi((s) => ({
                      ...s,
                      summarySystemPrompt: e.target.value,
                    }))
                  }
                  placeholder={DEFAULT_SUMMARY_SYSTEM_PROMPT}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summaryUser">按段总结 User 模板</Label>
                <Textarea
                  id="summaryUser"
                  rows={5}
                  value={ai.summaryUserTemplate ?? ""}
                  onChange={(e) =>
                    setAi((s) => ({
                      ...s,
                      summaryUserTemplate: e.target.value,
                    }))
                  }
                  placeholder={DEFAULT_SUMMARY_USER_TEMPLATE}
                />
                <p className="text-xs text-muted-foreground">
                  占位符：{"{title}"} 小节/页标题、{"{paragraph}"} 段落正文、{"{index}"} 段序号、{"{total}"} 总段数。每段单独一次 API 请求。
                </p>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="headingSummarySystem">
                  标题范围总结 System Prompt
                </Label>
                <Textarea
                  id="headingSummarySystem"
                  rows={6}
                  value={ai.headingSummarySystemPrompt ?? ""}
                  onChange={(e) =>
                    setAi((s) => ({
                      ...s,
                      headingSummarySystemPrompt: e.target.value,
                    }))
                  }
                  placeholder={DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT}
                />
                <p className="text-xs text-muted-foreground">
                  阅读页标题「总结本节」使用。请求 options 会追加到本 prompt 末尾。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="headingSummaryUser">
                  标题范围总结 User 模板
                </Label>
                <Textarea
                  id="headingSummaryUser"
                  rows={5}
                  value={ai.headingSummaryUserTemplate ?? ""}
                  onChange={(e) =>
                    setAi((s) => ({
                      ...s,
                      headingSummaryUserTemplate: e.target.value,
                    }))
                  }
                  placeholder={DEFAULT_HEADING_SUMMARY_USER_TEMPLATE}
                />
                <p className="text-xs text-muted-foreground">
                  占位符：{"{chapterTitle}"}、{"{heading}"}、{"{level}"}、{"{content}"}。
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                总结在浏览器内直连模型 API，需服务商允许 CORS 或兼容的 Base URL。
              </p>
            </TabsContent>
            <TabsContent value="reader">
              <ReaderSettingsControls
                readerSettings={readerSettings}
                onPatchReaderSettings={patchReaderSettings}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
              />
            </TabsContent>
            <TabsContent value="data" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={!currentBookId || !!dataBusy}
                    onClick={() =>
                      void runDataAction("current", async () => {
                        await onExportCurrentBook();
                        return "已导出当前书备份";
                      })
                    }
                  >
                    <Download className="h-4 w-4" />
                    导出当前书
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={library.length === 0 || !!dataBusy}
                    onClick={() =>
                      void runDataAction("library", async () => {
                        await onExportLibrary();
                        return "已导出全部书库备份";
                      })
                    }
                  >
                    <Download className="h-4 w-4" />
                    导出全部书库
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>按书籍导出</Label>
                {library.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    书库为空
                  </div>
                ) : (
                  <div className="space-y-2">
                    {library.map((item) => {
                      const isCurrent = item.id === currentBookId;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {documentFormatLabel(
                                documentFormatForBook(item.fileName, item.format),
                              )}
                              {isCurrent ? " · 当前打开" : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1.5"
                            disabled={!!dataBusy}
                            onClick={() =>
                              void runDataAction(item.id, async () => {
                                await onExportBook(item.id);
                                return `已导出「${item.fileName}」`;
                              })
                            }
                          >
                            <Download className="h-3.5 w-3.5" />
                            导出
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <Label>加载备份</Label>
                <Input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    onImportFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!!dataBusy}
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  加载备份 JSON
                </Button>
                <p className="text-xs text-muted-foreground">
                  支持这里导出的单本/全库备份；旧版 summary-only JSON 会合并到同名已存在书籍。
                </p>
              </div>

              {dataMessage ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {dataMessage}
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
            <Button
              onClick={() => {
                saveAiSettings(ai);
                onClose();
              }}
            >
              保存 AI 并关闭
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
