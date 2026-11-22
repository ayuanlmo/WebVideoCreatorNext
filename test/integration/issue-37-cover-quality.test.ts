import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator from "../../dist/index";

// 上游 issues/37：封面捕获不支持指定 JPG 质量，新增 coverCaptureQuality 选项（0-100）
// 高频细节画面保证不同 JPEG 量化质量下封面体积差异显著

const OUTPUT_DIR = path.resolve("tmp/test-output");

const CONTENT = `<!DOCTYPE html><html><body style="margin:0"><canvas id="c" width="320" height="240"></canvas>
<script>
const ctx = document.getElementById("c").getContext("2d");
for (let y = 0; y < 240; y += 4) {
    for (let x = 0; x < 320; x += 4) {
        ctx.fillStyle = "rgb(" + ((x * 7) % 255) + "," + ((y * 13) % 255) + "," + ((x + y) % 255) + ")";
        ctx.fillRect(x, y, 4, 4);
    }
}
</script></body></html>`;

async function renderCover(quality: number, name: string): Promise<number> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const wvc = new WebVideoCreator();
    wvc.config({});
    try {
        const video = wvc.createSingleVideo({
            content: CONTENT,
            outputPath,
            width: 320,
            height: 240,
            fps: 10,
            duration: 400,
            coverCapture: true,
            coverCaptureFormat: "jpg",
            coverCaptureQuality: quality
        });
        await video.startAndWait();
    } finally {
        await wvc.destroy();
    }
    const coverPath = `${outputPath}.jpg`;
    expect(await fs.pathExists(coverPath)).toBe(true);
    return (await fs.stat(coverPath)).size;
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
});

describe("集成：issue-37 封面捕获 JPG 质量", (): void => {
    it("coverCaptureQuality 越高质量越好（封面体积显著增大）", async (): Promise<void> => {
        const sizeLow = await renderCover(5, "issue-37-low.mp4");
        const sizeHigh = await renderCover(100, "issue-37-high.mp4");
        expect(sizeHigh).toBeGreaterThan(sizeLow * 2);
    }, 300000);
});
