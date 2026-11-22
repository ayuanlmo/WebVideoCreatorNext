import { describe, it, expect } from "vitest";
import { core, SingleVideo } from "../../dist/index";

// 上游 issues/38：浏览器启动失败时错误仅被记入日志，acquirePage/createSingleVideo 永久挂起，try/catch 无法捕获
// 用不存在的可执行文件确定性触发启动失败；竞速超时把"挂起"显式化为断言失败

const BOGUS_EXECUTABLE = "/nonexistent-chrome-for-issue-38";

// 竞速获取结果：返回 Error 对象或 "resolved"/"timeout" 标记
async function raceOutcome(promise: Promise<unknown>, timeoutMs: number): Promise<unknown> {
    return await Promise.race([
        promise.then((): string => "resolved", (err: Error): Error => err),
        new Promise<string>((resolve): NodeJS.Timeout => setTimeout((): void => resolve("timeout"), timeoutMs))
    ]);
}

describe("集成：issue-38 浏览器启动失败可捕获", (): void => {
    it("启动失败时 acquirePage 快速 reject 而不是永久挂起", async (): Promise<void> => {
        const pool = new core.ResourcePool({
            numBrowserMin: 2,
            numBrowserMax: 2,
            browserOptions: { executablePath: BOGUS_EXECUTABLE }
        });
        try {
            const outcome = await raceOutcome(pool.acquirePage(), 20000);
            expect(outcome).toBeInstanceOf(Error);
            expect((outcome as Error).message).toMatch(/launch|not found|ENOENT|executablePath/i);
        } finally {
            await pool.close().catch((): void => {
            });
        }
    }, 60000);

    it("startAndWait 捕获启动失败错误而不是永久挂起", async (): Promise<void> => {
        const pool = new core.ResourcePool({
            numBrowserMin: 1,
            numBrowserMax: 1,
            browserOptions: { executablePath: BOGUS_EXECUTABLE }
        });
        const video = new SingleVideo({
            content: "<html><body>issue-38</body></html>",
            outputPath: "tmp/test-output/issue-38.mp4",
            width: 320,
            height: 240,
            fps: 15,
            duration: 1000
        });
        video.onPageAcquire(async (): Promise<core.Page> => await pool.acquirePage());
        const outcome = await raceOutcome(video.startAndWait(), 20000);
        expect(outcome).toBeInstanceOf(Error);
        expect((outcome as Error).message).toMatch(/launch|not found|ENOENT|executablePath/i);
        await pool.close().catch((): void => {
        });
    }, 60000);
});
