import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator, { TRANSITION, type MultiVideo } from "../../dist/index";
import { startTestServer, stopTestServer } from "./helper";

const OUTPUT_DIR = path.resolve("tmp/test-output");

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await startTestServer();
});

afterAll(async (): Promise<void> => {
    await stopTestServer();
});

describe("集成：多幕视频合成", (): void => {
    it("两个分块带 fade 转场合成 mp4", async (): Promise<void> => {
        const url = await startTestServer();
        const outputPath = path.join(OUTPUT_DIR, "multi-fade.mp4");
        const wvc = new WebVideoCreator();
        wvc.config({});
        const video = wvc.createMultiVideo({
            outputPath,
            width: 320,
            height: 240,
            fps: 15,
            chunks: [
                { url, duration: 800, transition: TRANSITION.FADE },
                { url, duration: 800 }
            ]
        });
        await video.startAndWait();
        expect(await fs.pathExists(outputPath)).toBe(true);
        expect((await fs.stat(outputPath)).size).toBeGreaterThan(1000);
        await wvc.destroy();
    }, 300000);

    it("非法转场 id 构造即抛错", (): void => {
        const url = "http://127.0.0.1:1/scene.html";
        const wvc = new WebVideoCreator();
        wvc.config({});
        expect((): MultiVideo => wvc.createMultiVideo({
            outputPath: path.join(OUTPUT_DIR, "multi-bad.mp4"),
            width: 320,
            height: 240,
            fps: 15,
            chunks: [
                { url, duration: 500, transition: "not-a-transition" },
                { url, duration: 500 }
            ]
        })).toThrowError(/may not be supported/);
    });

    it("无分块时启动抛错", async (): Promise<void> => {
        const wvc = new WebVideoCreator();
        wvc.config({});
        const video = wvc.createMultiVideo({
            outputPath: path.join(OUTPUT_DIR, "multi-empty.mp4"),
            width: 320,
            height: 240,
            fps: 15
        });
        await expect(video.startAndWait())
            .rejects.toThrowError(/no VideoChunk that can be synthesized/);
        await wvc.destroy();
    });
});
