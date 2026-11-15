import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import { core, util, TRANSITION } from "../../dist/index";
import { resolveFfmpegPath } from "../../dist/lib/ffmpeg-path";
import type { IRenderResult } from "../../dist/core/Synthesizer";

const OUTPUT_DIR = path.resolve("tmp/test-output");
let frame: Buffer;

// 生成单帧JPEG作为帧输入素材（直接调用FFmpeg，绕过fluent-ffmpeg的输入格式探测）
async function createFrame(): Promise<Buffer> {
    const framePath = path.join(OUTPUT_DIR, "low-level-frame.jpg");
    if (!await fs.pathExists(framePath)) {
        await new Promise<void>((resolve, reject): void => {
            const proc = spawn(resolveFfmpegPath(), [
                "-hide_banner", "-f", "lavfi", "-i", "color=c=red:s=320x240:d=1",
                "-frames:v", "1", "-update", "1", "-y", framePath
            ]);
            proc.once("error", reject);
            proc.once("exit", (code): void => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
        });
    }
    return await fs.readFile(framePath);
}

// 输入帧并等待合成完成
async function renderChunk(chunk: core.Synthesizer, frameCount: number): Promise<IRenderResult> {
    const completed = new Promise<IRenderResult>((resolve, reject): void => {
        chunk.once("completed", resolve);
        chunk.once("error", reject);
    });
    chunk.start();
    for (let i = 0; i < frameCount; i++)
        await chunk.input(frame);
    chunk.endInput();
    return await completed;
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    frame = await createFrame();
});

describe("集成：低级别合成器 API", (): void => {
    it("Synthesizer 直接输入帧合成 mp4", async (): Promise<void> => {
        const outputPath = path.join(OUTPUT_DIR, "low-level-synth.mp4");
        const synth = new core.Synthesizer({
            outputPath,
            width: 320,
            height: 240,
            fps: 10,
            duration: 1000
        });
        const result = await renderChunk(synth, 10);
        expect(result.duration).toBeGreaterThanOrEqual(900);
        expect(result.rtf).toBeGreaterThan(0);
        const duration = await util.getMediaDuration(outputPath);
        expect(duration).toBeGreaterThanOrEqual(850);
        expect(duration).toBeLessThanOrEqual(1200);
    }, 300000);

    it("VideoChunk 渲染后经 ChunkSynthesizer 带转场合并", async (): Promise<void> => {
        const chunk1 = new core.VideoChunk({ width: 320, height: 240, fps: 10, duration: 500 });
        await renderChunk(chunk1, 5);
        expect(chunk1.isCompleted()).toBe(true);
        chunk1.setTransition({ id: TRANSITION.FADE, duration: 200 });
        const chunk2 = new core.VideoChunk({ width: 320, height: 240, fps: 10, duration: 500 });
        await renderChunk(chunk2, 5);

        const outputPath = path.join(OUTPUT_DIR, "low-level-merge.mp4");
        const synthesizer = new core.ChunkSynthesizer({
            outputPath,
            width: 320,
            height: 240,
            fps: 10
        });
        synthesizer.input(chunk1);
        synthesizer.input(chunk2);
        const completed = new Promise<IRenderResult>((resolve, reject): void => {
            synthesizer.once("completed", resolve);
            synthesizer.once("error", reject);
        });
        synthesizer.start();
        await completed;
        expect(await fs.pathExists(outputPath)).toBe(true);
        // 两段各500ms减去200ms转场重叠
        const duration = await util.getMediaDuration(outputPath);
        expect(duration).toBeGreaterThanOrEqual(650);
        expect(duration).toBeLessThanOrEqual(1000);
    }, 300000);
});
