import assert from "assert";
import ffmpeg from "fluent-ffmpeg";
import _ from "lodash";

import type {IGlobalConfig} from "../lib/global-config";
import globalConfig from "../lib/global-config";
import {VIDEO_ENCODER} from "../lib/const";
import ResourcePool from "../core/ResourcePool";
import type Page from "../core/Page";
import SingleVideo, {type ISingleVideoOptions} from "./SingleVideo";
import ChunkVideo, {type IChunkVideoOptions} from "./ChunkVideo";
import MultiVideo, {type IMultiVideoOptions} from "./MultiVideo";
import logger from "../lib/logger";
import cleaner from "../lib/cleaner";


export default class WebVideoCreator {

    public pool: ResourcePool = null; // 资源池
    // 是否已配置
    private configured: boolean = false;

    // 配置引擎
    public config(config: Partial<IGlobalConfig> = {}): void {
        // 配置项按 globalConfig 现有键逐一透传
        const target = globalConfig as unknown as Record<string, unknown>;
        const source = config as unknown as Record<string, unknown>;
        for (let key in globalConfig) {
            if (!_.isUndefined(source[key]))
                target[key] = source[key];
        }
        const {ffmpegExecutablePath, ffprobeExecutablePath, browserUseGPU, mp4Encoder} = globalConfig;
        // 未启用浏览器GPU发出性能警告
        if (!browserUseGPU)
            logger.warn("browserUseGPU is turn off, recommended to turn it on to improve rendering performance");
        // 未使用硬编码器发出性能警告
        if ((Object.values(VIDEO_ENCODER.CPU) as readonly string[]).includes(mp4Encoder))
            logger.warn(`Recommended to use video hard coder to accelerate video synthesis, currently used is [${globalConfig.mp4Encoder}]`);
        // 设置FFmpeg可执行文件路径
        ffmpegExecutablePath && ffmpeg.setFfmpegPath(ffmpegExecutablePath);
        // 设置FFprobe可执行文件路径
        ffprobeExecutablePath && ffmpeg.setFfprobePath(ffprobeExecutablePath);
        // 实例化浏览器资源池
        this.pool = new ResourcePool();
        // 设置已配置
        this.configured = true;
    }

    // 创建单幕视频
    public createSingleVideo(options: ISingleVideoOptions): SingleVideo {
        assert(this.configured, "WebVideoCreator has not been configured yet, please execute config() first");
        const singleVideo = new SingleVideo(options);
        // 注册获取页面函数
        singleVideo.onPageAcquire(async (): Promise<Page> => await this.pool.acquirePage());
        return singleVideo;
    }

    // 创建多幕视频
    public createMultiVideo(options: IMultiVideoOptions): MultiVideo {
        assert(this.configured, "WebVideoCreator has not been configured yet, please execute config() first");
        const multiVideo = new MultiVideo(options);
        // 注册获取页面函数
        multiVideo.onPageAcquire(async (): Promise<Page> => await this.pool.acquirePage())
        return multiVideo;
    }

    // 创建分块视频
    public createChunkVideo(options: IChunkVideoOptions): ChunkVideo {
        assert(this.configured, "WebVideoCreator has not been configured yet, please execute config() first");
        const chunkVideo = new ChunkVideo(options);
        // 注册获取页面函数
        chunkVideo.onPageAcquire(async (): Promise<Page> => await this.pool.acquirePage());
        return chunkVideo;
    }

    // 销毁浏览器资源池并复位配置
    public async destroy(): Promise<void> {
        if (this.pool)
            await this.pool.close();
        this.pool = null;
        this.configured = false;
    }

    // 清理浏览器缓存
    public cleanBrowserCache = cleaner.cleanBrowserCache.bind(cleaner);

    // 清理预处理缓存
    public cleanPreprocessCache = cleaner.cleanPreprocessCache.bind(cleaner);

    // 清理合成缓存
    public cleanSynthesizeCache = cleaner.cleanSynthesizeCache.bind(cleaner);

    // 清理本地字体缓存
    public cleanLocalFontCache = cleaner.cleanLocalFontCache.bind(cleaner);

}
