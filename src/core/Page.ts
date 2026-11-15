import assert from "assert";
import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import AsyncLock from "async-lock";
import {EventEmitter} from "eventemitter3";
import _ from "lodash";
import type {
    CDPSession,
    ConsoleMessage,
    HTTPRequest,
    HTTPResponse,
    Page as PuppeteerPage,
    Protocol,
    SetContentWaitForOptions,
    Viewport,
    WaitForOptions
} from "puppeteer-core";

import Browser from "./Browser";
import type VideoPreprocessor from "../preprocessor/video/VideoPreprocessor";
import VideoConfig, {type IVideoConfigOptions} from "../preprocessor/video/VideoConfig";
import Audio from "../entity/Audio";
import Font from "../entity/Font";
import globalConfig from "../lib/global-config";
import logger from "../lib/logger";
import util from "../lib/util";
import type {
    IAudioAddPayload,
    ICaptureContext,
    ICaptureContextConfig,
    IPreprocessChunkManifest
} from "../lib/capture-ctx-api";

// 以下标识符仅存在于浏览器页面上下文（injected.js 与 vendor 脚本挂载），此处仅作类型声明
declare const captureCtx: ICaptureContext;

// 页面资源请求/响应信息
interface IResourceInfo {
    status: number;
    statusText: string;
    method: string;
    url: string;
}

// 调度中的CSS动画条目（startTime 由 seek 时回填）
interface ICssAnimation {
    id: string;
    startTime: number | null;
    paused: boolean;
    backendNodeId: number;
    delay: number;
    duration: number;
    iterations?: number;
}

// CDP Animation.animationStarted 事件负载
interface ICssAnimationEvent {
    animation: {
        id: string;
        source?: { backendNodeId?: number; delay?: number; duration?: number; iterations?: number };
    };
}

// HeadlessExperimental.beginFrame 返回（实验域未建模于协议类型，screenshotData 为 base64 帧图）
interface IBeginFrameResult {
    screenshotData?: string;
}

// 默认用户UA
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0";
// 公共样式内容
const COMMON_STYLE_CONTENT = fs.readFileSync(util.rootPathJoin("assets/common.css"), "utf-8");
// MP4Box库脚本内容
const MP4BOX_LIBRARY_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("assets/vendor/mp4box.js"), "utf-8");
// Webfont库脚本内容
const FONTFACE_OBSERVER_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("assets/vendor/fontfaceobserver.js"), "utf-8");
// Lottie动画库脚本内容
const LOTTIE_LIBRARY_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("assets/vendor/lottie.js"), "utf-8");
// 浏览器侧捕获上下文 bundle（由 src/browser 经 esbuild 打包生成，页面全局 captureCtx/____* 由其挂载）
const INJECTED_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("browser/injected.js"), "utf-8");
// 页面计数
let pageIndex = 1;

// 页面选项
export interface IPageOptions {
    width?: number; // 页面视窗宽度
    height?: number; // 页面视窗高度
    userAgent?: string; // 用户UA
    beginFrameTimeout?: number; // BeginFrame超时时间（毫秒）
    frameFormat?: string; // 帧图格式（jpeg/png）
    frameQuality?: number; // 帧图质量（0-100）
    _firstPage?: boolean; // 是否初始页面（内部使用）
    // 其余透传给视窗设置的选项
    [key: string]: unknown;
}

// 页面
export default class Page extends EventEmitter {

    // 页面状态枚举
    public static STATE = {
        UNINITIALIZED: Symbol("UNINITIALIZED"), // 未初始化
        READY: Symbol("READY"), // 已就绪
        CAPTURING: Symbol("CAPTURING"), // 录制中
        PAUSED: Symbol("PAUSED"), // 已暂停
        STOPPED: Symbol("STOPPED"), // 已停止
        UNAVAILABLED: Symbol("UNAVAILABLED"), // 不可用
        CLOSED: Symbol("CLOSED") // 已关闭
    };

    public id: string = `Page@${pageIndex++}`;
    public state: symbol = Page.STATE.UNINITIALIZED; // 页面状态
    public parent: Browser; // 父浏览器
    public target: PuppeteerPage; // 页面实例
    public width: number; // 页面视窗宽度
    public height: number; // 页面视窗高度
    public userAgent: string; // 用户UA
    public beginFrameTimeout: number; // BeginFrame超时时间（毫秒）
    public frameFormat: string; // 帧图格式（jpeg/png）
    public frameQuality: number; // 帧图质量（0-100）
    // 背景不透明度（0-1）
    public backgroundOpacity: number = 1;
    public fonts: Font[] = []; // 已注册字体集
    public acceptResources: IResourceInfo[] = []; // 已接受资源列表
    public rejectResources: IResourceInfo[] = []; // 已拒绝资源列表
    public cssAnimations: ICssAnimation[] = []; // CSS动画列表
    public timeActions: { [key: number]: (page: Page) => void | Promise<void> } = {}; // 时间轴动作列表
    // 资源排重Set
    private resourceSet: Set<string> = new Set<string>();
    private preprocessBuffers: Map<string, Buffer> = new Map(); // 预处理分片传输的数据块缓存
    private cdpSession: CDPSession = null; // CDP会话
    // 是否初始页面
    private readonly firstPage: boolean = false;
    // 异步锁
    private asyncLock: AsyncLock = new AsyncLock();

    // 构造函数
    constructor(parent: Browser, options: IPageOptions) {
        super();
        assert(parent instanceof Browser, "Page parent must be Browser");
        this.parent = parent;
        assert(_.isObject(options), "Page options must provided");
        const {
            width, height, userAgent, beginFrameTimeout,
            frameFormat, frameQuality, _firstPage = false
        } = options;
        assert(_.isUndefined(width) || _.isFinite(width), "Page width must be number");
        assert(_.isUndefined(height) || _.isFinite(height), "Page height must be number");
        assert(_.isUndefined(userAgent) || _.isString(userAgent), "Page userAgent must be string");
        assert(_.isUndefined(beginFrameTimeout) || _.isFinite(beginFrameTimeout), "Page beginFrameTimeout must be number");
        assert(_.isUndefined(frameQuality) || _.isFinite(frameQuality), "Page frameQuality must be number");
        assert(_.isUndefined(frameFormat) || _.isString(frameFormat), "Page frameFormat must be string");
        assert(_.isBoolean(_firstPage), "Page _firstPage must be boolean");
        this.width = width;
        this.height = height;
        this.userAgent = _.defaultTo(userAgent, _.defaultTo(globalConfig.userAgent, DEFAULT_USER_AGENT));
        this.beginFrameTimeout = _.defaultTo(beginFrameTimeout, _.defaultTo(globalConfig.beginFrameTimeout, 5000));
        this.frameFormat = _.defaultTo(frameFormat, _.defaultTo(globalConfig.frameFormat, "jpeg"));
        this.frameQuality = _.defaultTo(frameQuality, _.defaultTo(globalConfig.frameQuality, 80));
        this.firstPage = _firstPage;
    }

    // 初始化页面
    public async init(): Promise<void> {
        await this.asyncLock.acquire("init", async (): Promise<void> => {
            // 如果是浏览器首个页面将复用已开启的第一个页面
            if (this.firstPage)
                this.target = (await this.parent.target.pages())[0];
            else
                this.target = await this.parent.target.newPage();
            // 初始化渲染环境
            await this.envInit();
            // 设置页面已就绪
            this.setState(Page.STATE.READY);
        });
    }

    // 设置视窗
    public async setViewport(options: Partial<Viewport> & { width: number; height: number }): Promise<void> {
        const {width, height} = options;
        assert(_.isFinite(width), "Page viewport width must be number");
        assert(_.isFinite(height), "Page viewport height must be number");
        this.width = width;
        this.height = height;
        // 设置页面视窗
        await this.target.setViewport({
            ...options,
            width: Math.floor(width),
            height: Math.floor(height)
        });
    }

    // 导航URL
    public async goto(url: string, waitForOptions?: WaitForOptions | SetContentWaitForOptions): Promise<void> {
        assert(this.isReady(), "Page state must be ready");
        assert(util.isURL(url), "goto url is invalid");
        // 清除资源
        this.resetStates();
        // 检查URL
        !globalConfig.allowUnsafeContext && this.checkURL(url);
        // 开始CDP会话
        await this.startCDPSession();
        // 监听CSS动画
        await this.listenCSSAnimations();
        // 页面导航到URL
        await this.target.goto(url, waitForOptions as WaitForOptions);
        await Promise.all([
            // 注入公共样式
            this.injectStyle(COMMON_STYLE_CONTENT),
            // 注入MP4Box库
            this.injectLibrary(MP4BOX_LIBRARY_SCRIPT_CONTENT + ";window.____MP4Box = window.MP4Box;window.MP4Box = undefined"),
            // 注入Lottie动画库
            this.injectLibrary(LOTTIE_LIBRARY_SCRIPT_CONTENT + ";window.____lottie = window.lottie;window.lottie = undefined")
        ]);
        // 初始化捕获上下文
        await this.target.evaluate((): void => captureCtx.init());
    }

    // 设置页面内容
    public async setContent(content: string, waitForOptions?: WaitForOptions | SetContentWaitForOptions): Promise<void> {
        assert(this.isReady(), "Page state must be ready");
        assert(_.isString(content), "page content must be string");
        await this.target.goto("about:blank");
        // 清除资源
        this.resetStates();
        // 开始CDP会话
        await this.startCDPSession();
        // 监听CSS动画
        await this.listenCSSAnimations();
        await this.target.setContent(content, waitForOptions as SetContentWaitForOptions);
        await Promise.all([
            // 注入公共样式
            this.injectStyle(COMMON_STYLE_CONTENT),
            // 注入MP4Box库
            this.injectLibrary(MP4BOX_LIBRARY_SCRIPT_CONTENT + ";window.____MP4Box = window.MP4Box;window.MP4Box = undefined"),
            // 注入Lottie动画库
            this.injectLibrary(LOTTIE_LIBRARY_SCRIPT_CONTENT + ";window.____lottie = window.lottie;window.lottie = undefined")
        ]);
        // 初始化捕获上下文
        await this.target.evaluate((): void => captureCtx.init());
    }

    // 设置背景不透明度（0-1）
    public setBackgroundOpacity(opacity = 1): void {
        assert(this.isReady(), "Page state must be ready");
        assert(_.isFinite(opacity), "opacity must be number");
        this.backgroundOpacity = opacity;
    }

    // 注册字体
    public registerFont(font: Font): void {
        if (!(font instanceof Font))
            font = new Font(font);
        // 开始加载字体
        font.load().catch((err: Error): void => this.emitError(err));
        this.fonts.push(font);
    }

    // 注册多个字体
    public registerFonts(fonts: Font[] = []): void {
        fonts.forEach((font): void => this.registerFont(font));
    }

    // 注册动作序列
    public registerTimeActions(timeActions: { [key: number]: (page: Page) => void | Promise<void> }): void {
        this.timeActions = {...timeActions};
    }

    // 等待字体加载完成
    public async waitForFontsLoaded(timeout = 30000): Promise<void> {
        // 注入Webfont库
        await this.injectLibrary(FONTFACE_OBSERVER_SCRIPT_CONTENT + ";window.____FontFaceObserver = FontFaceObserver");
        // 等待字体加载完成
        await Promise.all(this.fonts.map((font): Promise<void> => font.load()));
        // 将所有字体声明拼接为样式
        const styles = this.fonts.reduce((style, font): string => style + font.toFontFace(), "");
        // 添加样式标签到页面
        styles && await this.injectStyle(styles);
        // 该回调在浏览器页面上下文执行，Node侧tsconfig无DOM lib，统一经globalThis访问
        await this.target.evaluate(async (_timeout: number): Promise<void> => {
            const win = globalThis as unknown as {
                document: { fonts: Iterable<{ family: string }> };
                ____FontFaceObserver: new (family: string) => { load(): Promise<unknown> };
                ____setTimeout: (fn: () => void, timeout?: number) => number;
                setTimeout: (fn: () => void, timeout?: number) => number;
                ____clearTimeout: (timerId: number) => void;
                clearTimeout: (timerId: number) => void;
            };
            const fonts = [...win.document.fonts];
            // 无字体则跳过加载
            if (fonts.length == 0)
                return;
            // 等待字体加载完成
            let timer: number;
            await Promise.race([
                Promise.all(fonts.map((font): Promise<unknown> => new win.____FontFaceObserver(font.family).load())),
                new Promise((_, reject): number => timer = (win.____setTimeout || win.setTimeout)(reject, _timeout))
            ]);
            (win.____clearTimeout || win.clearTimeout)(timer);
        }, timeout);
    }

    // 注入样式
    private async injectStyle(content: string): Promise<void> {
        assert(_.isString(content), "inject style content must be string");
        await this.target.addStyleTag({
            content
        });
    }

    // 注入脚本库
    private async injectLibrary(content: string): Promise<void> {
        assert(_.isString(content), "inject script content must be string");
        await this.target.addScriptTag({
            content
        });
    }

    // 开始录制
    public async startScreencast(options: ICaptureContextConfig = {}): Promise<void> {
        await this.asyncLock.acquire("startScreencast", async (): Promise<void> => {
            let {
                fps,
                startTime = 0,
                duration,
                frameCount,
                autostart = true,
                videoDecoderHardwareAcceleration
            } = options;
            assert(this.isReady(), "Page state must be ready");
            assert(_.isUndefined(fps) || _.isFinite(fps), "fps must be number");
            assert(_.isFinite(startTime), "startTime must be number");
            assert(_.isUndefined(duration) || _.isFinite(duration), "duration must be number");
            assert(_.isUndefined(frameCount) || _.isFinite(frameCount), "frameCount must be number");
            assert(_.isUndefined(videoDecoderHardwareAcceleration) || _.isString(videoDecoderHardwareAcceleration), "videoDecoderHardwareAcceleration must be string");
            // 指定时长时将计算总帧数
            if (_.isFinite(duration))
                frameCount = util.durationToFrameCount(duration, fps);
            else if (_.isFinite(frameCount))
                duration = util.frameCountToDuration(frameCount, fps);
            // 页面进入捕获中状态
            this.setState(Page.STATE.CAPTURING);
            // 当当前视图与设定不一致时进行调整（以视频设定宽高为准）
            const {width, height, ..._options} = this.target.viewport() || {};
            if (width != this.width || height != this.height)
                await this.setViewport({..._options, width: this.width, height: this.height});
            // 应用背景不透明度
            await this.applyBackgroundOpacity();
            // 将鼠标移动到屏幕中央
            await this.target.mouse.move(this.width / 2, this.height / 2);
            // 如果设置帧率或者总帧数将覆盖页面中设置的帧率和总帧数
            await this.target.evaluate(async (config: ICaptureContextConfig): Promise<void> => {
                // 注入配置选项
                Object.assign(captureCtx.config, config);
                // 如果准备后还未启动且自动启动选项开启时渲染则开始
                !captureCtx.ready() && captureCtx.config.autostart && captureCtx.start();
            }, _.pickBy({
                fps,
                startTime,
                duration,
                frameCount,
                autostart,
                videoDecoderHardwareAcceleration
            }, (v): boolean => !_.isUndefined(v)));
        });
    }

    // 暂停录制
    public async pauseScreencast(): Promise<void> {
        assert(this.isCapturing(), "Page state is not capturing, unable to pause");
        await this.target.evaluate(async (): Promise<boolean> => captureCtx.pauseFlag = true);
        this.setState(Page.STATE.PAUSED);
    }

    // 恢复录制
    public async resumeScreencast(): Promise<void> {
        assert(this.isPaused(), "Page state is not paused, unable to resume");
        await this.target.evaluate(async (): Promise<void> => {
            if (captureCtx.resumeCallback) {
                captureCtx.resumeCallback();
                captureCtx.resumeCallback = null;
            }
            captureCtx.pauseFlag = false;
        });
        this.setState(Page.STATE.CAPTURING);
    }

    // 停止录制
    public async stopScreencast(): Promise<void> {
        await this.asyncLock.acquire("stopScreencast", async (): Promise<void> => {
            await this.target.evaluate(async (): Promise<boolean> => captureCtx.stopFlag = true);
            await this.endCDPSession();
            this.setState(Page.STATE.STOPPED);
        });
    }

    // 获取捕获上下文配置
    public async getCaptureContextConfig(): Promise<ICaptureContextConfig> {
        return await this.target.evaluate((): ICaptureContextConfig => captureCtx.config);
    }

    // 发送错误事件
    private emitError(err: Error): void {
        if (err.message.indexOf("Another frame is pending") != -1)
            err = new Error("Page rendering has been interrupted");
        if (this.eventNames().indexOf("error") != -1)
            this.emit("error", err);
        else
            logger.error("Page error:", err);
    }

    // 发送崩溃事件
    private emitCrashed(err: Error): void {
        // 设置页面为不可用
        this.setState(Page.STATE.UNAVAILABLED);
        if (this.eventNames().indexOf("crashed") != -1)
            this.emit("crashed", err);
        else
            logger.error("Page crashed:", err);
    }

    // 发送录制完成事件
    private emitScreencastCompleted(): void {
        this.emit("screencastCompleted");
    }

    // 环境初始化
    private async envInit(): Promise<void> {
        // 设置UserAgent防止页面识别HeadlessChrome
        await this.target.setUserAgent(this.userAgent);
        // 禁用CSP策略
        await this.target.setBypassCSP(true);
        // 拦截请求
        await this.target.setRequestInterception(true);
        // 页面控制台输出
        this.target.on("console", (message: ConsoleMessage): void => {
            const type = message.type();
            const text = message.text();
            // 错误消息处理
            if (type === "error") {
                if (text.indexOf("Failed to load resource: the server responded with a status of ") != -1)
                    return;
                this.emit("consoleError", new PageError(text));
            }
            // 其它消息处理
            else
                this.emit("consoleLog", text);
        });
        // 页面加载完成事件
        this.target.on("domcontentloaded", async (): Promise<void> => {
            // 如果处于录制状态作为被动刷新处理
            if (this.isCapturing())
                this.emitError(new Error("Page context is missing, possibly due to the page being refreshed"))
        });
        // 页面请求处理
        this.target.on("request", this.requestHandle.bind(this));
        // 页面响应处理
        this.target.on("response", this.responseHandle.bind(this));
        // 页面错误回调
        this.target.on("pageerror", (err): boolean => this.emit("consoleError", new PageError(err as Error)));
        // 页面崩溃回调
        this.target.once("error", this.emitCrashed.bind(this));
        // 页面关闭回调
        this.target.once("close", this.close.bind(this));
        // 暴露录制完成函数
        await this.target.exposeFunction("____screencastCompleted", this.emitScreencastCompleted.bind(this));
        // 暴露CSS动画控制函数
        await this.target.exposeFunction("____seekCSSAnimations", this.seekCSSAnimations.bind(this));
        // 暴露动作序列
        await this.target.exposeFunction("____seekTimeActions", this.seekTimeActions.bind(this));
        // 暴露跳帧函数
        await this.target.exposeFunction("____skipFrame", this.skipFrame.bind(this));
        // 暴露下一帧函数
        await this.target.exposeFunction("____captureFrame", this.captureFrame.bind(this));
        // 暴露添加音频函数
        await this.target.exposeFunction("____addAudio", this.addAudio.bind(this));
        await this.target.exposeFunction("____updateAudioEndTime", this.updateAudioEndTime.bind(this));
        // 暴露抛出错误函数
        await this.target.exposeFunction("____throwError", (code = -1, message = ""): void => this.emitError(new Error(`throw error: [${code}] ${message}`)));
        // 页面加载前注入浏览器侧捕获上下文 bundle（dist/browser/injected.js，由其挂载 captureCtx 与 ____* 页面全局）
        await this.target.evaluateOnNewDocument(INJECTED_SCRIPT_CONTENT);
    }

    // seek所有CSS动画
    private async seekCSSAnimations(currentTime: number): Promise<void> {
        if (this.cssAnimations.length === 0)
            return;
        const pauseAnimationIds: string[] = [];
        const seekPromises: Promise<unknown>[] = [];
        this.cssAnimations = this.cssAnimations.filter((animation: ICssAnimation): boolean => {
            if (animation.startTime == null)
                pauseAnimationIds.push(animation.id);
            animation.startTime = _.defaultTo(animation.startTime, currentTime);
            const animationCurrentTime = Math.floor(currentTime - animation.startTime);
            if (animationCurrentTime < 0)
                return true;
            seekPromises.push(this.cdpSession.send("Animation.seekAnimations", {
                animations: [animation.id],
                currentTime: animationCurrentTime
            }));
            if (animationCurrentTime >= (animation.duration * (animation.iterations || Infinity)) + animation.delay)
                return false;
            return true;
        });
        // 暂停动画
        if (pauseAnimationIds.length > 0) {
            await this.cdpSession.send("Animation.setPaused", {
                animations: pauseAnimationIds,
                paused: true
            });
        }
        // 调度动画
        await Promise.all(seekPromises);
    }

    // seek所有时间轴动作
    private async seekTimeActions(currentTime: number): Promise<void> {
        currentTime = parseInt(String(currentTime))
        const matchTimeNodes = Object.keys(this.timeActions)
            .map(Number)
            .sort((a, b): number => a - b)
            .find((time): boolean => currentTime >= time);
        if (matchTimeNodes === undefined)
            return;
        const timeAction = this.timeActions[matchTimeNodes];
        delete this.timeActions[matchTimeNodes]
        try {
            const result = timeAction(this);
            if (result instanceof Promise)
                await result.catch((err): void => this.emitError(err))
        } catch (err) {
            this.emitError(err as Error)
        }
    }

    // 跳过帧
    private async skipFrame(): Promise<void> {
        if (globalConfig.compatibleRenderingMode)
            return;
        let timer;
        // 帧数据捕获（beginFrame 以浏览器级锁串行化，避免同浏览器多页面重叠调用使 GPU 进程崩溃）
        const frameData = await this.parent.acquireBeginFrame(async (): Promise<false | Protocol.HeadlessExperimental.BeginFrameResponse> => Promise.race([
            this.cdpSession.send("HeadlessExperimental.beginFrame"),
            // 帧渲染超时处理
            new Promise<false>((resolve): NodeJS.Timeout => timer = setTimeout((): void => resolve(false), this.beginFrameTimeout))
        ]));
        clearTimeout(timer);
        // 帧渲染超时处理
        if (frameData === false) {
            this.setState(Page.STATE.UNAVAILABLED);
            throw new Error("beginFrame wait timeout");
        }
    }

    // 捕获帧
    private async captureFrame(): Promise<boolean> {
        try {
            // 非兼容渲染模式使用BeginFrame API进行捕获否则使用截图API
            const frameFormat = this.backgroundOpacity < 1 ? "png" : this.frameFormat;
            if (!globalConfig.compatibleRenderingMode) {
                let timer;
                // 帧数据捕获（beginFrame 以浏览器级锁串行化，避免同浏览器多页面重叠调用使 GPU 进程崩溃）
                const frameData = await this.parent.acquireBeginFrame(async (): Promise<false | IBeginFrameResult> => Promise.race([
                    this.cdpSession.send("HeadlessExperimental.beginFrame", {
                        screenshot: {
                            // 帧图格式（jpeg, png)
                            format: frameFormat as "jpeg" | "png" | "webp",
                            // 帧图质量（0-100）
                            quality: frameFormat == "jpeg" ? this.frameQuality : undefined
                        }
                    }) as Promise<IBeginFrameResult>,
                    // 帧渲染超时处理
                    new Promise<false>((resolve): NodeJS.Timeout => timer = setTimeout((): void => resolve(false), this.beginFrameTimeout))
                ]));
                clearTimeout(timer);
                // 帧渲染超时处理
                if (frameData === false) {
                    this.setState(Page.STATE.UNAVAILABLED);
                    throw new Error("beginFrame wait timeout");
                }
                if (!frameData || !frameData.screenshotData) return true;
                await this.emitFrame(Buffer.from(frameData.screenshotData, "base64"));
            } else {
                const screenshotData = await this.target.screenshot({
                    type: frameFormat as "png" | "jpeg" | "webp",
                    quality: frameFormat == "jpeg" ? this.frameQuality : undefined,
                    optimizeForSpeed: true
                });
                // 帧数据回调
                await this.emitFrame(Buffer.from(screenshotData));
            }
            return true;
        } catch (err) {
            this.emitError(err as Error);
            return false;
        }
    }

    // 发送帧事件
    private async emitFrame(buffer: Buffer): Promise<void> {
        const listeners = this.listeners("frame") as ((buffer: Buffer) => void | Promise<void>)[];
        for (const listener of listeners)
            await listener(buffer);
    }

    // 添加音频
    private addAudio(options: IAudioAddPayload): void {
        this.emit("audioAdd", new Audio(options));
    }

    // 更新音频结束时间点
    private updateAudioEndTime(audioId: number, endTime: number): void {
        this.emit("audioUpdate", audioId, {endTime});
    }

    // 预处理视频
    private async preprocessVideo(config: VideoConfig): Promise<Buffer> {
        const videoPreprocessor = this.videoPreprocessor;
        this.emit("videoPreprocess", config);
        const {audio, buffer} = await videoPreprocessor.process(config);
        audio && this.emit("audioAdd", audio);
        return buffer;
    }

    // 开始CDP会话
    private async startCDPSession(): Promise<void> {
        this.cdpSession && await this.endCDPSession();
        this.cdpSession = await this.target.createCDPSession();  //创建会话
    }

    // 应用背景透明度
    private async applyBackgroundOpacity(): Promise<void> {
        await this.cdpSession.send("Emulation.setDefaultBackgroundColorOverride", {
            color: {r: 0, g: 0, b: 0, a: this.backgroundOpacity}
        });
    }

    // 监听CSS动画
    private async listenCSSAnimations(): Promise<void> {
        // 启用动画通知域
        await this.cdpSession.send("Animation.enable");
        // 监听动画开始事件将动画属性添加到调度列表
        this.cdpSession.on("Animation.animationStarted", (event: ICssAnimationEvent): void => {
            this.cssAnimations.push({
                id: event.animation.id,
                startTime: null,
                paused: false,
                backendNodeId: event.animation.source.backendNodeId,
                delay: event.animation.source.delay,
                duration: event.animation.source.duration,
                iterations: event.animation.source.iterations
            });
        });
    }

    // 结束CDP会话
    private async endCDPSession(): Promise<void> {
        if (!this.cdpSession) return;
        await new Promise<void>((resolve): void => {
            // 移除所有事件监听器
            this.cdpSession.removeAllListeners();
            // 从页面卸载CDP会话
            this.cdpSession.detach()
                .catch((err: unknown): boolean => this.emit("consoleError", err))
                .finally((): void => {
                    this.cdpSession = null;
                    resolve();
                });
        });
    }

    // 页面请求处理
    private requestHandle(request: HTTPRequest): void {
        (async (): Promise<void> => {
            // 如果是捕获中产生的跳转请求则终止
            if (this.isCapturing() && request.isNavigationRequest() && request.frame() === this.target.mainFrame()) {
                request.abort("aborted");
                return;
            }
            const method = request.method();
            const url = request.url();
            const {pathname} = new URL(url);
            // console.log(pathname);
            // 视频预处理API
            if (method == "POST" && pathname == "/api/video_preprocess") {
                const data = _.attempt((): IVideoConfigOptions => JSON.parse(request.postData()));
                if (_.isError(data))
                    throw new Error("api /api/video_preprocess only accept JSON data");
                const buffer = await this.preprocessVideo(new VideoConfig(data));
                const chunkSize = globalConfig.preprocessChunkSize;
                // 回传数据不超过分片大小时单次应答；超过时返回分片清单由客户端逐片拉取，
                // 避免单次应答超过浏览器约100MB读缓冲上限（上游 issues/21）
                if (!_.isFinite(chunkSize) || chunkSize <= 0 || buffer.length <= chunkSize) {
                    await request.respond({
                        status: 200,
                        body: buffer
                    });
                } else {
                    const id = crypto.randomUUID();
                    const manifest: IPreprocessChunkManifest = {
                        id,
                        size: buffer.length,
                        chunkSize,
                        chunks: Math.ceil(buffer.length / chunkSize)
                    };
                    this.preprocessBuffers.set(id, buffer);
                    await request.respond({
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "X-WVC-Chunked": "1"
                        },
                        body: JSON.stringify(manifest)
                    });
                }
            }
            // 预处理数据分片拉取
            else if (method == "GET" && pathname == "/api/video_preprocess_chunk") {
                const {searchParams} = new URL(url);
                const id = searchParams.get("id");
                const start = parseInt(searchParams.get("start") || "-1");
                const end = parseInt(searchParams.get("end") || "-1");
                const buffer = id ? this.preprocessBuffers.get(id) : null;
                if (!buffer || start < 0 || end <= start || end > buffer.length)
                    return await request.respond({status: 404, body: "Chunk not exists"});
                // 最后一片送达后释放缓存
                if (end >= buffer.length)
                    this.preprocessBuffers.delete(id);
                await request.respond({
                    status: 200,
                    body: buffer.subarray(start, end)
                });
            }
            // 从本地拉取字体
            else if (method == "GET" && /^\/local_font\//.test(pathname)) {
                const baseDir = path.resolve("tmp/local_font");
                const filePath = path.resolve(baseDir, pathname.substring(12));
                // 防止..路径穿越读取字体目录之外的文件
                if (!filePath.startsWith(baseDir + path.sep)) {
                    return await request.respond({
                        status: 404,
                        body: "File not exists"
                    });
                }
                if (!await fs.pathExists(filePath)) {
                    return await request.respond({
                        status: 404,
                        body: "File not exists"
                    });
                } else {
                    await request.respond({
                        status: 200,
                        body: await fs.readFile(filePath),
                        headers: {
                            // 要求浏览器缓存字体
                            "Cache-Control": "max-age=31536000"
                        }
                    });
                }
            }
            // 其它请求透传
            else
                await request.continue();
        })()
            .catch((err): void => {
                logger.error(err);
                // 发生错误响应500
                request.respond({
                    status: 500,
                    body: err.stack
                })
                    .catch((err): void => logger.error(err));
            })
    }

    // 页面响应处理
    private responseHandle(response: HTTPResponse): void {
        const status = response.status();
        const statusText = response.statusText();
        const method = response.request().method();
        const url = response.url();
        const id = `${method}:${url}`;
        if (this.resourceSet.has(id))
            return;
        this.resourceSet.add(id);
        const info = {
            status,
            statusText,
            method,
            url
        };
        if (status < 400) {
            this.acceptResources.push(info);
            this.emit("resourceAccepted", info);
        } else {
            this.rejectResources.push(info);
            const message = `Fetch response failed: [${method}] ${url} - [${status}] ${statusText}`;
            if (this.eventNames().indexOf("resourceError") != -1)
                this.emit("resourceRejected", new Error(message));
            else
                logger.error(message);
        }
    }

    // 重置页面
    public async reset(): Promise<void> {
        await this.asyncLock.acquire("reset", async (): Promise<void> => {
            // 如果处于捕获状态则停止录制
            this.isCapturing() && await this.stopScreencast();
            // 如果CDP会话存在则结束会话
            this.cdpSession && await this.endCDPSession();
            // 移除监听器
            this.removeListeners();
            // 清除资源
            this.resetStates();
            this.resourceSet = new Set();
            // 跳转空白页释放页面内存
            await this.target.goto("about:blank");
            // 设置页面状态为ready
            this.setState(Page.STATE.READY);
        });
    }

    // 释放页面资源
    public async release(): Promise<void> {
        await this.asyncLock.acquire("release", async (): Promise<void> => {
            // 重置页面
            await this.reset();
            // 通知浏览器释放页面
            await this.parent.releasePage(this);
            // 设置页面状态为ready
            this.setState(Page.STATE.READY);
        });
    }

    // 关闭页面
    public async close(): Promise<void> {
        await this.asyncLock.acquire("close", async (): Promise<void> => {
            if (this.isClosed())
                return;
            // 设置页面状态为closed
            this.setState(Page.STATE.CLOSED);
            // 先关闭页面目标：池自身发起销毁（clear）时该页面已无借出记录，
            // 随后通知池销毁会被拒绝，若置于其后会中断流程
            if (this.target && !this.target.isClosed())
                await this.target.close().catch((): void => {
                });
            this.target = null;
            // 通知浏览器页面池清理
            await this.parent.destoryPage(this);
        });
    }

    // 检查URL
    private checkURL(url: string): void {
        const {protocol, hostname, host} = new URL(url);
        if (protocol != "https:" && hostname != "127.0.0.1" && hostname != "localhost")
            throw new Error(`The URL ${protocol}//${host} is not a secure domain, which may cause security policies to disable some core features. Please use HTTPS protocol or http://localhost / http://127.0.0.1`);
    }

    // 重置状态
    private resetStates(): void {
        this.backgroundOpacity = 1;
        this.fonts = [];
        this.acceptResources = [];
        this.rejectResources = [];
        this.cssAnimations = [];
        this.timeActions = {};
        this.preprocessBuffers.clear();
    }

    // 移除所有监听器
    private removeListeners(): void {
        this.removeAllListeners("frame");
        this.removeAllListeners("screencastCompleted");
        this.removeAllListeners("consoleLog");
        this.removeAllListeners("consoleError");
        this.removeAllListeners("resourceAccepted");
        this.removeAllListeners("resourceRejected");
        this.removeAllListeners("videoPreprocess");
        this.removeAllListeners("audioAdd");
        this.removeAllListeners("audioUpdate");
        this.removeAllListeners("error");
        this.removeAllListeners("crashed");
    }

    // 设置页面资源状态
    private setState(state: symbol): void {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    // 是否未初始化
    public isUninitialized(): boolean {
        return this.state == Page.STATE.UNINITIALIZED;
    }

    // 是否已就绪
    public isReady(): boolean {
        return this.state == Page.STATE.READY;
    }

    // 是否正在捕获
    public isCapturing(): boolean {
        return this.state == Page.STATE.CAPTURING;
    }

    // 是否已暂停
    public isPaused(): boolean {
        return this.state == Page.STATE.PAUSED;
    }

    // 是否不可用
    public isUnavailabled(): boolean {
        return this.state == Page.STATE.UNAVAILABLED;
    }

    // 是否已关闭
    public isClosed(): boolean {
        return this.state == Page.STATE.CLOSED;
    }

    // 获取视频预处理器
    public get videoPreprocessor(): VideoPreprocessor {
        return this.parent.videoPreprocessor;
    }

}

class PageError extends Error {
    public name: string = "PageError";

    constructor(message: Error | string) {
        super(message instanceof Error ? message.stack : message);
    }
}
