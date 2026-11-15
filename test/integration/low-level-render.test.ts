import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import { core, SingleVideo, util } from "../../dist/index";
import { startTestServer, stopTestServer } from "./helper";

const OUTPUT_DIR = path.resolve("tmp/test-output");

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await startTestServer();
});

afterAll(async (): Promise<void> => {
    await stopTestServer();
});

describe("集成：低级别资源池与页面 API", (): void => {
    it("ResourcePool/Browser/Page 生命周期", async (): Promise<void> => {
        const pool = new core.ResourcePool({ numBrowserMin: 1, numBrowserMax: 1 });
        await pool.warmup();
        const page = await pool.acquirePage();
        expect(page.isReady()).toBe(true);
        await page.setViewport({ width: 320, height: 240 });
        await page.goto(await startTestServer());
        await page.release();
        await pool.close();
    }, 300000);

    it("SingleVideo 直连 ResourcePool 渲染（低级别用法）", async (): Promise<void> => {
        const pool = new core.ResourcePool({ numBrowserMin: 1, numBrowserMax: 1 });
        const outputPath = path.join(OUTPUT_DIR, "low-level-single.mp4");
        const video = new SingleVideo({
            url: await startTestServer(),
            outputPath,
            width: 320,
            height: 240,
            fps: 15,
            duration: 1000
        });
        video.onPageAcquire(async (): Promise<core.Page> => await pool.acquirePage());
        await video.startAndWait();
        expect(await fs.pathExists(outputPath)).toBe(true);
        const duration = await util.getMediaDuration(outputPath);
        expect(duration).toBeGreaterThanOrEqual(850);
        expect(duration).toBeLessThanOrEqual(1200);
        await pool.close();
    }, 300000);
});
