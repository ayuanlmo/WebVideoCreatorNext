import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator from "../../dist/index";
import type { IRenderResult } from "../../dist/core/Synthesizer";

const OUTPUT_DIR = path.resolve("tmp/test-output");

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
});

// 页面内 captureCtx.abort() 是受支持的提前终止入口（用户实际用法回归）；
// 页面 setTimeout 走捕获虚拟时钟，3000 即视频时间 3s
describe("集成：页面侧 captureCtx.abort() 提前终止录制", (): void => {
    it("页面 setTimeout 于视频时间 3s abort，输出约 3s 视频且正常收尾", async (): Promise<void> => {
        const outputPath = path.join(OUTPUT_DIR, "page-abort.mp4");
        const wvc = new WebVideoCreator();
        wvc.config({});
        const video = wvc.createSingleVideo({
            content: `<h1>abort test</h1><script>window.setTimeout(function () { window.captureCtx.abort(); }, 3000)</script>`,
            outputPath,
            width: 320,
            height: 240,
            fps: 10,
            duration: 5000
        });
        const completed = new Promise<IRenderResult>((resolve, reject): void => {
            video.once("completed", resolve);
            video.once("error", reject);
        });
        await video.startAndWait();
        const result = await completed;
        await wvc.destroy();
        // abort 落在视频时间 3s，输出应显著短于 5s 且接近 3s
        expect(result.duration).toBeGreaterThanOrEqual(2500);
        expect(result.duration).toBeLessThan(4500);
        expect(await fs.pathExists(outputPath)).toBe(true);
    }, 120000);
});
