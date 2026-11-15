import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator, { TRANSITION, examples, core, entity, logger, util,
    VIDEO_ENCODER, AUDIO_ENCODER, SingleVideo, MultiVideo, ChunkVideo,
    WebVideoCreatorNext } from "../../dist/index";
import { startTestServer, stopTestServer } from "./helper";

const OUTPUT_DIR = path.resolve("tmp/test-output");

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
    await startTestServer();
});

afterAll(async (): Promise<void> => {
    await stopTestServer();
});

describe("集成：入口导出契约", (): void => {
    it("default 与 WebVideoCreatorNext 同体，具名导出齐备", (): void => {
        expect(WebVideoCreatorNext).toBe(WebVideoCreator);
        for (const value of [TRANSITION, examples, core, entity, logger, util,
            VIDEO_ENCODER, AUDIO_ENCODER, SingleVideo, MultiVideo, ChunkVideo])
            expect(value).toBeDefined();
    });
});

describe("集成：config 校验", (): void => {
    it("未 config() 时 createSingleVideo 抛错", (): void => {
        const wvc = new WebVideoCreator();
        expect((): SingleVideo => wvc.createSingleVideo({
            outputPath: path.join(OUTPUT_DIR, "x.mp4"),
            width: 320, height: 240, duration: 1000
        })).toThrowError(/has not been configured yet/);
    });
    it("destroy 未 config 时安全空转，destroy 幂等", async (): Promise<void> => {
        const wvc = new WebVideoCreator();
        await wvc.destroy();
        wvc.config({});
        await wvc.destroy();
        await wvc.destroy();
    });
});
