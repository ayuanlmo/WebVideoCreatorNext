import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator from "../../dist/index";
import type { IRenderResult } from "../../dist/core/Synthesizer";
import { startTestServer, stopTestServer } from "./helper";

const OUTPUT_DIR = path.resolve("tmp/test-output");

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await startTestServer();
});

afterAll(async (): Promise<void> => {
    await stopTestServer();
});

async function render(options: { format: "mp4" | "webm" }, name: string): Promise<string> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const wvc = new WebVideoCreator();
    wvc.config({});
    const video = wvc.createSingleVideo({
        url: await startTestServer(),
        outputPath,
        width: 320,
        height: 240,
        fps: 15,
        duration: 1000,
        format: options.format
    });
    await video.startAndWait();
    await wvc.destroy();
    return outputPath;
}

describe("集成：单幕视频渲染", (): void => {
    it("渲染 1 秒 mp4（libx264）", async (): Promise<void> => {
        const file = await render({ format: "mp4" }, "single.mp4");
        expect(await fs.pathExists(file)).toBe(true);
        const { size } = await fs.stat(file);
        expect(size).toBeGreaterThan(1000);
    }, 300000);

    it("渲染 1 秒 webm（libvpx）", async (): Promise<void> => {
        const file = await render({ format: "webm" }, "single.webm");
        expect(await fs.pathExists(file)).toBe(true);
        expect((await fs.stat(file)).size).toBeGreaterThan(1000);
    }, 300000);

    it("completed 事件返回时长与耗时统计", async (): Promise<void> => {
        const outputPath = path.join(OUTPUT_DIR, "single-events.mp4");
        const wvc = new WebVideoCreator();
        wvc.config({});
        const video = wvc.createSingleVideo({
            url: await startTestServer(),
            outputPath,
            width: 320,
            height: 240,
            fps: 15,
            duration: 1000
        });
        const completed = new Promise<IRenderResult>((resolve): void => void video.once("completed", resolve));
        video.start();
        const result = await completed;
        expect(result.duration).toBeGreaterThanOrEqual(900);
        expect(result.takes).toBeGreaterThan(0);
        await wvc.destroy();
    }, 300000);
});
