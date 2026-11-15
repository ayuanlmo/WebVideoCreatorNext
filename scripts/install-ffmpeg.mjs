// 安装可用的静态 FFmpeg/FFprobe 到 vendor/ffmpeg。
// ffmpeg-static@5.3.0 内置的 johnvansickle 7.0.2 静态构建存在 mpegts 解复用器缺陷：
// 读取任何 .ts 文件即段错误（ip 指向坏函数指针），导致多幕视频（xfade/concat 读 .ts）崩溃。
// 本脚本从 BtbN/FFmpeg-Builds 下载已验证可用的静态构建（ffmpeg 8.1 稳定分支），
// 运行时由 src/lib/ffmpeg-path.ts 优先选用；未覆盖的平台（如 macOS）回退 ffmpeg-static。
import path from "path";
import os from "os";
import {fileURLToPath} from "url";
import {spawnSync} from "child_process";
import fs from "fs-extra";
import process from "node:process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = path.join(rootDir, "vendor", "ffmpeg");
const exeSuffix = process.platform === "win32" ? ".exe" : "";
const ffmpegBin = path.join(vendorDir, "ffmpeg" + exeSuffix);
const ffprobeBin = path.join(vendorDir, "ffprobe" + exeSuffix);

// "latest" 为 BtbN 持久标签，n8.1 为稳定分支构建（已实证 mpegts/xfade/image2pipe 均正常）
const RELEASE_BASE = "https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/latest";
const ASSETS = {
    "linux-x64": "ffmpeg-n8.1-latest-linux64-gpl-8.1.tar.xz",
    "linux-arm64": "ffmpeg-n8.1-latest-linuxarm64-gpl-8.1.tar.xz",
    "win32-x64": "ffmpeg-n8.1-latest-win64-gpl-8.1.zip",
    "win32-arm64": "ffmpeg-n8.1-latest-winarm64-gpl-8.1.zip"
};

const log = msg => console.log(`[install-ffmpeg] ${msg}`);

function isInstalled() {
    if (!fs.existsSync(ffmpegBin) || !fs.existsSync(ffprobeBin))
        return false;
    return spawnSync(ffmpegBin, ["-version"], {encoding: "utf8"}).status === 0;
}

// 生成测试 .ts 再读回，验证 mpegts 解复用可用，拦截损坏构建
function verifyMpegts() {
    const testTs = path.join(vendorDir, ".verify.ts");
    try {
        const gen = spawnSync(ffmpegBin, [
            "-y", "-f", "lavfi", "-i", "color=c=red:s=64x64:r=10:d=0.2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mpegts", testTs
        ], {encoding: "utf8"});
        if (gen.status !== 0)
            return false;
        const read = spawnSync(ffmpegBin, ["-y", "-i", testTs, "-c", "copy", "-f", "null", "-"], {encoding: "utf8"});
        return read.status === 0;
    } finally {
        fs.removeSync(testTs);
    }
}

// 使用系统 curl 下载（GitHub CDN 对 native fetch 的 HTTP/2 连接偶发重置，curl 更稳健）
function download(url, dest) {
    const r = spawnSync("curl", ["-fL", "--retry", "3", "--retry-delay", "2", "-o", dest, url], {stdio: "inherit"});
    if (r.status !== 0)
        throw new Error(`下载失败 ${url}（curl exit ${r.status}，需要系统 curl）`);
}

const key = `${process.platform}-${os.arch()}`;
const asset = ASSETS[key];
if (!asset) {
    log(`平台 ${key} 无预构建静态 FFmpeg，回退 ffmpeg-static`);
    process.exit(0);
}
if (isInstalled()) {
    log(`已安装可用静态 FFmpeg，跳过：${ffmpegBin}`);
    process.exit(0);
}

const archive = path.join(vendorDir, asset);
const extractDir = path.join(vendorDir, ".extract");
// 下载/解压/验证失败（网络、磁盘空间不足、损坏构建）只警告并清理残留，
// 不中断 npm install：运行时 resolveFfmpegPath 会自动回退 ffmpeg-static
try {
    await fs.ensureDir(vendorDir);
    log(`下载 ${asset} ...`);
    download(`${RELEASE_BASE}/${asset}`, archive);
    log("解压 ...");
    await fs.ensureDir(extractDir);
    const tar = spawnSync("tar", ["-xf", archive, "-C", extractDir], {encoding: "utf8"});
    if (tar.status !== 0)
        throw new Error(`解压失败（需要系统 tar）：${tar.stderr || tar.error}`);
    const top = (await fs.readdir(extractDir))[0];
    const binDir = path.join(extractDir, top, "bin");
    await fs.copy(path.join(binDir, "ffmpeg" + exeSuffix), ffmpegBin);
    await fs.copy(path.join(binDir, "ffprobe" + exeSuffix), ffprobeBin);
    await fs.chmod(ffmpegBin, 0o755);
    await fs.chmod(ffprobeBin, 0o755);
    if (!verifyMpegts())
        throw new Error("静态 FFmpeg mpegts 验证失败，构建可能损坏");
    await fs.remove(extractDir);
    await fs.remove(archive);
    const ver = spawnSync(ffmpegBin, ["-version"], {encoding: "utf8"}).stdout.split("\n")[0];
    log(`安装完成：${ver}`);
}
catch (err) {
    await fs.remove(extractDir).catch(() => {});
    await fs.remove(archive).catch(() => {});
    await fs.remove(ffmpegBin).catch(() => {});
    await fs.remove(ffprobeBin).catch(() => {});
    log(`安装失败：${err.message}`);
    log("已清理残留，回退 ffmpeg-static；如需 vendor 静态构建可稍后重新安装本包");
    process.exit(0);
}