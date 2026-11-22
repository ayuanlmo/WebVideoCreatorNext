import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import WebVideoCreator from "../../dist/index";
import { resolveFfmpegPath } from "../../dist/lib/ffmpeg-path";

// 上游 issues/34：backgroundOpacity:0 时显式 pixelFormat:"rgb24" 静默丢弃透明通道（导出仍是3通道）
// 验证默认 yuva420p 透明真实生效，并要求无 alpha 的显式像素格式快速失败

const OUTPUT_DIR = path.resolve("tmp/test-output");
const WIDTH = 320;

// 透明背景 + 中央红色方块
const CONTENT = `<!DOCTYPE html><html><body style="margin:0;background:transparent">
<div style="position:absolute;left:110px;top:70px;width:100px;height:100px;background:red"></div>
</body></html>`;

// 提取指定坐标像素 RGBA
// VP8/VP9 的 alpha 经 webm 容器 BlockAdditional 承载：ffprobe 的 pix_fmt 恒报 yuv420p，
// 原生解码器也不合成 alpha，必须强制 libvpx 系解码器才可见真实透明像素
async function extractPixel(videoPath: string, x: number, y: number, decoder: string): Promise<number[]> {
    return new Promise((resolve, reject): void => {
        const proc = spawn(resolveFfmpegPath(), [
            "-c:v", decoder, "-ss", "0.2", "-i", videoPath,
            "-frames:v", "1", "-pix_fmt", "rgba", "-f", "rawvideo", "pipe:1"
        ]);
        const chunks: Buffer[] = [];
        proc.stdout.on("data", (chunk): number => chunks.push(chunk));
        proc.on("error", reject);
        proc.on("close", (code): void => {
            if (code !== 0)
                return reject(new Error(`ffmpeg extract frame exit code ${code}`));
            const buf = Buffer.concat(chunks);
            const offset = (y * WIDTH + x) * 4;
            resolve([buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]]);
        });
    });
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
});

describe("集成：issue-34 透明通道与像素格式", (): void => {
    it("backgroundOpacity:0 默认输出带 alpha 的视频（透明像素真实存在）", async (): Promise<void> => {
        const outputPath = path.join(OUTPUT_DIR, "issue-34-alpha.webm");
        const wvc = new WebVideoCreator();
        wvc.config({});
        try {
            const video = wvc.createSingleVideo({
                content: CONTENT,
                outputPath,
                width: WIDTH,
                height: 240,
                fps: 10,
                duration: 400,
                backgroundOpacity: 0
            });
            await video.startAndWait();
        } finally {
            await wvc.destroy();
        }
        expect(await fs.pathExists(outputPath)).toBe(true);
        // 角落在透明背景上，alpha 应接近 0
        const corner = await extractPixel(outputPath, 4, 4, "libvpx");
        expect(corner[3]).toBeLessThan(16);
        // 中央红色方块不透明且为红色
        const center = await extractPixel(outputPath, 160, 120, "libvpx");
        expect(center[3]).toBeGreaterThan(239);
        expect(center[0]).toBeGreaterThan(200);
    }, 300000);

    it("backgroundOpacity<1 显式指定无 alpha 的 pixelFormat 快速失败", async (): Promise<void> => {
        const wvc = new WebVideoCreator();
        wvc.config({});
        try {
            expect((): void => {
                wvc.createSingleVideo({
                    content: CONTENT,
                    outputPath: path.join(OUTPUT_DIR, "issue-34-rgb24.webm"),
                    width: 320,
                    height: 240,
                    fps: 10,
                    duration: 400,
                    backgroundOpacity: 0,
                    pixelFormat: "rgb24"
                });
            }).toThrow(/alpha/i);
        } finally {
            await wvc.destroy();
        }
    }, 300000);
});
