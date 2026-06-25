"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hans">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 font-sans">
        <h1 className="text-lg font-semibold">无法加载应用</h1>
        <p className="max-w-md text-center text-sm text-neutral-600">
          {error.message ||
            "请确认已执行 npm run build，并用 npm start（standalone）或 Docker 启动；开发环境用 npm run dev。"}
        </p>
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm"
          onClick={() => reset()}
        >
          重试
        </button>
      </body>
    </html>
  );
}