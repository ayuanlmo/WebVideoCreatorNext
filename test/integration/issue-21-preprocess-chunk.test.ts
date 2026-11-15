import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import http from "http";
import type { AddressInfo } from "net";
import { spawn } from "child_process";
import WebVideoCreator, { util } from "../../dist/index";
import { resolveFfmpegPath } from "../../dist/lib/ffmpeg-path";

const OUTPUT_DIR = path.resolve("tmp/test-output");
const VIDEO_PATH = path.join(OUTPUT_DIR, "issue21-source.mp4");
let server: http.Server | null = null;
let baseURL = "";

// 生成带噪声的测试视频，转码后的回传数据足以覆盖多个分片
async function createSourceVideo(): Promise<void> {
    if (await fs.pathExists(VIDEO_PATH))
        return;
    await new Promise<void>((resolve, reject): void => {
        const proc = spawn(resolveFfmpegPath(), [
            "-hide_banner", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
            "-t", "4", "-b:v", "2M", "-y", VIDEO_PATH
        ]);
        proc.once("error", reject);
        proc.once("exit", (code): void => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
    });
}

// 提供视频文件下载的本地服务
async function startVideoServer(): Promise<string> {
    const data = await fs.readFile(VIDEO_PATH);
    server = http.createServer((req, res): void => {
        res.writeHead(200, {
            "Content-Type": "video/mp4",
            "Content-Length": String(data.length)
        });
        res.end(data);
    });
    await new Promise<void>((resolve): void => void server!.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseURL = `http://127.0.0.1:${port}/video.mp4`;
    return baseURL;
}

async function stopVideoServer(): Promise<void> {
    if (!server) return;
    const s = server;
    server = null;
    await new Promise<void>((resolve): void => void s.close((): void => resolve()));
}

async function render(name: string, chunkSize: number): Promise<{ outputPath: string; chunkRequests: number }> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const chunkUrls: string[] = [];
    const wvc = new WebVideoCreator();
    wvc.config({ preprocessChunkSize: chunkSize });
    const video = wvc.createSingleVideo({
        content: `<video src="${baseURL}" muted video-capture></video>`,
        outputPath,
        width: 320,
        height: 240,
        fps: 10,
        duration: 1500,
        pagePrepareFn: async (page): Promise<void> => {
            page.on("resourceAccepted", (info): void => {
                if (info.url.indexOf("/api/video_preprocess_chunk") != -1)
                    chunkUrls.push(info.url);
            });
        }
    });
    await video.startAndWait();
    await wvc.destroy();
    return { outputPath, chunkRequests: chunkUrls.length };
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await createSourceVideo();
    await startVideoServer();
});

afterAll(async (): Promise<void> => {
    await stopVideoServer();
});

// 上游 Vinlic/WebVideoCreator#21：嵌入视频过长时预处理数据整体回传超过浏览器约100MB缓冲上限导致渲染失败
describe("集成：预处理数据分片传输（上游 issues/21 回归）", (): void => {
    it("小分片阈值下渲染嵌入视频（分片传输路径）", async (): Promise<void> => {
        const { outputPath, chunkRequests } = await render("issue21-chunked.mp4", 16 * 1024);
        expect(await fs.pathExists(outputPath)).toBe(true);
        // 分片协议必须真实发生
        expect(chunkRequests).toBeGreaterThanOrEqual(2);
        const duration = await util.getMediaDuration(outputPath);
        expect(duration).toBeGreaterThanOrEqual(1350);
        expect(duration).toBeLessThanOrEqual(1800);
    }, 300000);

    it("默认分片阈值下渲染嵌入视频（单次应答路径）", async (): Promise<void> => {
        const { outputPath, chunkRequests } = await render("issue21-single.mp4", 33554432);
        expect(await fs.pathExists(outputPath)).toBe(true);
        // 数据未超过分片大小时保持单次应答
        expect(chunkRequests).toBe(0);
        const duration = await util.getMediaDuration(outputPath);
        expect(duration).toBeGreaterThanOrEqual(1350);
        expect(duration).toBeLessThanOrEqual(1800);
    }, 300000);
});
