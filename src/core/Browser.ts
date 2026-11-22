import assert from "assert";
import path from "path";
import cp, {type ChildProcess} from "child_process";
import AsyncLock from "async-lock";
import puppeteer, {type Browser as PuppeteerBrowser} from "puppeteer-core";
import _ from "lodash";

import ResourcePool from "./ResourcePool";
import Page, {type IPageOptions} from "./Page";
import type VideoPreprocessor from "../preprocessor/video/VideoPreprocessor";
import globalConfig from "../lib/global-config";
import installBrowser from "../lib/install-browser";
import logger from "../lib/logger";
import {createPool, forwardFactoryCreateError, poolReady, type TPool} from "../lib/pool-util";

// 浏览器选项
export interface IBrowserOptions {
    numPageMax?: number; // 页面资源最大数量
    numPageMin?: number; // 页面资源最小数量
    executablePath?: string; // 浏览器可执行文件路径
    useGPU?: boolean; // 是否使用GPU加速渲染
    useAngle?: boolean; // 3D渲染后端是否使用Angle，建议开启
    disableDevShm?: boolean; // 是否禁用共享内存，当/dev/shm较小时建议开启此选项
    args?: string[]; // 浏览器启动参数
    debug?: boolean; // 浏览器日志是否输出到控制台
    pageOptions?: IPageOptions; // 页面选项
}

// 浏览器计数
let browserIndex = 1;

// 浏览器
export default class Browser {

    // 浏览器状态枚举
    public static STATE = {
        UNINITIALIZED: Symbol("UNINITIALIZED"), // 未初始化
        READY: Symbol("READY"), // 已就绪
        UNAVAILABLED: Symbol("UNAVAILABLED"), // 不可用
        CLOSED: Symbol("CLOSED") // 已关闭
    };

    // 浏览器ID
    public id: string = `Browser@${browserIndex++}`;
    public state: symbol = Browser.STATE.UNINITIALIZED; // 浏览器状态
    public parent: ResourcePool; // 浏览器池
    private pagePool: TPool<Page>; // 浏览器页面资源池
    public target: PuppeteerBrowser = null; // 浏览器实例
    public numPageMax: number; // 页面资源最大数量
    public numPageMin: number; // 页面资源最小数量
    public executablePath: string | null; // 浏览器入口文件路径
    public useGPU: boolean; // 是否使用GPU加速渲染
    public useAngle: boolean; // 3D渲染后端是否使用Angle，建议开启
    public disableDevShm: boolean; // 是否禁用共享内存，当/dev/shm较小时建议开启此选项
    public args: string[] = []; // 浏览器启动参数
    public pageOptions: IPageOptions = {}; // 页面选项
    // 浏览器是否已关闭
    public closed: boolean = false;
    private launchCallbacks: Array<(value?: unknown) => void> = []; // 启动回调队列
    // 是否初始页面
    private firstPageAvailable: boolean = true;
    // 异步锁
    private asyncLock: AsyncLock = new AsyncLock();
    // beginFrame 串行锁（浏览器级，跨其全部页面共享）
    private beginFrameLock: AsyncLock = new AsyncLock();
    private process: ChildProcess = null; // 浏览器子进程引用（用于关闭时确保进程树终止）

    // 构造函数
    constructor(parent: ResourcePool, options: IBrowserOptions = {}) {
        assert(parent instanceof ResourcePool, "Browser parent must be ResourcePool");
        this.parent = parent;
        assert(_.isObject(options), "Browser options must be object");
        const {numPageMax, numPageMin, executablePath, useGPU, useAngle, disableDevShm, args, pageOptions} = options;
        assert(_.isUndefined(numPageMax) || _.isFinite(numPageMax), "Browser numPageMax must be number");
        assert(_.isUndefined(numPageMin) || _.isFinite(numPageMin), "Browser numPageMin must be number");
        assert(_.isUndefined(executablePath) || _.isString(executablePath), "Browser executablePath must be string");
        assert(_.isUndefined(useGPU) || _.isBoolean(useGPU), "Browser useGPU must be boolean");
        assert(_.isUndefined(useAngle) || _.isBoolean(useAngle), "Browser useAngle must be boolean");
        assert(_.isUndefined(disableDevShm) || _.isBoolean(disableDevShm), "Browser disableDevShm must be boolean");
        assert(_.isUndefined(args) || _.isArray(args), "Browser args must be array");
        assert(_.isUndefined(pageOptions) || _.isObject(pageOptions), "Browser pageOptions must be object");
        this.numPageMax = _.defaultTo(numPageMax, _.defaultTo(globalConfig.numPageMax, 5));
        this.numPageMin = _.defaultTo(numPageMin, _.defaultTo(globalConfig.numPageMin, 1));
        this.executablePath = _.defaultTo(executablePath, _.defaultTo(globalConfig.browserExecutablePath, null));
        this.useGPU = _.defaultTo(useGPU, _.defaultTo(globalConfig.browserUseGPU, true));
        this.useAngle = _.defaultTo(useAngle, _.defaultTo(globalConfig.browserUseAngle, true));
        this.disableDevShm = _.defaultTo(disableDevShm, _.defaultTo(globalConfig.browserDisableDevShm, false));
        this.args = _.defaultTo(args, []);
        this.pageOptions = _.defaultTo(pageOptions, {});
    }

    // 浏览器资源初始化
    public async init(): Promise<void> {
        await this.asyncLock.acquire("init", async (): Promise<void> => {
            let executablePath;
            if (_.isString(this.executablePath))
                executablePath = this.executablePath;
            else
                ({executablePath} = await installBrowser());
            // 启动浏览器
            this.target = await puppeteer.launch({
                // BeginFrameControl仅在旧无头（chrome-headless-shell）中可用，
                // puppeteer>=22的headless:true指向新无头，必须使用"shell"，参考：https://bugs.chromium.org/p/chromium/issues/detail?id=1480747
                headless: _.defaultTo(globalConfig.browserHeadless, "shell"),
                // 浏览器入口文件路径
                executablePath,
                // 忽略HTTPS错误（puppeteer>=22更名为acceptInsecureCerts）
                acceptInsecureCerts: true,
                // 浏览器启动超时时间（毫秒）
                timeout: _.defaultTo(globalConfig.browserLaunchTimeout, 30000),
                // 是否输出调试信息到控制台
                dumpio: _.defaultTo(globalConfig.browserDebug, false),
                // 是否使用管道通信
                pipe: false,
                // 协议超时时间（毫秒）
                protocolTimeout: _.defaultTo(globalConfig.browserProtocolTimeout, 180000),
                // 每个浏览器实例独立的用户目录，避免多实例共享profile导致启动冲突；
                // 附加进程PID避免并发进程（如vitest多worker）因计数器各自从1开始而碰撞同一目录
                userDataDir: path.join("tmp/browser", `${this.id.replace("@", "-")}-p${process.pid}`),
                // 浏览器启动参数
                args: this.generateArgs()
            });
            // 记录子进程引用，关闭时据此确保进程树终止（不依赖CDP连接状态）
            this.process = this.target.process();
            // 浏览器关闭时自动处理
            this.target.once("disconnected", (): void => {
                this.close()
                    .catch((err): void => logger.error(`Browser ${this.id} close error:`, err));
            });
            // 创建页面池
            this.createPagePool();
            // 预热页面池
            await this.warmupPagePool();
            // 启动回调
            this.launchCallbacks.forEach((fn): void => fn());
            // 设置浏览器状态为已就绪
            this.setState(Browser.STATE.READY);
        });
    }

    // 创建页面池
    private createPagePool(): void {
        this.pagePool = createPool<Page>({
            create: this.createPage.bind(this),
            destroy: (target): Promise<void> => target.close(),
            validate: (target): boolean => target.isReady()
        }, {
            max: this.numPageMax,
            min: this.numPageMin,
            autostart: false
        });
        forwardFactoryCreateError(this.pagePool, (error): void => logger.error(error));
    }

    // 预热页面池
    private async warmupPagePool(): Promise<void> {
        this.pagePool.start();
        await poolReady(this.pagePool, this.numPageMin);
    }

    // 获取可用页面资源
    public async acquirePage(): Promise<Page> {
        return await this.pagePool.acquire();
    }

    // 串行化本浏览器内所有页面的 beginFrame 调用
    public acquireBeginFrame<T>(fn: () => T | PromiseLike<T>): Promise<T> {
        return this.beginFrameLock.acquire("beginFrame", fn);
    }

    // 创建页面资源
    private async createPage(): Promise<Page> {
        if (!this.target)
            await new Promise((resolve): number => this.launchCallbacks.push(resolve));
        const page = new Page(this, {...this.pageOptions, _firstPage: this.firstPage});
        await page.init();
        return page;
    }

    // 释放页面资源
    public async releasePage(page: Page): Promise<void> {
        await this.pagePool.release(page);
    }

    // 销毁页面资源
    public async destoryPage(page: Page): Promise<void> {
        // 公开 destroy 仅对已借出资源有效；池自身销毁（clear）或空闲页面无借出记录，忽略该拒绝
        await this.pagePool.destroy(page).catch((): void => {
        });
    }

    // 释放浏览器资源
    public async release(): Promise<void> {
        await this.asyncLock.acquire("release", async (): Promise<void> => {
            // 通知浏览器资源池释放资源
            await this.parent.releaseBrowser(this);
            // 设置浏览器状态为已就绪
            this.setState(Browser.STATE.READY);
        });
    }

    // 关闭浏览器
    public async close(): Promise<void> {
        await this.asyncLock.acquire("close", async (): Promise<void> => {
            if (this.isClosed())
                return;
            // 设置浏览器状态为已关闭
            this.setState(Browser.STATE.CLOSED);
            // 先在CDP仍连接时优雅关闭浏览器（由puppeteer终止进程）；
            // 若先清页面池可能使浏览器断开连接，导致此处被跳过而泄漏进程。
            // puppeteer>=22 的 Browser 以 connected 属性指示连接状态（旧版为 isConnected()）
            if (this.target && this.target.connected)
                await this.target.close().catch((err): void => logger.error(`Browser ${this.id} target close error:`, err));
            this.target = null;
            // 兜底：无论CDP是否已断开或优雅关闭是否生效，都确保浏览器进程树终止
            this.killProcess();
            // 清除页面池资源
            await this.pagePool.clear();
            // 通知浏览器资源池清理
            await this.parent.destoryBrowser(this);
        });
    }

    // 确保浏览器进程树终止
    private killProcess(): void {
        const proc = this.process;
        this.process = null;
        if (!proc || !proc.pid)
            return;
        try {
            if (process.platform === "win32")
                cp.execFileSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {stdio: "ignore"});
            else
                process.kill(-proc.pid, "SIGKILL");
        } catch {
            // 进程组已退出（ESRCH）等情况回退到单进程kill
            try {
                proc.kill("SIGKILL");
            } catch {
            }
        }
    }

    // 获取浏览器页面数量
    public async getPageCount(): Promise<number> {
        return (await this.target.pages()).length;
    }

    // 生成浏览器启动参数
    private generateArgs(): string[] {
        return [
            // 禁用沙箱
            "--no-sandbox",
            // 禁用UID沙箱
            "--disable-setuid-sandbox",
            // 不使用--single-process：现代headless-shell下它与GPU合成组合会导致渲染进程崩溃（ECONNRESET），
            // 帧确定性由--deterministic-mode与--enable-begin-frame-control保证，与进程模型无关
            // 如果共享内存/dev/shm比较小，可能导致浏览器无法启动，可以禁用它
            ...(this.disableDevShm ? ["--disable-dev-shm-usage"] : []),
            // 禁用扩展程序
            "--disable-extensions",
            // 隐藏滚动条
            "--hide-scrollbars",
            // 静音
            "--mute-audio",
            // 禁用Web安全策略
            "--disable-web-security",
            // 禁用小恐龙彩蛋
            "--disable-dinosaur-easter-egg",
            // 禁用IPC泛洪保护
            "--disable-ipc-flooding-protection",
            // 禁用降低后台标签页优先级
            "--disable-backgrounding-occluded-windows",
            // 禁用后台标签页定时器节流
            "--disable-background-timer-throttling",
            // 禁用渲染器进程后台化
            "--disable-renderer-backgrounding",
            // 禁用组件更新
            "--disable-component-update",
            // 禁用崩溃报告系统
            "--disable-breakpad",
            // 禁用ping元素
            "--no-pings",
            // 禁用信息栏
            "--disable-infobars",
            // 禁用会话崩溃气泡
            "--disable-session-crashed-bubble",
            // 禁用字形提示以原始轮廓渲染
            "--font-render-hinting=none",
            // 允许在HTTPS页面中加载不安全的HTTP内容
            "--allow-running-insecure-content",
            // 禁用默认浏览器检查
            "--no-default-browser-check",
            // 禁用弹窗
            "--block-new-web-contents",
            // 禁用错误对话框
            "--noerrdialogs",
            // 启用平滑滚动
            "--enable-smooth-scrolling",
            // 禁用线程动画避免动画不同步
            "--disable-threaded-animation",
            // 禁用线程滚动避免动画不同步
            "--disable-threaded-scrolling",
            // 强制所有内容完整渲染
            "--disable-new-content-rendering-timeout",
            // 禁用渲染器代码完整性，避免因为STATUS_ACCESS_VIOLATION导致页面崩溃
            "--disable-features=RendererCodeIntegrity",
            ...(!globalConfig.browserFrameRateLimit ? [
                // 解除帧率限制
                "--disable-frame-rate-limit",
            ] : []),
            ...(!globalConfig.compatibleRenderingMode ? [
                // 启用确定性模式
                "--deterministic-mode",
                // 开启beginFrame控制
                "--enable-begin-frame-control",
                // 在呈现所有内容之前防止绘制下一帧
                "--run-all-compositor-stages-before-draw",
            ] : []),
            // 是否使用Angle作为渲染后端
            ...(this.useAngle ? ["--use-angle"] : []),
            // 是否使用GPU加速渲染
            ...(this.useGPU ? [
                // 启用GPU
                "--enable-gpu",
                // 启用不安全的WebGPU
                "--enable-unsafe-webgpu",
                // 忽略GPU黑名单，在黑名单的GPU渲染时可能会发生非预期效果
                "--ignore-gpu-blocklist",
                // 图形上下文丢失时不重载页面
                "--gpu-no-context-lost",
                // 启用GPU合成功能
                "--enable-gpu-compositing",
                // 启用GPU栅格化加速绘制
                "--enable-gpu-rasterization",
                // 禁用GPU驱动程序错误处理工作
                // "--disable-gpu-driver-bug-workarounds",
                // 启用GPU内存缓冲区提高图像处理性能
                "--enable-native-gpu-memory-buffers",
                // 启用2D画布加速功能
                "--enable-accelerated-2d-canvas",
                // 启用JPEG解码加速功能
                "--enable-accelerated-jpeg-decoding",
                // 启用MJPEG解码加速功能
                "--enable-accelerated-mjpeg-decode",
                // 启用视频解码加速功能
                "--enable-accelerated-video-decode",
                // 启用零拷贝渲染
                "--enable-zero-copy",
                // 将页面渲染栅格化操作移动到单独的进程中执行
                "--enable-oop-rasterization",
                // 启用GPU内存缓冲区缓存视频帧
                "--enable-gpu-memory-buffer-video-frames",
                // 启用VA-API视频解码器支持、HEVC视频解码器支持
                "--enable-features=VaapiVideoDecoder,PlatformHEVCDecoderSupport"
            ] : ["--disable-gpu"]),
            // 其它参数
            ...this.args
        ];
    }

    // 设置浏览器资源状态
    private setState(state: symbol): void {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    // 是否未初始化
    public isUninitialized(): boolean {
        return this.state == Browser.STATE.UNINITIALIZED;
    }

    // 是否已就绪
    public isReady(): boolean {
        return this.state == Browser.STATE.READY;
    }

    // 是否不可用
    public isUnavailabled(): boolean {
        return this.state == Browser.STATE.UNAVAILABLED;
    }

    // 是否已关闭
    public isClosed(): boolean {
        return this.state == Browser.STATE.CLOSED;
    }

    // 判断页面资源池是否饱和
    public isBusy(): boolean {
        return this.pagePool.borrowed >= this.pagePool.max;
    }

    // 获取是否首个页面
    public get firstPage(): boolean {
        if (!this.firstPageAvailable)
            return false;
        this.firstPageAvailable = false;
        return true;
    }

    // 获取视频预处理器
    public get videoPreprocessor(): VideoPreprocessor {
        return this.parent.videoPreprocessor;
    }

}
