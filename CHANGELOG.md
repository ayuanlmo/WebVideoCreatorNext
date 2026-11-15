# 更新日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.1] - 2026-11-15

### 修复

- **postinstall 安装失败硬中断**：FFmpeg 下载/解压/验证失败（网络问题、磁盘空间不足、损坏构建）时不再中断 `npm install`，自动清理残留（含损坏的半成品二进制）并回退 ffmpeg-static；运行时 `resolveFfmpegPath` 仍优先使用 vendor 静态构建。

## [0.1.0] - 2026-11-15

首个衍生发布版本。基于 Vinlic/WebVideoCreator 0.0.34（上游已停止维护）进行 TypeScript 重写与现代化，保持核心 API 兼容。详见 [NOTICE](./NOTICE) 中的归属说明。

### 新增

- **TypeScript（ESM）重写**：全部源码迁移至 `src/`，编译产物与类型声明输出至 `dist/`，资源路径基于 `import.meta.url` 相对 dist 根解析。
- **内置可用静态 FFmpeg**：新增 `scripts/install-ffmpeg.mjs`（postinstall），从 FFmpeg-Builds 下载已验证的 BtbN n8.1 静态构建到 `vendor/ffmpeg`，并校验 mpegts 解复用可用；替代 `ffmpeg-static` 内置的损坏 7.0.2 静态构建（读取 `.ts` 即段错误，导致多幕视频崩溃）。未覆盖平台回退 `ffmpeg-static`。
- **测试**：单元测试 40 用例 + 集成测试 23 用例（真实浏览器与 FFmpeg 渲染），含「渲染并 destroy 后无浏览器进程泄漏、Node 自然退出」回归测试及高/低级别 API、上游 issues 回归测试。
- **持续集成**：GitHub Actions CI（Node 22/24/26 × ubuntu 全量，windows 冒烟）。
- **合规文件**：新增 `NOTICE`、`CHANGELOG.md`；`LICENSE`（Apache-2.0）保持不动。
- **别名导出**：新增 `WebVideoCreatorNext` 别名，主类仍为 `WebVideoCreator`（默认导出），保持 API 兼容。

### 变更

- **包名**：`web-video-creator` → `web-video-creator-next`；版本 `0.0.34` → `0.1.0`。
- **包管理**：迁移到 pnpm；`engines.node >= 22.2.0`。
- **依赖现代化**：`puppeteer-core` 25、`vitest` 4、`esbuild` 0.28、`vite` 6；移除已弃用且冗余的 `@types/generic-pool`（generic-pool 3.9 自带类型）。

### 修复

- **重复帧**：`Synthesizer.#drain()` 改用 `slice(0, frameBufferIndex)` 而非 `filter(v => v)`，避免残留上一批缓冲区导致输出帧重复（曾出现 15 帧输入产出 20 帧）。
- **GPU 进程崩溃**：同一浏览器多页面并发调用 `HeadlessExperimental.beginFrame` 会触发 "overlapping IssueExternalBeginFrame" 使 GPU 进程崩溃；改为浏览器级串行锁。
- **浏览器进程泄漏**：修复 puppeteer 25 下误用 `isConnected()`（应为 `connected` 属性）及 re-entrant `generic-pool.destroy` 拒绝导致进程未终止的问题，并增加进程组 kill 兜底，确保渲染后 Node 自然退出、无孤儿 chrome 进程。
- **FFmpeg 7 管道探测**：显式指定 image2pipe 输入解码器（mjpeg/png），绕过 ffmpeg≥7 对含 ICC profile 的 Chrome JPEG 截图自动探测失败（输出无流 → EINVAL）。
- **超长嵌入视频回传崩溃**（上游 [issues/21](https://github.com/Vinlic/WebVideoCreator/issues/21) 已修复）：嵌入视频过长时预处理数据整体回传浏览器超过约 100MB 读缓冲上限导致渲染失败。现改为分片传输：回传数据超过 `preprocessChunkSize`（默认 32MB）时自动返回分片清单并由页面逐片拉取；配套修复资源池销毁时 "Resource not currently part of this pool" 拒绝报错。集成测试 `issue-21-preprocess-chunk.test.ts` 覆盖分片与单次应答两条路径。
- **Blob/Base64 音频不被录制**（上游 [issues/29](https://github.com/Vinlic/WebVideoCreator/issues/29) 已修复）：`blob:` / `data:`（base64）来源的 `<audio>` 现可合入音轨，同时新增 `<source>` 子元素来源解析与 `captureCtx.addAudio` 的 blob/data 支持（blob 在页面内读取后以 data URI 传输，Node 侧解码落盘）。集成测试 `issue-29-audio.test.ts` 覆盖三条路径。
- **Synthesizer 同步喂帧竞态**：`start(); input(); endInput()` 连续同步调用时编码器取到空管道流导致合成挂起，已捕获管道流引用显式传递修复（低级别 API 直接使用合成器的场景）。

### 验证

- **4K/高分辨率渲染**（上游 [issues/27](https://github.com/Vinlic/WebVideoCreator/issues/27) 已验证）：新增像素级回归测试 `issue-27-4k.test.ts`，验证 4096×2160 输出尺寸与版面比例正确、`deviceScaleFactor` 不造成画面拉伸；高画质调优与 4K 用法见 README「4K 与高画质渲染」章节。
- 新增高/低级别 API 集成测试（`high-level-flow` / `low-level-synthesizer` / `low-level-render`）。

### 文档

- README（简体中文/English）代码示例统一使用 `WebVideoCreatorNext` 命名；新增「释放资源（destroy）」「终止渲染」等章节，API 参考补全 `destroy()`、`abort()`、`onPageAcquire()`、`preprocessChunkSize` 等成员与选项。
- 更新品牌 logo（web-video-creator-next.jpg）与 README 演示 GIF（960×540 / 24fps 粒子旋涡，≤5MB），移除单幕/多幕/分块三个示例 GIF。

### 安全

- `pnpm audit` 清零：升级 vitest 相关开发依赖树，消除 18 项已知漏洞（含 3 项 critical）；生产依赖无已知漏洞。

### 已知 / 延后

- `fluent-ffmpeg@2.1.3` 上游已标记弃用，但仍为核心合成 API，替换为独立后续工作。
- TypeScript 保持 5.9.x；7.x（原生编译器）待单独评估升级。

[0.1.0]: https://github.com/ayuanlmo/WebVideoCreatorNext/releases/tag/v0.1.0