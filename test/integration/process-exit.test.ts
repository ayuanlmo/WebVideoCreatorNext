import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "render-exit.mjs");

describe("集成：进程自然退出", (): void => {
    it("渲染并 destroy 后无浏览器进程泄漏，Node 自然退出", async (): Promise<void> => {
        const child = spawn(process.execPath, [fixture], {
            cwd: process.cwd(),
            stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        child.stdout.on("data", (d): string => stdout += d.toString());
        const result = await new Promise<{ code: number | null; signal: string | null }>((resolve, reject): void => {
            // 子进程应在渲染+destroy后自然退出；若浏览器进程泄漏导致挂起则超时强杀并判失败
            const timer = setTimeout((): void => {
                child.kill("SIGKILL");
                reject(new Error("子进程未在30秒内自然退出（可能存在浏览器进程泄漏）"));
            }, 30000);
            child.once("exit", (code, signal): void => { clearTimeout(timer); resolve({ code, signal }); });
            child.once("error", (err): void => { clearTimeout(timer); reject(err); });
        });
        expect(stdout).toContain("[render-exit] complete");
        expect(result.signal).toBeNull();
        expect(result.code).toBe(0);
    }, 60000);
});