import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import ffmpegStatic from "ffmpeg-static";
import {path as ffprobeStatic} from "ffprobe-static";

// 编译后本文件位于 dist/lib/，两层 dirname 指向 dist，再上一层为包根
const ROOT_PATH = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VENDOR_DIR = path.join(ROOT_PATH, "..", "vendor", "ffmpeg");
const exeSuffix = process.platform === "win32" ? ".exe" : "";

// 优先选用 scripts/install-ffmpeg.mjs 安装的可用的静态构建，
// 回退 ffmpeg-static/ffprobe-static（其 7.0.2 静态构建 mpegts 解复用器损坏，多幕视频会崩溃）
function resolveVendor(name: string): string | null {
    const target = path.join(VENDOR_DIR, name + exeSuffix);
    return fs.existsSync(target) ? target : null;
}

// 解析 FFmpeg 可执行文件路径
export function resolveFfmpegPath(): string {
    return resolveVendor("ffmpeg") || (ffmpegStatic as unknown as string);
}

// 解析 FFprobe 可执行文件路径
export function resolveFfprobePath(): string {
    return resolveVendor("ffprobe") || ffprobeStatic;
}