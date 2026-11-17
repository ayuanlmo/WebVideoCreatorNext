import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator from "../../dist/index";

const OUTPUT_DIR = path.resolve("tmp/test-output");

// 上游 Vinlic/WebVideoCreator#18：渲染循环内异常（帧获取超时等）被 console.error 吞掉后循环死亡，
// 录制无限挂起且 video.on("error") 无法触发
describe("集成：渲染循环异常回传 error 事件（上游 issues/18 回归）", (): void => {
    it("调度媒体 seek 抛错时 error 可捕获且录制不挂起", async (): Promise<void> => {
        await fs.ensureDir(OUTPUT_DIR);
        const outputPath = path.join(OUTPUT_DIR, "issue18-loop-error.mp4");
        const wvc = new WebVideoCreator();
        wvc.config({});
        const video = wvc.createSingleVideo({
            content: `<body><script>
                // 注入 seek 必然抛错的媒体对象，模拟渲染循环内异常（如 Acquire video frame timeout）
                captureCtx.dispatchMedias.push({
                    canDestory: function () { return false; },
                    canPlay: function () { return true; },
                    isReady: function () { return true; },
                    seek: function () { throw new Error("issue18 injected media failure"); },
                    destory: function () {}
                });
            </script></body>`,
            outputPath,
            width: 320,
            height: 240,
            fps: 10,
            duration: 1000
        });
        const errors: Error[] = [];
        video.on("error", (err): number => errors.push(err as Error));
        // 修复前该 promise 永不落定（测试超时），修复前 error 事件也从未触发
        await expect(video.startAndWait()).rejects.toThrow(/issue18 injected media failure/);
        expect(errors.length).toBeGreaterThanOrEqual(1);
        await wvc.destroy();
    }, 120000);
});
