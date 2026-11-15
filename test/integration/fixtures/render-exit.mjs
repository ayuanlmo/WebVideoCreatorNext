import fs from "fs-extra";
import path from "path";
import http from "http";

const PAGE_HTML = `<!DOCTYPE html><html><head><style>
html,body{margin:0;padding:0;width:100%;height:100%}
#box{position:absolute;left:0;top:0;width:100px;height:100px;background:#e74c3c;animation:move 1s linear infinite}
@keyframes move{from{transform:translateX(0)}to{transform:translateX(200px)}}
</style></head><body><div id="box"></div></body></html>`;

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE_HTML);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/scene.html`;

const { default: WebVideoCreator } = await import("../../../dist/index.js");
const outputPath = path.resolve("tmp/test-output/render-exit.mp4");
await fs.ensureDir(path.dirname(outputPath));

const wvc = new WebVideoCreator();
wvc.config({});
const video = wvc.createSingleVideo({
    url, outputPath, width: 320, height: 240, fps: 15, duration: 500, format: "mp4"
});
try {
    await video.startAndWait();
    await wvc.destroy();
    await new Promise(r => server.close(r));
    console.log("[render-exit] complete");
    // 故意不调用 process.exit：浏览器进程与句柄全部释放后 Node 应自然退出，
    // 若存在进程泄漏（如浏览器未被关闭）事件循环将无法排空，进程会挂起。
}
catch (err) {
    console.error("[render-exit] failed:", err);
    process.exit(1);
}