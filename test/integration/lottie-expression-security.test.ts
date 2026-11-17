import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import WebVideoCreator from "../../dist/index";

const OUTPUT_DIR = path.resolve("tmp/test-output");

// 恶意动画JSON：属性携带 x 表达式。lottie-web expressions 会把 x 字段送入 eval()，
// 表达式体内调用页面 Node 桥 ____throwError 把执行事实回传为 error 事件——
// 表达式若被执行 startAndWait 将以 "expr-ran" 拒绝；被禁用则渲染正常完成。
function buildMaliciousAnimationData(): Record<string, unknown> {
    return {
        v: "5.7.4", fr: 30, ip: 0, op: 30, w: 100, h: 100, nm: "expr", ddd: 0, assets: [],
        layers: [{
            ddd: 0, ind: 1, ty: 4, nm: "shape", sr: 1,
            ks: {
                o: {a: 0, k: 100, x: "globalThis.____throwError(-1,'expr-ran')"},
                r: {a: 0, k: 0},
                p: {a: 0, k: [50, 50, 0]},
                a: {a: 0, k: [0, 0, 0]},
                s: {a: 0, k: [100, 100, 100]}
            },
            ao: 0,
            shapes: [{
                ty: "gr", it: [
                    {ty: "el", p: {a: 0, k: [0, 0]}, s: {a: 0, k: [50, 50]}},
                    {ty: "fl", c: {a: 0, k: [1, 0, 0, 1]}, o: {a: 0, k: 100}},
                    {ty: "tr", p: {a: 0, k: [0, 0]}, a: {a: 0, k: [0, 0]}, s: {a: 0, k: [100, 100]}, r: {a: 0, k: 0}, o: {a: 0, k: 100}}
                ]
            }],
            ip: 0, op: 30, st: 0
        }]
    };
}

async function render(name: string, content: string, pagePrepareFn?: (page: import("../../dist/core/Page").default) => void | Promise<void>): Promise<string> {
    const outputPath = path.join(OUTPUT_DIR, name);
    const wvc = new WebVideoCreator();
    wvc.config({});
    const video = wvc.createSingleVideo({
        content,
        outputPath,
        width: 320,
        height: 240,
        fps: 10,
        duration: 1000,
        pagePrepareFn
    });
    // 表达式若被执行会经 ____throwError 触发 error 事件使本 promise 拒绝（/expr-ran/）
    await video.startAndWait();
    await wvc.destroy();
    return outputPath;
}

beforeAll(async (): Promise<void> => {
    await fs.ensureDir(OUTPUT_DIR);
});

// 上游安全公告：lottie-web expressions 将动画 JSON 的 x 字段送入 eval()，
// 外部动画数据可经渲染页 Node 桥触达宿主进程。两个调用面必须默认关闭表达式。
describe("集成：lottie 表达式求值封堵（外部动画 JSON 不得经 eval 执行代码）", (): void => {
    it("<lottie src> 路径（LottieCanvas/canvas渲染器）表达式不执行", async (): Promise<void> => {
        const data = Buffer.from(JSON.stringify(buildMaliciousAnimationData())).toString("base64");
        const outputPath = await render("lottie-expr-canvas.mp4",
            `<lottie src="data:application/json;base64,${data}" style="width:100px;height:100px"></lottie>`);
        expect(await fs.pathExists(outputPath)).toBe(true);
    }, 120000);

    // 直接 loadAnimation 不传 rendererSettings：默认走 svg 渲染器（封堵另一处 renderConfig 默认值）；
    // container/autoplay/loop 必须显式给全，否则动画不渲染帧、表达式不求值，测试会空转
    it("直接 loadAnimation 不传 rendererSettings 时默认不执行表达式", async (): Promise<void> => {
        let svgBuilt = false;
        const outputPath = await render("lottie-expr-default.mp4",
            `<h1>lottie expression test</h1>`,
            async (page): Promise<void> => {
                svgBuilt = await page.target.evaluate((animationData): boolean => {
                    const g = globalThis as unknown as {
                        document: { body: unknown };
                        ____lottie: { loadAnimation(options: Record<string, unknown>): { renderer?: { svgElement?: unknown } } }
                    };
                    const anim = g.____lottie.loadAnimation({animationData, container: g.document.body, autoplay: true, loop: true});
                    // svg 渲染器构造成功即已创建 svgElement（此前 loadAnimation 在此直接抛 TypeError）
                    return !!(anim && anim.renderer && anim.renderer.svgElement);
                }, buildMaliciousAnimationData());
            });
        // svg 渲染器必须真实可用，否则表达式封堵断言可能空转假绿
        expect(svgBuilt).toBe(true);
        expect(await fs.pathExists(outputPath)).toBe(true);
    }, 120000);
});
