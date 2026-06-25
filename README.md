# BookBrief

本地优先的 EPUB/PDF AI 阅读助手。BookBrief 用于导入本地或 URL 上的 EPUB/PDF，建立浏览器书库，阅读、搜索、书签和备份文档；EPUB 还支持按选中段落或标题范围生成 AI 总结、添加批注和翻译。

这是一个纯前端 Next.js 应用。文档内容不上传到本项目服务端，AI 请求由浏览器直连 OpenAI-compatible `/chat/completions` 接口。

## 功能概览

- 本地上传或 URL 导入 EPUB/PDF，保存为浏览器内书库。
- EPUB 按 OPF spine item 阅读，支持正文预览、段落选择、标题范围总结、所选段落总结、批注和翻译。
- PDF 使用 pdf.js canvas 渲染原版页面，保留图片显示，支持页面阅读、全文搜索和书签。
- 书库支持删除、最近阅读位置恢复、阅读偏好、沉浸阅读模式和章节/页面导航。
- AI 设置支持供应商预设、自定义 Base URL、Model、API Key 和 prompt 模板。
- 总结队列支持暂停、继续、重试和缓存命中；重复点击同一段落/标题优先复用 IndexedDB 中的结果。
- 支持导出当前书、按书籍导出、全库备份导出，以及导入备份。

## 能力边界

- EPUB section 固定为 OPF spine item，稳定 id 为 `spine-{index}`。
- PDF section 固定为页面，稳定 id 为 `page-{pageNumber}`；目录可使用 PDF outline 辅助跳转，但存储边界仍按页。
- AI 总结、批注和翻译当前只对 EPUB 阅读开启。
- PDF 当前聚焦原版页面渲染、图片显示、搜索和书签；PDF AI 总结、批注和翻译尚未开启。
- 扫描版或图片型 PDF 没有可提取文本时，搜索和未来总结能力都需要先做 OCR。

## 快速开始

```bash
npm install
npm run dev
```

开发服务默认地址为 <http://localhost:3000>。

测试用网页：<https://bb.vim.li>。

AList 中预览 EPUB/PDF 时可使用：

```text
https://bb.vim.li/?url=$e_url
```

常用校验命令：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

包管理器使用 npm，依赖锁定在 `package-lock.json`。内部包名仍为 `summary_epub`，避免影响已有部署和本地数据。

## Docker 运行

本地容器运行：

```bash
docker compose -f compose.example.yml up --build
```

默认暴露 <http://localhost:3000>。如需调整端口：

```bash
FRONTEND_PORT=3001 docker compose -f compose.example.yml up --build
```

`Dockerfile` 已使用 npm cache mount 缓解 rebuild 时依赖缓存拷贝和重复下载问题。本地 `compose.yml` 可按部署环境调整端口、Caddy 网络和镜像配置。

## AI 配置与 CORS

在应用内“设置”填写 OpenAI-compatible `/chat/completions` 配置：

- API Key
- Base URL
- Model
- 按段总结 prompt 模板
- 标题范围总结 prompt 模板

请求从浏览器直接发往模型服务，不经过本项目后端。模型服务必须允许浏览器跨域访问；如果提供商没有配置 CORS，需要使用用户信任的 CORS-enabled gateway 或本地代理。

## 数据与隐私

- EPUB/PDF blob、书籍列表、总结、批注和翻译：IndexedDB。
- AI 配置、阅读偏好、显示模式和最近阅读状态：localStorage。
- 没有 `app/api/*` 总结接口，也不会把整本书发送给项目服务端。
- 总结按用户操作触发，一次请求只处理一个选中段落集合、一个标题范围，或必要时处理其中的固定 token 分块。
- 现有 IndexedDB/localStorage key 保持不变，升级展示名不会清空旧数据。

## 当前限制与候选功能

- P1：批注/翻译管理面板，可按书籍集中查看、跳转和删除。
- P1：导出 Markdown，将总结、评论、翻译和书签整理成读书笔记。
- P1：PDF 扫描件检测和 OCR 提示，避免用户误以为搜索失效。
- P2：PDF AI 总结和批注，复用现有 block/summary cache 语义。
- P2：长 PDF 页面虚拟化，降低大文件内存和 canvas 渲染压力。
- P2：AI 配置诊断，提供 CORS、API key、model 错误的更明确提示。
