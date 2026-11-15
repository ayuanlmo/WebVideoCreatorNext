import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import WebVideoCreator from "../../dist/index";
import { resolveFfmpegPath } from "../../dist/lib/ffmpeg-path";

const OUTPUT_DIR = path.resolve("tmp/test-output");

// 白底页面 + 左上红块(10%) + 右下蓝块(10%)，用于像素级校验版面比例
const PAGE_HTML = `<style>
    html,body{margin:0;background:#fff}
    #red{position:absolute;left:0;top:0;width:10%;height:10%;background:red}
    #blue{position:absolute;right:0;bottom:0;width:10%;height:10%;background:blue}
</style>
<div id="red"></div>
<div id="blue"></div>`;

// 提取首帧为rawvideo像素数据
async function extractFirstFrame(outputPath: string, width: number, height: number): Promise<Buffer> {
    return await new Promise<Buffer>((resolve, reject): void => {
        const proc = spawn(resolveFfmpegPath(), [
            "-hide_banner", "-i", outputPath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"
        ]);
        const chunks: Buffer[] = [];
        proc.stdout.on("data", (data: Buffer): number => chunks.push(data));
        proc.once("error", reject);
        proc.once("exit", (code): void => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exited with ${code}`)));
    });
}

// 取指定相对位置像素（0-1坐标）
function pixelAt(frame: Buffer, width: number, relX: number, relY: number): [number, number, number] {
    const x = Math.floor(width * relX);
    const y = Math.floor((frame.length / 3 / width) * relY);
    const i = (y * width + x) * 3;
    return [frame[i], frame[i + 1], frame[i + 2]];
}

function expectColor(pixel: [number, number, number], expected: [number, number, number], label: string): void {
    for (let i = 0; i < 3; i++)
        expect(Math.abs(pixel[i] - expected[i]), `${label} channel ${i} of rgb(${pixel})`).toBeLessThan(50);
}

async function renderAndCheck(name: string, width: number, height: number, pageViewport?: object): Promise<void> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const wvc = new WebVideoCreator();
    wvc.config({});
    const video = wvc.createSingleVideo({
        content: PAGE_HTML,
        outputPath,
        width,
        height,
        fps: 5,
        duration: 500,
        frameQuality: 100,
        ...(pageViewport ? { pageViewport } : {})
    });
    await video.startAndWait();
    await wvc.destroy();
    const frame = await extractFirstFrame(outputPath, width, height);
    expect(frame.length).toBe(width * height * 3);
    // 左上红块中心（5%,5%）、右下蓝块中心（95%,95%）、中心白色（50%,50%）
    expectColor(pixelAt(frame, width, 0.05, 0.05), [255, 0, 0], "red box");
    expectColor(pixelAt(frame, width, 0.95, 0.95), [0, 0, 255], "blue box");
    expectColor(pixelAt(frame, width, 0.5, 0.5), [255, 255, 255], "white field");
}

// 上游 Vinlic/WebVideoCreator#27：4K等高分辨率渲染时画面缩放是否正确
describe("集成：高分辨率渲染校验（上游 issues/27 回归）", (): void => {
    it("4096x2160 渲染输出尺寸与版面比例正确", async (): Promise<void> => {
        await renderAndCheck("issue27-4k.mp4", 4096, 2160);
    }, 300000);

    it("deviceScaleFactor 不拉伸画面（1024x576 @2x）", async (): Promise<void> => {
        await renderAndCheck("issue27-dsf2.mp4", 1024, 576, { deviceScaleFactor: 2 });
    }, 300000);
});
