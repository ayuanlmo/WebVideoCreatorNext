import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import WebVideoCreator, { util } from "../../dist/index";
import { resolveFfmpegPath } from "../../dist/lib/ffmpeg-path";

const OUTPUT_DIR = path.resolve("tmp/test-output");
const WAV_PATH = path.join(OUTPUT_DIR, "issue29-sine.wav");
let wavBase64 = "";

// 生成1秒正弦波WAV作为测试音频
async function createWavFixture(): Promise<void> {
    if (!await fs.pathExists(WAV_PATH)) {
        await new Promise<void>((resolve, reject): void => {
            const proc = spawn(resolveFfmpegPath(), [
                "-hide_banner", "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                "-c:a", "pcm_s16le", "-ar", "8000", "-ac", "1", "-y", WAV_PATH
            ]);
            proc.once("error", reject);
            proc.once("exit", (code): void => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
        });
    }
    wavBase64 = (await fs.readFile(WAV_PATH)).toString("base64");
}

async function render(name: string, content: string): Promise<string> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const wvc = new WebVideoCreator();
    wvc.config({});
    const video = wvc.createSingleVideo({
        content,
        outputPath,
        width: 320,
        height: 240,
        fps: 10,
        duration: 1000
    });
    await video.startAndWait();
    await wvc.destroy();
    return outputPath;
}

async function expectAudioTrack(outputPath: string): Promise<void> {
    expect(await fs.pathExists(outputPath)).toBe(true);
    const { streams } = await util.getMediaMetadata(outputPath);
    expect(streams.some((stream): boolean => stream.codec_type === "audio")).toBe(true);
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await createWavFixture();
});

// 上游 Vinlic/WebVideoCreator#29：blob:/data:（base64）来源的<audio>不被录制
describe("集成：Blob/Base64 音频录制（上游 issues/29 回归）", (): void => {
    it("data:（base64）src 的 audio 合入音轨", async (): Promise<void> => {
        const outputPath = await render("issue29-data-uri.mp4",
            `<audio src="data:audio/wav;base64,${wavBase64}" loop></audio>`);
        await expectAudioTrack(outputPath);
    }, 300000);

    it("blob: src 的 audio 合入音轨", async (): Promise<void> => {
        const outputPath = await render("issue29-blob.mp4",
            `<script>
                window.addEventListener("DOMContentLoaded", function() {
                    var bytes = Uint8Array.from(atob("${wavBase64}"), function(c) { return c.charCodeAt(0); });
                    var audio = document.createElement("audio");
                    audio.src = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
                    audio.loop = true;
                    document.body.appendChild(audio);
                });
            </script>`);
        await expectAudioTrack(outputPath);
    }, 300000);

    it("<source> 子元素与 captureCtx.addAudio 的 data: 来源合入音轨", async (): Promise<void> => {
        const outputPath = await render("issue29-source-api.mp4",
            `<audio loop><source src="data:audio/wav;base64,${wavBase64}" type="audio/wav"></audio>
             <script>captureCtx.addAudio({ url: "data:audio/wav;base64,${wavBase64}", loop: true });</script>`);
        await expectAudioTrack(outputPath);
    }, 300000);
});
