"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Database,
  Download,
  KeyRound,
  MessageSquareText,
  Save,
  Server,
  Settings2,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { ReaderSettingsControls } from "@/components/reader-settings-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import type {
  ImportBackupResult,
  ImportSettingsBackupResult,
} from "@/hooks/use-book-workspace";
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

function SettingsSection({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border bg-background/72 p-4 shadow-sm shadow-black/[0.02] ${className}`}>
      <div className="mb-3 flex items-start gap-2">
        {icon ? (
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EpubSettingsDialog({
  open,
  onClose,
  library,
  currentBookId,
  onExportBook,
  onExportCurrentBook,
  onExportLibrary,
  onExportSettings,
  onImportBackup,
  onImportSettingsBackup,
}: {
  open: boolean;
  onClose: () => void;
  library: BookLibraryItem[];
  currentBookId: string | null;
  onExportBook: (bookId: string) => Promise<void>;
  onExportCurrentBook: () => Promise<void>;
  onExportLibrary: () => Promise<void>;
  onExportSettings: () => Promise<void> | void;
  onImportBackup: (file: File) => Promise<ImportBackupResult>;
  onImportSettingsBackup: (file: File) => Promise<ImportSettingsBackupResult>;
}) {
  const [ai, setAi] = useState<AiSettings>(() => loadAiSettings());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [dataBusy, setDataBusy] = useState<string | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const bookImportInputRef = useRef<HTMLInputElement>(null);
  const settingsImportInputRef = useRef<HTMLInputElement>(null);
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

  const onImportBookFile = (file: File | undefined) => {
    if (!file) return;
    void runDataAction("import-books", async () => {
      const result = await onImportBackup(file);
      const parts: string[] = [];
      if (result.imported > 0) parts.push(`已加载 ${result.imported} 本书`);
      if (result.skipped > 0) {
        parts.push(`跳过 ${result.skipped} 本 summary-only 备份`);
      }
      return parts.join("，") || "操作完成";
    });
  };

  const onImportSettingsFile = (file: File | undefined) => {
    if (!file) return;
    void runDataAction("import-settings", async () => {
      const result = await onImportSettingsBackup(file);
      if (result.settings.ai) {
        setAi(loadAiSettings());
      }
      if (result.settings.reader) {
        patchReaderSettings(result.settings.reader);
      }
      if (result.settings.epubDisplayMode) {
        setDisplayMode(result.settings.epubDisplayMode);
      }
      return result.settingsImported
        ? "已导入配置（不含 API key）"
        : "没有可导入的配置";
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <Card className="flex h-[min(92dvh,760px)] w-full max-w-5xl gap-0 overflow-hidden rounded-xl py-0 shadow-2xl shadow-black/20">
        <CardHeader className="shrink-0 border-b px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Settings 设置</CardTitle>
              <CardDescription className="mt-1">
                模型、阅读偏好和本地备份管理
              </CardDescription>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="关闭设置"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 px-0">
          <Tabs
            defaultValue="ai"
            orientation="vertical"
            className="grid h-full min-h-0 gap-0 md:grid-cols-[184px_minmax(0,1fr)]"
          >
            <TabsList
              variant="line"
              className="m-3 grid h-auto w-auto grid-cols-3 items-stretch rounded-lg border bg-muted/30 p-1 md:m-0 md:flex md:h-full md:w-full md:flex-col md:items-stretch md:justify-start md:rounded-none md:border-0 md:border-r md:bg-muted/20 md:p-3"
            >
              <TabsTrigger
                value="ai"
                className="h-9 w-full flex-none md:h-10 md:justify-start md:px-3"
              >
                <KeyRound className="h-4 w-4" />
                <span>AI</span>
              </TabsTrigger>
              <TabsTrigger
                value="reader"
                className="h-9 w-full flex-none md:h-10 md:justify-start md:px-3"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>阅读</span>
              </TabsTrigger>
              <TabsTrigger
                value="data"
                className="h-9 w-full flex-none md:h-10 md:justify-start md:px-3"
              >
                <Database className="h-4 w-4" />
                <span>数据</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="mx-auto max-w-3xl space-y-4">
                <SettingsSection
                  title="模型连接"
                  description="API key 仅保存在本机；配置备份不会包含它。"
                  icon={<Server className="h-4 w-4" />}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AI_PROVIDER_PRESETS.map((preset) => {
                      const active = selectedPresetId
                        ? selectedPresetId === preset.id
                        : preset.baseUrl === ai.baseUrl;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`min-h-[76px] rounded-lg border p-3 text-left transition hover:bg-muted ${
                            active
                              ? "border-primary bg-secondary/70 text-secondary-foreground"
                              : "bg-background"
                          }`}
                          onClick={() => applyPreset(preset)}
                        >
                          <span className="block text-sm font-medium">
                            {preset.name}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                            {preset.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={ai.model}
                        onChange={(e) =>
                          setAi((s) => ({ ...s, model: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
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
                  </div>

                  {modelOptions && modelOptions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
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
                </SettingsSection>

                <SettingsSection
                  title="总结 Prompt"
                  description="分别控制段落总结和标题范围总结的 system/user 模板。"
                  icon={<MessageSquareText className="h-4 w-4" />}
                >
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="summarySystem">
                          按段总结 System Prompt
                        </Label>
                        <Textarea
                          id="summarySystem"
                          rows={5}
                          value={ai.summarySystemPrompt ?? ""}
                          className="min-h-32"
                          onChange={(e) =>
                            setAi((s) => ({
                              ...s,
                              summarySystemPrompt: e.target.value,
                            }))
                          }
                          placeholder={DEFAULT_SUMMARY_SYSTEM_PROMPT}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="summaryUser">按段总结 User 模板</Label>
                        <Textarea
                          id="summaryUser"
                          rows={6}
                          value={ai.summaryUserTemplate ?? ""}
                          className="min-h-36"
                          onChange={(e) =>
                            setAi((s) => ({
                              ...s,
                              summaryUserTemplate: e.target.value,
                            }))
                          }
                          placeholder={DEFAULT_SUMMARY_USER_TEMPLATE}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="headingSummarySystem">
                          标题范围总结 System Prompt
                        </Label>
                        <Textarea
                          id="headingSummarySystem"
                          rows={5}
                          value={ai.headingSummarySystemPrompt ?? ""}
                          className="min-h-32"
                          onChange={(e) =>
                            setAi((s) => ({
                              ...s,
                              headingSummarySystemPrompt: e.target.value,
                            }))
                          }
                          placeholder={DEFAULT_HEADING_SUMMARY_SYSTEM_PROMPT}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="headingSummaryUser">
                          标题范围总结 User 模板
                        </Label>
                        <Textarea
                          id="headingSummaryUser"
                          rows={6}
                          value={ai.headingSummaryUserTemplate ?? ""}
                          className="min-h-36"
                          onChange={(e) =>
                            setAi((s) => ({
                              ...s,
                              headingSummaryUserTemplate: e.target.value,
                            }))
                          }
                          placeholder={DEFAULT_HEADING_SUMMARY_USER_TEMPLATE}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    可用占位符：{"{title}"}、{"{paragraph}"}、{"{index}"}、{"{total}"}、{"{chapterTitle}"}、{"{heading}"}、{"{level}"}、{"{content}"}。
                  </div>
                </SettingsSection>
              </div>
            </TabsContent>

            <TabsContent value="reader" className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="mx-auto max-w-2xl">
                <SettingsSection
                  title="阅读偏好"
                  description="阅读设置会立即应用到 EPUB 阅读视图。"
                  icon={<SlidersHorizontal className="h-4 w-4" />}
                >
                  <ReaderSettingsControls
                    readerSettings={readerSettings}
                    onPatchReaderSettings={patchReaderSettings}
                    displayMode={displayMode}
                    onDisplayModeChange={setDisplayMode}
                  />
                </SettingsSection>
              </div>
            </TabsContent>

            <TabsContent value="data" className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="mx-auto max-w-4xl space-y-4">
                {dataMessage ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {dataMessage}
                  </p>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                  <SettingsSection
                    title="书籍数据备份"
                    description="导出 EPUB/PDF 文件、章节目录、总结、批注、书签和阅读位置。"
                    icon={<BookOpen className="h-4 w-4" />}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
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

                    <div className="mt-4 space-y-2">
                      <Label>按书籍导出</Label>
                      {library.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          书库为空
                        </div>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
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

                    <div className="mt-4 space-y-2 border-t pt-3">
                      <Label>导入书籍数据</Label>
                      <Input
                        ref={bookImportInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          onImportBookFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        disabled={!!dataBusy}
                        onClick={() => bookImportInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        加载书籍备份 JSON
                      </Button>
                      <p className="text-xs leading-5 text-muted-foreground">
                        旧版 summary-only JSON 会合并到同名已存在书籍；不会导入或覆盖全局配置。
                      </p>
                    </div>
                  </SettingsSection>

                  <SettingsSection
                    title="配置备份"
                    description="单独导出/导入 AI Base URL、模型、prompt 和阅读偏好。"
                    icon={<Settings2 className="h-4 w-4" />}
                  >
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start gap-2"
                        disabled={!!dataBusy}
                        onClick={() =>
                          void runDataAction("settings", async () => {
                            await onExportSettings();
                            return "已导出配置备份";
                          })
                        }
                      >
                        <Download className="h-4 w-4" />
                        导出配置
                      </Button>
                      <Input
                        ref={settingsImportInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          onImportSettingsFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start gap-2"
                        disabled={!!dataBusy}
                        onClick={() => settingsImportInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        加载配置备份 JSON
                      </Button>
                    </div>
                    <p className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      配置备份不包含 API key；导入时会保留当前 API key。也兼容读取旧备份文件顶层的 settings 字段。
                    </p>
                  </SettingsSection>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="shrink-0 justify-end gap-2 bg-background/95 px-4 py-3">
          <Button variant="outline" className="gap-1.5" onClick={onClose}>
            <X className="h-4 w-4" />
            关闭
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => {
              saveAiSettings(ai);
              onClose();
            }}
          >
            <Save className="h-4 w-4" />
            保存 AI 并关闭
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
