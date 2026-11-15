import http from "http";
import type { AddressInfo } from "net";

const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
    html,body{margin:0;padding:0;width:100%;height:100%}
    #box{position:absolute;left:0;top:0;width:100px;height:100px;background:#e74c3c;animation:move 1s linear infinite}
    @keyframes move{from{transform:translateX(0)}to{transform:translateX(200px)}}
</style>
</head>
<body><div id="box"></div></body>
</html>`;

let server: http.Server | null = null;
let baseURL = "";

// 启动本地测试页面服务，返回可导航的页面 URL
export async function startTestServer(): Promise<string> {
    if (server)
        return baseURL;
    server = http.createServer((req, res): void => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(PAGE_HTML);
    });
    await new Promise<void>((resolve): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> => server!.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseURL = `http://127.0.0.1:${port}/scene.html`;
    return baseURL;
}

export async function stopTestServer(): Promise<void> {
    if (!server) return;
    const s = server;
    server = null;
    baseURL = "";
    await new Promise<void>((resolve, reject): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> =>
        s.close((err): void => err ? reject(err) : resolve()));
}
