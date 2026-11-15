import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        testTimeout: 120000,
        hookTimeout: 120000,
        // 集成测试需要真实浏览器与 FFmpeg，逐文件串行执行避免资源争抢
        fileParallelism: false
    }
});
