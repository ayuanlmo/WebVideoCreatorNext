import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import { core } from "../../dist/index";
import { resolveFfmpegPath } from "../../dist/lib/ffmpeg-path";
import type { IRenderResult } from "../../dist/core/Synthesizer";

const OUTPUT_DIR = path.resolve("tmp/test-output");
const WAV_PATH = path.join(OUTPUT_DIR, "issue39-sine.wav");
const SAMPLE_RATE = 8000;
let frame: Buffer;

// 生成2.5秒正弦波WAV作为测试音频（立体声适配 adelay 双声道延迟参数）
async function createWavFixture(): Promise<void> {
    if (!await fs.pathExists(WAV_PATH)) {
        await new Promise<void>((resolve, reject): void => {
            const proc = spawn(resolveFfmpegPath(), [
                "-hide_banner", "-f", "lavfi", "-i", "sine=frequency=440:duration=2.5",
                "-c:a", "pcm_s16le", "-ar", String(SAMPLE_RATE), "-ac", "2", "-y", WAV_PATH
            ]);
            proc.once("error", reject);
            proc.once("exit", (code): void => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
        });
    }
}

// 生成单帧JPEG作为帧输入素材
async function createFrame(): Promise<Buffer> {
    const framePath = path.join(OUTPUT_DIR, "issue39-frame.jpg");
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

// 解码输出视频音轨为单声道s16le PCM
async function extractPcm(outputPath: string): Promise<Buffer> {
    return await new Promise<Buffer>((resolve, reject): void => {
        const chunks: Buffer[] = [];
        const proc = spawn(resolveFfmpegPath(), [
            "-hide_banner", "-i", outputPath, "-vn", "-ac", "1",
            "-ar", String(SAMPLE_RATE), "-f", "s16le", "-c:a", "pcm_s16le", "-"
        ]);
        proc.stdout.on("data", (chunk: Buffer): void => void chunks.push(chunk));
        proc.once("error", reject);
        proc.once("exit", (code): void => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exited with ${code}`)));
    });
}

// 计算指定时间窗的PCM均方根振幅
function rms(buf: Buffer, startSec: number, lenSec: number): number {
    const total = buf.length / 2;
    const start = Math.floor(startSec * SAMPLE_RATE);
    const count = Math.min(Math.floor(lenSec * SAMPLE_RATE), total - start);
    expect(count).toBeGreaterThan(0);
    let sum = 0;
    for (let i = 0; i < count; i++) {
        const v = buf.readInt16LE((start + i) * 2) / 32768;
        sum += v * v;
    }
    return Math.sqrt(sum / count);
}

// 输入帧并等待合成完成
async function render(name: string, duration: number, audioOptions: { startTime?: number; endTime?: number; fadeOutDuration?: number }): Promise<Buffer> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const synth = new core.Synthesizer({
        outputPath,
        width: 320,
        height: 240,
        fps: 10,
        duration
    });
    synth.addAudio({path: WAV_PATH, ...audioOptions});
    const completed = new Promise<IRenderResult>((resolve, reject): void => {
        synth.once("completed", resolve);
        synth.once("error", reject);
    });
    synth.start();
    for (let i = 0; i < duration / 100; i++)
        await synth.input(frame);
    synth.endInput();
    await completed;
    return await extractPcm(outputPath);
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await createWavFixture();
    frame = await createFrame();
});

// 上游 Vinlic/WebVideoCreator#39：startTime>0 时淡出被提前到 min(endTime,duration)-fadeOutDuration（输出时间轴）
describe("集成：音频淡出过滤器时间轴（上游 issues/39 回归）", (): void => {
    it("淡出落在音频实际停止点而非文件时长处", async (): Promise<void> => {
        // 音频2.5秒，2000ms起播至4500ms，淡出200ms：应淡出于4300-4500ms，修复前会提前到2300-2500ms
        const pcm = await render("issue39-fade.mp4", 5000, {
            startTime: 2000,
            endTime: 4500,
            fadeOutDuration: 200
        });
        const mid = rms(pcm, 3.2, 0.6);
        // 播放中段必须有声音（修复前此处已被淡出为静音）
        expect(mid).toBeGreaterThan(0.02);
        // 音频末尾应处于淡出衰减中
        expect(rms(pcm, 4.42, 0.08)).toBeLessThan(mid * 0.6);
    }, 300000);

    it("startTime=0 场景淡出位置无回归", async (): Promise<void> => {
        // 音频2.5秒从0播至4500ms，淡出200ms：应淡出于2300-2500ms（与修复前公式一致）
        const pcm = await render("issue39-fade-zero-start.mp4", 3000, {
            startTime: 0,
            endTime: 4500,
            fadeOutDuration: 200
        });
        const mid = rms(pcm, 1.2, 0.6);
        expect(mid).toBeGreaterThan(0.02);
        expect(rms(pcm, 2.42, 0.08)).toBeLessThan(mid * 0.6);
    }, 300000);
});
