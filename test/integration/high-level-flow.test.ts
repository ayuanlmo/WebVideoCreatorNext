import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator, { WebVideoCreatorNext, TRANSITION, util } from "../../dist/index";
import { startTestServer, stopTestServer } from "./helper";

const OUTPUT_DIR = path.resolve("tmp/test-output");

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await startTestServer();
});

afterAll(async (): Promise<void> => {
    await stopTestServer();
});

describe("集成：高级别分块合并流程", (): void => {
    it("分块预渲染后 setTransition 合并为多幕视频", async (): Promise<void> => {
        const url = await startTestServer();
        const wvc = new WebVideoCreatorNext();
        wvc.config({});
        const chunk1 = wvc.createChunkVideo({
            url,
            width: 320,
            height: 240,
            fps: 15,
            duration: 500
        });
        const chunk2 = wvc.createChunkVideo({
            url,
            width: 320,
            height: 240,
            fps: 15,
            duration: 500
        });
        await Promise.all([chunk1.startAndWait(), chunk2.startAndWait()]);
        chunk1.setTransition({ id: TRANSITION.FADE, duration: 200 });
        const outputPath = path.join(OUTPUT_DIR, "high-level-merge.mp4");
        const video = wvc.createMultiVideo({
            outputPath,
            width: 320,
            height: 240,
            fps: 15,
            chunks: [chunk1, chunk2]
        });
        await video.startAndWait();
        expect(await fs.pathExists(outputPath)).toBe(true);
        // 两段各500ms减去200ms转场重叠
        const duration = await util.getMediaDuration(outputPath);
        expect(duration).toBeGreaterThanOrEqual(650);
        expect(duration).toBeLessThanOrEqual(1000);
        await wvc.destroy();
    }, 300000);
});

describe("集成：destroy 复位配置", (): void => {
    it("destroy 后可重新 config 开启新任务", async (): Promise<void> => {
        const wvc = new WebVideoCreator();
        wvc.config({});
        await wvc.destroy();
        expect((): unknown => wvc.createSingleVideo({
            outputPath: path.join(OUTPUT_DIR, "high-level-x.mp4"),
            width: 320,
            height: 240,
            duration: 1000
        })).toThrowError(/has not been configured yet/);
        wvc.config({});
        const outputPath = path.join(OUTPUT_DIR, "high-level-reconfig.mp4");
        const video = wvc.createSingleVideo({
            url: await startTestServer(),
            outputPath,
            width: 320,
            height: 240,
            fps: 15,
            duration: 1000
        });
        await video.startAndWait();
        expect(await fs.pathExists(outputPath)).toBe(true);
        await wvc.destroy();
    }, 300000);
});
