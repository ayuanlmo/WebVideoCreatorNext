import assert from "assert";
import _ from "lodash";
import AsyncLock from "async-lock";
import type {SetContentWaitForOptions, Viewport, WaitForOptions} from "puppeteer-core";

import Synthesizer, {type ISynthesizerOptions} from "../core/Synthesizer";
import Page from "../core/Page";
import type Audio from "../entity/Audio";
import Font, {type IFontOptions} from "../entity/Font";
import logger from "../lib/logger";
import util from "../lib/util";
import type {ICaptureContext} from "../lib/capture-ctx-api";

// 浏览器页面注入的全局捕获上下文（由 dist/browser/injected.js 挂载），
// evaluate 回调序列化后在页面上下文中执行，此处仅作类型声明引用
declare const captureCtx: ICaptureContext;

// 单幕视频选项
export interface ISingleVideoOptions extends ISynthesizerOptions {
    url?: string; // 页面URL
    content?: string; // 页面内容
    startTime?: number; // 开始捕获时间点（毫秒）
    autostartRender?: boolean; // 是否自动启动渲染
    consoleLog?: boolean; // 是否输出页面控制台日志
    videoPreprocessLog?: boolean; // 是否输出视频预处理日志
    pageViewport?: Partial<Viewport>; // 页面视窗参数
    pagePrepareFn?: (page: Page) => void | Promise<void>; // 页面预处理函数
    pageWaitForOptions?: WaitForOptions | SetContentWaitForOptions; // 页面等待选项
    videoDecoderHardwareAcceleration?: string; // VideoDecoder硬件加速指示
    timeActions?: { [key: number]: (page: Page) => void | Promise<void> }; // 动作序列
    waitTimeout?: number; // startAndWait超时时间（毫秒），0为不超时
}

// 单幕视频
export default class SingleVideo extends Synthesizer {

    public url: string; // 页面URL
    public content: string; // 页面内容
    public startTime: number; // 开始捕获时间点
    public fonts: Font[] = []; // 注册的字体列表
    public autostartRender: boolean; // 是否自动启动渲染
    public consoleLog: boolean; // 是否输出页面控制台日志
    public videoPreprocessLog: boolean; // 是否输出视频预处理日志
    public pageViewport: Partial<Viewport>; // 页面视窗参数
    public pagePrepareFn: (page: Page) => void | Promise<void>; // 页面预处理函数
    public pageWaitForOptions: WaitForOptions | SetContentWaitForOptions; // 页面等待选项
    public videoDecoderHardwareAcceleration: string; // VideoDecoder硬件加速指示
    public timeActions: { [key: number]: (page: Page) => void | Promise<void> }; // 动作序列
    public waitTimeout: number; // startAndWait超时时间（毫秒），0为不超时
    private abortCallback: () => void = null; // 终止回调函数
    private pageAcquireFn: () => Promise<Page> = null; // 页面获取函数
    // 异步锁
    private asyncLock: AsyncLock = new AsyncLock();

    // 构造函数
    constructor(options: ISingleVideoOptions = {}) {
        super(options);
        const {
            url,
            content,
            startTime,
            autostartRender,
            consoleLog,
            videoPreprocessLog,
            pageWaitForOptions,
            pageViewport,
            pagePrepareFn,
            videoDecoderHardwareAcceleration,
            timeActions,
            waitTimeout
        } = options;
        assert(_.isUndefined(url) || util.isURL(url), `url ${url} is not valid URL`);
        assert(_.isUndefined(content) || _.isString(content), "page content must be string");
        assert(!_.isUndefined(url) || !_.isUndefined(content), "page url or content must be provide");
        assert(_.isUndefined(startTime) || _.isFinite(startTime), "startTime must be number");
        assert(_.isUndefined(autostartRender) || _.isBoolean(autostartRender), "autostartRender must be boolean");
        assert(_.isUndefined(consoleLog) || _.isBoolean(consoleLog), "consoleLog must be boolean");
        assert(_.isUndefined(pageWaitForOptions) || _.isObject(pageWaitForOptions), "pageWaitForOptions must be Object");
        assert(_.isUndefined(pageViewport) || _.isObject(pageViewport), "pageViewport must be Object");
        assert(_.isUndefined(pagePrepareFn) || _.isFunction(pagePrepareFn), "pagePrepareFn must be Function");
        assert(_.isUndefined(videoDecoderHardwareAcceleration) || _.isString(videoDecoderHardwareAcceleration), "videoDecoderHardwareAcceleration must be string");
        assert(_.isUndefined(timeActions) || _.isObject(timeActions), "timeActions must be Object");
        assert(_.isUndefined(waitTimeout) || _.isFinite(waitTimeout), "waitTimeout must be number");
        timeActions && Object.keys(timeActions).forEach((key: string): void => {
            const time = Number(key);
            assert(_.isFinite(time), `timeActions key ${time} must be Number`);
            assert(_.isFunction(timeActions[time]), `timeActions[${time}] must be Function`);
        })
        this.url = url;
        this.content = content;
        this.startTime = startTime;
        this.autostartRender = _.defaultTo(autostartRender, true);
        this.consoleLog = _.defaultTo(consoleLog, false);
        this.videoPreprocessLog = _.defaultTo(videoPreprocessLog, false);
        this.pageViewport = pageViewport;
        this.pageWaitForOptions = pageWaitForOptions;
        this.pagePrepareFn = pagePrepareFn;
        this.videoDecoderHardwareAcceleration = videoDecoderHardwareAcceleration;
        this.timeActions = timeActions;
        this.waitTimeout = _.defaultTo(waitTimeout, 0);
    }

    // 启动合成
    public start(): void {
        this.abortCallback = null;
        this.asyncLock.acquire("start", (): Promise<void> => this.synthesize())
            .catch((err): void => logger.error(err));
    }

    // 启动并等待完成
    public async startAndWait(): Promise<void> {
        await this.asyncLock.acquire("start", async (): Promise<void> => {
            let onError: (err: Error) => void;
            let onCrashed: (err: Error) => void;
            let timer: NodeJS.Timeout;
            const failurePromise = new Promise<never>((_, reject): void => {
                onError = (err): void => reject(err instanceof Error ? err : new Error(String(err)));
                onCrashed = (err): void => reject(new Error(`Page crashed during capture: ${err?.message || err}`));
                this.once("error", onError);
                this.once("pageCrashed", onCrashed);
                if (this.waitTimeout > 0) {
                    timer = setTimeout((): void => {
                        this.abort();
                        reject(new Error(`startAndWait timed out after ${this.waitTimeout}ms`));
                    }, this.waitTimeout);
                }
            });
            const synthesizePromise = this.synthesize();
            // 错误已经由error事件路由，竞态结束后抑制迟到的拒绝避免unhandledRejection
            synthesizePromise.catch((): void => {
            });
            try {
                await Promise.race([synthesizePromise, failurePromise]);
            } finally {
                clearTimeout(timer);
                this.off("error", onError);
                this.off("pageCrashed", onCrashed);
            }
        });
    }

    // 终止捕获
    public abort(): boolean {
        if (!this.abortCallback)
            return false;
        this.abortCallback();
        return true;
    }

    // 注册字体
    public registerFont(font: IFontOptions | Font): void {
        const instance = font instanceof Font ? font : new Font(font);
        // 开始加载字体
        instance.load().catch((err: Error): void => this._emitError(err));
        this.fonts.push(instance);
    }

    // 注册多个字体
    public registerFonts(fonts: Array<IFontOptions | Font> = []): void {
        fonts.forEach((font): void => this.registerFont(font));
    }

    // 合成处理
    private async synthesize(): Promise<void> {
        const page = await this.acquirePage();
        try {
            const {url, content, width, height, pageWaitForOptions, pageViewport = {}} = this;
            // 监听页面实例发生的某些内部错误
            page.on("error", (err): void => this._emitError("Page error:\n" + err.stack));
            // 监听页面是否崩溃，当内存不足或过载时可能会崩溃
            page.on("crashed", (err): void => this.emitPageCrashedError(err));
            if (this.consoleLog) {
                // 监听页面打印到console的正常日志
                page.on("consoleLog", (message): void => logger.log("[page]", message));
                // 监听页面打印到console的错误日志
                page.on("consoleError", (err): void => logger.error("[page]", err));
            }
            if (this.videoPreprocessLog)
                page.on("videoPreprocess", (config): void => logger.log("[video_preprocess]", config.url));
            page.on("audioAdd", (options): Audio => this.addAudio(options));
            page.on("audioUpdate", (audioId, options): Audio => this.updateAudio(audioId, options))
            // 设置视窗宽高
            await page.setViewport({
                ...pageViewport,
                width,
                height
            });
            // 跳转到您希望渲染的页面，您可以考虑创建一个本地的Web服务器提供页面以提升加载速度和安全性
            if (url)
                await page.goto(url, pageWaitForOptions);
            // 或者设置页面内容
            else
                await page.setContent(content, pageWaitForOptions);
            // 存在透明通道时设置背景透明度
            this.hasAlphaChannel && page.setBackgroundOpacity(this.backgroundOpacity);
            // 存在预处理函数时先执行预处理
            this.pagePrepareFn && await this.pagePrepareFn(page);
            // 注册字体
            if (this.fonts.length > 0)
                page.registerFonts(this.fonts);
            // 等待字体加载完成
            await page.waitForFontsLoaded();
            // 注册事件序列
            if (this.timeActions && Object.keys(this.timeActions).length > 0)
                page.registerTimeActions(this.timeActions);
            // 注册终止回调
            this.abortCallback = (): Promise<void> => page.target.evaluate((): void => captureCtx.abort()).catch((err): void => console.error(err));
            // 启动合成
            super.start();
            // 合成完成promise
            const completedPromise = new Promise((resolve): this => this.once("completed", resolve));
            // 监听已渲染的帧输入到合成器
            page.on("frame", (buffer): void | Promise<void> => this.input(buffer));
            // 必须先挂录制完成监听再启动捕获：捕获可能于首帧同步收尾（如abort提前置位stopFlag），
            // 晚挂会丢失screencastCompleted事件导致永久等待
            const screencastCompleted = new Promise<void>((resolve): void => void page.once("screencastCompleted", resolve));
            // 启动捕获
            await page.startScreencast({
                fps: this.fps,
                startTime: this.startTime,
                duration: this.duration,
                videoDecoderHardwareAcceleration: this.videoDecoderHardwareAcceleration,
                autostart: this.autostartRender
            });
            // 等待录制完成
            await screencastCompleted;
            // 停止录制
            await page.stopScreencast();
            // 释放页面资源
            await page.release();
            // 告知合成器结束输入
            this.endInput();
            // 等待合成完成
            await completedPromise;
        } catch (err) {
            await page.release();
            this._emitError(err as Error);
        }
    }

    // 注册页面获取函数
    public onPageAcquire(fn: () => Promise<Page>): void {
        assert(_.isFunction(fn), "Page acquire function must be Function");
        this.pageAcquireFn = fn;
    }

    // 获取渲染页面
    private async acquirePage(): Promise<Page> {
        assert(_.isFunction(this.pageAcquireFn), "Page acquire function must be Function");
        return await this.pageAcquireFn();
    }

    // 发送页面崩溃错误
    private emitPageCrashedError(err: Error): void {
        if (this.eventNames().includes("pageCrashed"))
            this.emit("pageCrashed", err);
        else
            logger.error("Page crashed:\n" + err.stack);
    }

}
