import assert from "assert";
import AsyncLock from "async-lock";
import _ from "lodash";

import Browser, {type IBrowserOptions} from "./Browser";
import Page from "./Page";
import VideoPreprocessor from "../preprocessor/video/VideoPreprocessor";
import globalConfig from "../lib/global-config";
import logger from "../lib/logger";
import {createPool, forwardFactoryCreateError, type TPool} from "../lib/pool-util";

// 视频预处理器选项
export interface IVideoPreprocessorOptions {
    parallelDownloads?: number; // 并行下载数量
    parallelProcess?: number; // 并行处理数量
    videoEncoder?: string; // 视频编码器（必须为H264编码器）
}

// 资源池选项
export interface IResourcePoolOptions {
    numBrowserMax?: number; // 浏览器资源最大数量
    numBrowserMin?: number; // 浏览器资源最小数量
    browserOptions?: IBrowserOptions; // 浏览器选项
    videoPreprocessorOptions?: IVideoPreprocessorOptions; // 视频预处理器选项
}

// 异步锁
const asyncLock = new AsyncLock();

// 校验资源池配置：numBrowser/numPage 的 min/max 须为有限正数且 min<=max，违反即抛错
function validatePoolConfig(): void {
    const {numBrowserMin, numBrowserMax, numPageMin, numPageMax} = globalConfig;
    const limits: [string, number][] = [
        ["numBrowserMin", numBrowserMin],
        ["numBrowserMax", numBrowserMax],
        ["numPageMin", numPageMin],
        ["numPageMax", numPageMax]
    ];
    for (const [name, value] of limits) {
        if (!_.isFinite(value) || value <= 0)
            throw new Error(`ResourcePool config error: globalConfig.${name} must be a finite positive number, but got ${value}`);
    }
    if (numBrowserMin > numBrowserMax)
        throw new Error(`ResourcePool config error: globalConfig.numBrowserMin (${numBrowserMin}) must not be greater than globalConfig.numBrowserMax (${numBrowserMax})`);
    if (numPageMin > numPageMax)
        throw new Error(`ResourcePool config error: globalConfig.numPageMin (${numPageMin}) must not be greater than globalConfig.numPageMax (${numPageMax})`);
}

// 资源池
export default class ResourcePool {

    private browserPool: TPool<Browser>; // 浏览器资源池
    public readonly videoPreprocessor: VideoPreprocessor; // 视频预处理器
    public numBrowserMax: number; // 浏览器资源最大数量
    public numBrowserMin: number; // 浏览器资源最小数量
    public readonly browserOptions: IBrowserOptions = {}; // 浏览器选项
    public videoPreprocessorOptions: IVideoPreprocessorOptions = {}; // 视频预处理器选项
    private warmupped: boolean = false;
    private closed: boolean = false;
    private checkerTimer: NodeJS.Timeout = null;
    private checkMap: { [key: string]: () => boolean } = {};

    // 构造函数
    constructor(options: IResourcePoolOptions = {}) {
        assert(_.isObject(options), "ResourcePool options must provided");
        const {numBrowserMax, numBrowserMin, browserOptions, videoPreprocessorOptions} = options;
        assert(_.isUndefined(numBrowserMax) || _.isFinite(numBrowserMax), "ResourcePool options.numBrowserMax must be number");
        assert(_.isUndefined(numBrowserMin) || _.isFinite(numBrowserMin), "ResourcePool options.numBrowserMin must be number");
        assert(_.isUndefined(browserOptions) || _.isObject(browserOptions), "ResourcePool options.browserOptions must be object");
        assert(_.isUndefined(videoPreprocessorOptions) || _.isObject(videoPreprocessorOptions), "ResourcePool options.browserOptions must be object");
        this.numBrowserMax = _.defaultTo(numBrowserMax, _.defaultTo(globalConfig.numBrowserMax, 5));
        this.numBrowserMin = _.defaultTo(numBrowserMin, _.defaultTo(globalConfig.numBrowserMin, 1));
        this.browserOptions = _.defaultTo(browserOptions, {});
        this.videoPreprocessorOptions = _.defaultTo(videoPreprocessorOptions, {});
        this.videoPreprocessor = new VideoPreprocessor(this.videoPreprocessorOptions);
        validatePoolConfig();
        this.createBrowserPool();
        this.checker();
    }

    // 预热浏览器资源池
    public async warmup(): Promise<void> {
        if (this.warmupped) return;
        await asyncLock.acquire("warmup", async (): Promise<void> => {
            this.closed = false;
            this.browserPool.start();
            await this.browserPool.ready();
            this.warmupped = true;
        });
    }

    // 关闭资源池
    public async close(): Promise<void> {
        if (!this.warmupped)
            return;
        this.closed = true;
        clearTimeout(this.checkerTimer);
        await this.browserPool.drain();
        await this.browserPool.clear();
        this.warmupped = false;
    }

    // 创建浏览器资源池
    private createBrowserPool(): void {
        this.browserPool = createPool<Browser>({
            create: this.createBrowser.bind(this),
            destroy: async (target): Promise<void> => target.close(),
            validate: (target): boolean => target.isReady()
        }, {
            max: this.numBrowserMax,
            min: this.numBrowserMin,
            autostart: false
        });
        forwardFactoryCreateError(this.browserPool, (error): void => logger.error(error));
    }

    // 获取可用页面资源
    public async acquirePage(): Promise<Page> {
        // 使用异步锁解决重入
        return await asyncLock.acquire("acquirePage", async (): Promise<Page> => {
            // 获取可用的浏览器资源
            const browser = await this.acquireBrowser();
            // 从浏览器获取可用的页面资源
            const page = await browser.acquirePage();
            // 如果浏览器页面池未饱和则释放浏览器资源供下一次获取
            if (!browser.isBusy())
                await browser.release();
            // 如果已饱和加入检查列表等待未饱和时释放浏览器资源
            else if (!this.checkMap[browser.id]) {
                this.checkMap[browser.id] = (): boolean => {
                    if (!browser.isBusy()) {
                        browser.release();
                        return true;
                    }
                    return false;
                };
            }
            // 返回可用页面资源
            return page;
        });
    }

    // 获取可用浏览器资源
    public async acquireBrowser(): Promise<Browser> {
        !this.warmupped && await this.warmup();
        return await this.browserPool.acquire();
    }

    // 创建浏览器资源
    private async createBrowser(): Promise<Browser> {
        const browser = new Browser(this, this.browserOptions);
        await browser.init();
        return browser;
    }

    // 释放浏览器资源
    public async releaseBrowser(browser: Browser): Promise<void> {
        await this.browserPool.release(browser);
    }

    // 销毁浏览器资源
    public async destoryBrowser(browser: Browser): Promise<void> {
        if (this.checkMap[browser.id])
            delete this.checkMap[browser.id];
        // 公开 destroy 仅对已借出资源有效；池自身销毁（drain/clear）或空闲浏览器无借出记录，
        // 忽略"资源不在池中"的拒绝，避免中断浏览器关闭流程
        await this.browserPool.destroy(browser).catch((): void => {
        });
    }

    // 判断浏览器资源池是否饱和
    public isBusy(): boolean {
        return this.browserPool.borrowed >= this.browserPool.max;
    }

    // 检查器
    private checker(): void {
        if (this.closed)
            return;
        (async (): Promise<void> => {
            for (let id in this.checkMap) {
                if (this.checkMap[id]())
                    delete this.checkMap[id];
            }
        })()
            .then((): void => {
                if (this.closed)
                    return;
                this.checkerTimer = setTimeout(this.checker.bind(this), 5000);
                // 不阻塞进程退出
                this.checkerTimer.unref();
            })
            .catch((err): void => logger.error(err));
    }

}
