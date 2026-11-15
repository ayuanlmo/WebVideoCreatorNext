import assert from "assert";
import AsyncLock from "async-lock";
import _ from "lodash";

import ChunkSynthesizer, {type IChunkSynthesizerOptions} from "../core/ChunkSynthesizer";
import ChunkVideo, {type IChunkVideoOptions} from "./ChunkVideo";
import Page from "../core/Page";
import Font, {type IFontOptions} from "../entity/Font";
import Transition, {type ITransitionOptions} from "../entity/Transition";
import logger from "../lib/logger";
import type {IRenderResult} from "../core/Synthesizer";

// 多幕视频选项
export interface IMultiVideoOptions extends IChunkSynthesizerOptions {
    startTime?: number; // 开始捕获时间点（毫秒）
    pagePrepareFn?: (page: Page) => void | Promise<void>; // 页面预处理函数
}

// 多幕视频
export default class MultiVideo extends ChunkSynthesizer {

    public startTime: number; // 开始捕获时间点
    public fonts: Font[] = []; // 注册的字体
    public pagePrepareFn: (page: Page) => void | Promise<void>; // 页面预处理函数
    public timeActions: { [key: number]: (page: Page) => void | Promise<void> }; // 动作序列
    private pageAcquireFn: () => Promise<Page> = null; // 页面获取函数
    // 异步锁
    private asyncLock: AsyncLock = new AsyncLock();

    // 构造函数
    constructor(options: IMultiVideoOptions) {
        super(options);
        const {startTime, pagePrepareFn} = options;
        assert(_.isUndefined(startTime) || _.isFinite(startTime), "startTime must be number");
        assert(_.isUndefined(pagePrepareFn) || _.isFunction(pagePrepareFn), "pagePrepareFn must be Function");
        this.startTime = startTime;
        this.pagePrepareFn = pagePrepareFn;
    }

    // 启动合成
    public start(): void {
        this.asyncLock.acquire("start", (): Promise<IRenderResult> => this.synthesize())
            .catch((err): void => logger.error(err));
    }

    // 启动并等待
    public async startAndWait(): Promise<void> {
        await this.asyncLock.acquire("start", (): Promise<IRenderResult> => this.synthesize());
    }

    // 输入分块视频（Buffer 仅为兼容基类 input(buffer: Buffer) 签名）
    public input(_chunk: ChunkVideo | IChunkVideoOptions | Buffer, transition?: Transition | string | ITransitionOptions): Promise<void> | void {
        let chunk = _chunk as ChunkVideo | IChunkVideoOptions;
        _.isFinite(this.width) && (chunk.width = _.defaultTo(chunk.width, this.width));
        _.isFinite(this.height) && (chunk.height = _.defaultTo(chunk.height, this.height));
        _.isFinite(this.fps) && (chunk.fps = _.defaultTo(chunk.fps, this.fps));
        if (!(chunk instanceof ChunkVideo))
            chunk = new ChunkVideo(chunk as IChunkVideoOptions);
        super.input(chunk, transition);
        chunk.onPageAcquire(async (): Promise<Page> => await this.acquirePage());
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
    private async synthesize(): Promise<IRenderResult> {
        this.chunks.forEach((chunk): void => {
            const videoChunk = chunk as ChunkVideo;
            if (_.isUndefined(videoChunk.startTime) && this.startTime)
                videoChunk.startTime = this.startTime;
            if (_.isUndefined(videoChunk.pagePrepareFn) && this.pagePrepareFn)
                videoChunk.pagePrepareFn = this.pagePrepareFn;
            if (this.fonts.length > 0)
                videoChunk.registerFonts(this.fonts);
        });
        return await new Promise<IRenderResult>((resolve, reject): void => {
            const onError = (err: Error): void => {
                this.off("completed", onCompleted);
                reject(err);
            };
            const onCompleted = (result: IRenderResult): void => {
                this.off("error", onError);
                resolve(result);
            };
            this.once("error", onError);
            this.once("completed", onCompleted);
            super.start();
        });
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

}
