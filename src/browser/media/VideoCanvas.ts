import MP4Demuxer, {type IMP4DemuxConfig} from "./MP4Demuxer";
import innerUtil from "../inner-util";
import type {IPreprocessChunkManifest} from "../../lib/capture-ctx-api";

// 上游此处还 import 了 preprocessor/video/VideoConfig.js，仅用于 _exportConfig 的 JSDoc 类型标注。
// 浏览器侧 bundle 不能引入 Node 侧预处理器模块（依赖 fs / ffmpeg 等），故去掉该 import，
// 返回值以 IVideoCanvasOptions 标注，运行时行为不变。
const ____util = innerUtil();

// 带帧索引的视频帧（代码会在帧对象上挂载 index 属性）
type TVideoFrame = VideoFrame & { index?: number };

// 视频画布选项
export interface IVideoCanvasOptions {
    id?: string; // 元素ID
    class?: string; // 元素类名
    audioId?: number; // 内部音频唯一ID
    url?: string; // 视频来源
    maskUrl?: string; // 蒙版视频来源
    format?: string; // 视频格式（mp4/webm）
    width?: number; // 视频宽度
    height?: number; // 视频高度
    startTime?: number; // 开始播放时间点（毫秒）
    endTime?: number; // 结束播放时间（毫秒）
    fadeInDuration?: number; // 音频淡入时长（毫秒）
    fadeOutDuration?: number; // 音频淡出时长（毫秒）
    seekStart?: number; // 裁剪开始时间点（毫秒），默认0
    seekEnd?: number; // 裁剪结束时间点（毫秒）
    loop?: boolean; // 是否强制循环
    volume?: number; // 音频音量（0-100），默认100
    autoplay?: boolean; // 是否自动播放
    hardwareAcceleration?: string; // 解码器硬件加速方法提示
    muted?: boolean; // 是否静音
    retryFetchs?: number; // 重试下载次数，默认2
    ignoreCache?: boolean; // 是否忽略本地缓存，默认false
}

// 解码器创建选项
interface IDecoderOptions {
    isMask?: boolean; // 是否为蒙版
    onFrame?: (frame: TVideoFrame) => void; // 视频帧回调
    onError?: (err: Error) => void; // 错误回调
}

// 视频画布
export default class VideoCanvas {

    public url: string; // 视频URL
    public maskUrl: string; // 蒙版视频URL
    public format: string; // 视频格式
    public startTime: number; // 开始播放时间点（毫秒）
    public endTime: number; // 结束播放时间（毫秒）
    public audioId: number; // 内部音频ID
    public seekStart: number; // 裁剪开始时间点（毫秒）
    public seekEnd: number; // 裁剪结束时间点（毫秒）
    public fadeInDuration: number; // 视频音频淡入时长（毫秒）
    public fadeOutDuration: number; // 视频音频淡出时长（毫秒）
    public loop: boolean; // 是否强制循环
    public volume: number; // 视频音频音量
    public autoplay: boolean; // 是否自动播放
    public hardwareAcceleration: string; // 解码器硬件加速方法提示
    public muted: boolean; // 是否静音
    public retryFetchs: number; // 重试下载次数
    public ignoreCache: boolean; // 是否忽略本地缓存
    public config: IMP4DemuxConfig; // 视频信息配置对象
    public buffer: Uint8Array = null; // 视频数据
    public maskBuffer: Uint8Array = null; // 蒙版视频数据
    public frameIndex: number = null; // 帧索引
    public decodedFrameIndex: number = 0; // 已解码帧索引
    public decodedMaskFrameIndex: number = 0; // 已解码蒙版帧索引
    public currentTime: number = 0; // 当前播放时间点（毫秒）
    public frames: TVideoFrame[] = []; // 已解码视频帧队列
    public maskFrames: TVideoFrame[] = []; // 已解码蒙版视频帧队列
    public canvas: HTMLCanvasElement = null; // 画布元素
    public canvasCtx: CanvasRenderingContext2D = null; // 画布2D渲染上下文
    public offscreenCanvas: OffscreenCanvas; // 离屏画布对象
    public offscreenCanvasCtx: OffscreenCanvasRenderingContext2D; // 离屏2D画布渲染上下文
    public offsetTime: number = 0; // 偏移时间量
    public removed: boolean = false; // 是否被移除
    public destoryed: boolean = false; // 是否已销毁
    public decoder: VideoDecoder = null; // 视频解码器（VideoDecoder）
    public maskDecoder: VideoDecoder = null; // 蒙版视频解码器（VideoDecoder）
    public waitFrameIndex: number = null; // 等待视频帧下标
    public waitMaskFrameIndex: number = null; // 等待蒙版视频帧下标
    public waitFrameCallback: () => void = null; // 等待视频帧回调
    public waitMaskFrameCallback: () => void = null; // 等待蒙版视频帧回调

    // 构造函数
    constructor(options: IVideoCanvasOptions) {
        const u = ____util;
        u.assert(u.isObject(options), "VideoCanvas options must be Object");
        const {
            url,
            maskUrl,
            startTime,
            endTime,
            audioId,
            format,
            seekStart,
            seekEnd,
            fadeInDuration,
            fadeOutDuration,
            autoplay,
            volume,
            loop,
            muted,
            hardwareAcceleration,
            retryFetchs,
            ignoreCache
        } = options;
        u.assert(u.isString(url), "url must be string");
        u.assert(u.isNumber(startTime), "startTime must be number");
        u.assert(u.isNumber(endTime), "endTime must be number");
        u.assert(u.isNumber(audioId), "audioId must be number");
        u.assert(u.isUndefined(maskUrl) || u.isString(maskUrl), "maskUrl must be string");
        u.assert(u.isUndefined(format) || u.isString(format), "format must be string");
        u.assert(u.isUndefined(seekStart) || u.isNumber(seekStart), "seekStart must be number");
        u.assert(u.isUndefined(seekEnd) || u.isNumber(seekEnd), "seekEnd must be number");
        u.assert(u.isUndefined(fadeInDuration) || u.isNumber(fadeInDuration), "fadeInDuration must be number");
        u.assert(u.isUndefined(fadeOutDuration) || u.isNumber(fadeOutDuration), "fadeOutDuration must be number");
        u.assert(u.isUndefined(autoplay) || u.isBoolean(autoplay), "autoplay must be boolean");
        u.assert(u.isUndefined(volume) || u.isNumber(volume), "volume must be number");
        u.assert(u.isUndefined(loop) || u.isBoolean(loop), "loop must be boolean");
        u.assert(u.isUndefined(muted) || u.isBoolean(muted), "muted must be boolean");
        u.assert(u.isUndefined(hardwareAcceleration) || u.isString(hardwareAcceleration), "hardwareAcceleration must be string");
        u.assert(u.isUndefined(retryFetchs) || u.isNumber(retryFetchs), "retryFetchs must be number");
        u.assert(u.isUndefined(ignoreCache) || u.isBoolean(ignoreCache), "ignoreCache must be boolean");
        this.url = url;
        this.maskUrl = maskUrl;
        this.startTime = startTime;
        this.endTime = endTime;
        this.audioId = audioId;
        this.format = format;
        this.seekStart = u.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.autoplay = autoplay;
        this.volume = u.defaultTo(volume, 100);
        this.loop = u.defaultTo(loop, false);
        this.muted = u.defaultTo(muted, false);
        this.hardwareAcceleration = u.defaultTo(hardwareAcceleration, "prefer-hardware");
        this.retryFetchs = u.defaultTo(retryFetchs, 2);
        this.ignoreCache = u.defaultTo(ignoreCache, false);
    }

    // 绑定画布元素
    public bind(canvas: HTMLCanvasElement, options: ICanvasOptions = {}): void {
        const {alpha = true, imageSmoothingEnabled = true, imageSmoothingQuality = "high"} = options;
        this.canvas = canvas;
        this.canvas.____onRemoved = (): void => {
            void ____updateAudioEndTime(this.audioId, captureCtx.currentTime);
            this.removed = true;
        };
        // 获取画布2D上下文
        this.canvasCtx = this.canvas.getContext("2d", {
            // 是否透明通道
            alpha,
            // 设置抗锯齿开关
            imageSmoothingEnabled,
            // 设置抗锯齿强度
            imageSmoothingQuality
        }) as CanvasRenderingContext2D;
    }

    public canPlay(time: number): boolean {
        if (this.destoryed) return;
        const {startTime, endTime} = this;
        // 如果当前时间超过元素开始结束时间则判定未不可播放
        if (time < startTime || time >= endTime)
            return false;
        return true;
    }

    // 加载视频
    public async load(): Promise<boolean> {
        try {
            const datas = await this._fetchData();
            if (!datas) {
                this.destory();
                return false;
            }
            const {buffer, maskBuffer} = datas;
            const {decoder, config} = await this._createDecoder(buffer, {
                onFrame: this._emitNewFrame.bind(this),
                onError: (err: Error): void => console.error(err)
            });
            // 预分配视频帧数组
            this.frames = new Array(config.frameCount);
            this.decoder = decoder;
            this.config = config;
            if (maskBuffer) {
                // 预分配蒙版视频帧数组
                this.maskFrames = new Array(config.frameCount);
                // 初始化用于蒙版抠图的离屏画布
                this._initOffscreenCanvas();
                const {
                    decoder: maskDecoder,
                    config: maskConfig
                } = await this._createDecoder(maskBuffer, {
                    isMask: true,
                    onFrame: this._emitNewMaskFrame.bind(this),
                    onError: (err: Error): void => console.error(err)
                });
                this.maskDecoder = maskDecoder;
                const u = ____util;
                u.assert(maskConfig.codedWidth == config.codedWidth, `Mask video codedWidth (${maskConfig.codedWidth}) is inconsistent with the original video codedWidth (${config.codedWidth})`);
                u.assert(maskConfig.codedHeight == config.codedHeight, `Mask video codedHeight (${maskConfig.codedHeight}) is inconsistent with the original video codedHeight (${config.codedHeight})`);
                u.assert(maskConfig.frameCount == config.frameCount, `Mask video frameCount (${maskConfig.frameCount}) is inconsistent with the original video frameCount (${config.frameCount})`);
                u.assert(maskConfig.fps == config.fps, `Mask video fps (${maskConfig.fps}) is inconsistent with the original video fps (${config.fps})`);
            }
            if (this.config.duration <= 0) {
                this.destory();
                return false;
            }
            return true;
        } catch (err) {
            console.error(err);
            this.destory();
            return false;
        }
    }

    public isReady(): boolean {
        return this.decoder && this.decoder.state == "configured";
    }

    public async seek(time: number): Promise<void> {
        // 已销毁不可索引
        if (this.destoryed) return;
        // 计算当前帧的下标
        const frameIndex = Math.floor(time / this.config.frameInterval);
        // 如果当前时间点帧下标和上次一样不做处理
        if (this.frameIndex === frameIndex)
            return;
        // 如果元素被移除播放已结束或画布则跳过
        if (this.removed || (!this.loop && this.isEnd()) || frameIndex >= this.config.frameCount)
            return;
        // console.log(`${frameIndex}/${this.decoder.decodeQueueSize}/${this.config.frameCount}`);
        const frame = await this._acquireFrame(frameIndex);
        // console.log(frameIndex);
        let maskFrame = null;
        if (this.maskBuffer)
            maskFrame = await this._acquireMaskFrame(frameIndex);
        const {displayWidth, displayHeight} = frame;
        if (maskFrame) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.offscreenCanvasCtx.drawImage(maskFrame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
            const maskData = this.offscreenCanvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height)
            for (let i = 0; i < maskData.data.length; i += 4)
                maskData.data[i + 3] = maskData.data[i];
            this.offscreenCanvasCtx.putImageData(maskData, 0, 0);
            this.canvasCtx.drawImage(this.offscreenCanvas, 0, 0);
            this.canvasCtx.globalCompositeOperation = 'source-in';
            this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
            this.canvasCtx.globalCompositeOperation = 'source-over';
        } else
            this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);

        frame.close();
        this.frames[frameIndex] = null;
        if (maskFrame) {
            maskFrame.close();
            this.maskFrames[frameIndex] = null;
        }
        // 更新帧下标
        this.frameIndex = frameIndex;
        // 更新当前时间点
        this.currentTime = time;
        // 如开启循环且当前已播放结束时重置
        if (this.loop && (this.isEnd() || this.currentTime >= this.config.duration)) {
            this.offsetTime += this.currentTime;
            this.reset();
        }
    }

    public isEnd(): boolean {
        return this.frameIndex >= this.config.frameCount - 1;
    }

    public canDestory(time: number): boolean {
        // 已销毁则避免重复销毁
        if (this.destoryed) return false;
        // 返回当前时间是否大于结束实际
        return time >= this.endTime;
    }

    public reset(): void {
        // 清除未关闭的视频帧避免内存泄露
        this._clearUnclosedFrames();
        this._clearUnclosedMaskFrames();
        this.frameIndex = null;
        this.currentTime = 0;
        this.decodedFrameIndex = 0;
        this.decodedMaskFrameIndex = 0;
        // 重置解码器
        this.decoder && this.decoder.reset();
        // 重置蒙版解码器
        this.maskDecoder && this.maskDecoder.reset();
    }

    // 销毁资源
    public destory(): void {
        this.decoder && this.decoder.close();
        this.decoder = null;
        this.maskDecoder && this.maskDecoder.close();
        this.maskDecoder = null;
        this._clearUnclosedFrames();
        this._clearUnclosedMaskFrames();
        this.buffer = null;
        this.maskBuffer = null;
        this.frameIndex = null;
        this.currentTime = 0;
        if (this.canvas)
            this.canvas.style.display = "none";
        this.canvas = null;
        this.canvasCtx = null;
        this.offscreenCanvas = null;
        this.offscreenCanvasCtx = null;
        this.destoryed = true;
    }

    // 拉取视频数据
    protected async _fetchData(): Promise<{
        buffer: Uint8Array<ArrayBufferLike>;
        maskBuffer: Uint8Array<ArrayBufferLike>;
    }> {
        if (!this.buffer) {
            // 当页面url未定义时采用localhost代替
            const base = (window.location as unknown as { url?: string }).url ? "" : "http://localhost";
            const response = await captureCtx.fetch(base + "/api/video_preprocess", {
                method: "POST",
                body: JSON.stringify(this._exportConfig()),
                retryFetchs: 0
            });
            if (!response)
                return null;
            const packedData = await this._fetchPackedData(base, response);
            if (!packedData)
                return null;
            const {
                buffer,
                maskBuffer,
                hasMask
            } = this._unpackData(packedData);
            this.buffer = buffer;
            if (hasMask)
                this.maskBuffer = maskBuffer;
        }
        return {
            buffer: this.buffer,
            maskBuffer: this.maskBuffer
        }
    }

    // 拉取完整打包数据，响应为分片清单时按清单逐片拉取后拼接（见Page预处理分片传输）
    protected async _fetchPackedData(base: string, response: Response): Promise<ArrayBuffer | null> {
        if (!response.headers.get("X-WVC-Chunked"))
            return await response.arrayBuffer();
        const manifest: IPreprocessChunkManifest = JSON.parse(await response.text());
        const data = new Uint8Array(manifest.size);
        for (let i = 0; i < manifest.chunks; i++) {
            const start = i * manifest.chunkSize;
            const end = Math.min(start + manifest.chunkSize, manifest.size);
            const chunkResponse = await captureCtx.fetch(`${base}/api/video_preprocess_chunk?id=${manifest.id}&start=${start}&end=${end}`, {
                retryFetchs: 2
            });
            if (!chunkResponse)
                return null;
            data.set(new Uint8Array(await chunkResponse.arrayBuffer()), start);
        }
        return data.buffer;
    }

    // 清除未关闭的帧
    protected _clearUnclosedFrames(): void {
        this.frames
            .forEach((frame: TVideoFrame, index: number): void => {
                if (!frame)
                    return;
                frame.close();
                this.frames[index] = null;
            });
        this.frames = [];
    }

    // 清除未关闭的蒙版帧
    protected _clearUnclosedMaskFrames(): void {
        this.maskFrames
            .forEach((maskFrame: TVideoFrame, index: number): void => {
                if (!maskFrame)
                    return;
                maskFrame.close();
                this.maskFrames[index] = null;
            });
        this.maskFrames = [];
    }

    // 初始化离屏画布
    protected _initOffscreenCanvas(options: ICanvasOptions = {}): void {
        const {alpha = true, imageSmoothingEnabled = true, imageSmoothingQuality = "high"} = options;
        // 创建实验性的离屏画布
        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        // 获取2D渲染上下文
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d", {
            alpha,
            willReadFrequently: false
        }) as OffscreenCanvasRenderingContext2D;
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
        this.canvasCtx.imageSmoothingQuality = imageSmoothingQuality;
    }

    // 获取视频帧
    protected async _acquireFrame(frameIndex: number): Promise<any> {
        if (this.frames[frameIndex])
            return this.frames[frameIndex];
        let timer: number;
        await Promise.race([
            new Promise<void>((resolve): void => {
                this._clearUnclosedFrames();
                this.waitFrameIndex = frameIndex;
                this.waitFrameCallback = (): void => resolve();
            }),
            new Promise<never>((_, reject): number => timer = ____setTimeout((): void => reject(new Error(`Acquire video frame ${frameIndex} timeout (30s)`)), 30000))
        ]);
        ____clearTimeout(timer);
        return this.frames[frameIndex];
    }

    // 获取蒙版视频帧
    protected async _acquireMaskFrame(frameIndex: number): Promise<any> {
        if (this.maskFrames[frameIndex])
            return this.maskFrames[frameIndex];
        let timer: number;
        await Promise.race([
            new Promise<void>((resolve): void => {
                this._clearUnclosedMaskFrames();
                this.waitMaskFrameIndex = frameIndex;
                this.waitMaskFrameCallback = (): void => resolve();
            }),
            new Promise<never>((_, reject): number => timer = ____setTimeout((): void => reject(new Error(`Acquire mask video frame ${frameIndex} timeout (30s)`)), 30000))
        ]);
        ____clearTimeout(timer);
        return this.maskFrames[frameIndex];
    }

    // 通知新视频帧产生
    protected _emitNewFrame(frame: TVideoFrame): void {
        frame.index = this.decodedFrameIndex;
        this.frames[frame.index] = frame;
        if (this.waitFrameCallback && this.waitFrameIndex == frame.index) {
            const fn = this.waitFrameCallback;
            this.waitFrameIndex = null;
            this.waitFrameCallback = null;
            fn();
        } else if (frame.index < this.waitFrameIndex)
            frame.close();
        this.decodedFrameIndex++;
    }

    // 通知新蒙版视频帧产生
    protected _emitNewMaskFrame(frame: TVideoFrame): void {
        frame.index = this.decodedMaskFrameIndex;
        this.maskFrames[frame.index] = frame;
        if (this.waitMaskFrameCallback && this.waitMaskFrameIndex == frame.index) {
            const fn = this.waitMaskFrameCallback;
            this.waitMaskFrameIndex = null;
            this.waitMaskFrameCallback = null;
            fn();
        } else if (frame.index < this.waitMaskFrameIndex)
            frame.close();
        this.decodedMaskFrameIndex++;
    }

    // 创建解码器
    protected async _createDecoder(data: Uint8Array, options: IDecoderOptions = {}): Promise<{
        config: IMP4DemuxConfig;
        decoder: any;
    }> {
        const u = ____util;
        const {isMask = false, onFrame, onError} = options;
        u.assert(u.isUint8Array(data), "data must be Uint8Array");
        u.assert(u.isBoolean(isMask), "isMask must be boolean");
        u.assert(u.isFunction(onFrame), "onFrame must be Function");
        u.assert(u.isFunction(onError), "onError must be Function");
        const decoder = (isMask ? this.maskDecoder : this.decoder) || new VideoDecoder({
            output: onFrame.bind(this),
            error: (err: unknown): void => onError.bind(this)(new Error(String(err)))
        });
        const demuxer = new MP4Demuxer();
        let timer: number;
        const waitConfigPromise = Promise.race([
            new Promise<IMP4DemuxConfig>((resolve, reject): void => {
                demuxer.onConfig((config: IMP4DemuxConfig): void => {
                    decoder.configure({
                        // 视频信息配置
                        ...config,
                        // 解码器硬件加速指示（运行时取值域为 HardwareAcceleration 枚举）
                        hardwareAcceleration: this.hardwareAcceleration as HardwareAcceleration,
                        // 关闭延迟优化，让解码器批量处理解码，降低负载
                        optimizeForLatency: true
                    });
                    resolve(config);
                });
                demuxer.onError(reject);
            }),
            new Promise<never>((_, reject): number => timer = ____setTimeout((): void => reject(new Error(`Video buffer demux timeout (60s)`)), 60000))
        ]);
        ____clearTimeout(timer);
        demuxer.onChunk((chunk: EncodedVideoChunk): void => decoder.decode(chunk));
        demuxer.load(data);
        // 等待解码配置
        const config: IMP4DemuxConfig = await waitConfigPromise;
        // 画布宽度为0时使用解码宽度初始化
        if (this.canvas.width === 0)
            this.canvas.width = config.codedWidth;
        // 画布高度为0时使用解码高度初始化
        if (this.canvas.height === 0)
            this.canvas.height = config.codedHeight;
        // 检查视频解码器是否支持当前配置
        await VideoDecoder.isConfigSupported(config);
        if (decoder.state == "configured") {
            decoder.flush()
                .catch((err: Error): void | 0 => err.message.indexOf("Aborted due to close") === -1 && err.message.indexOf("closed codec") === -1 ? console.error(err) : 0);
        }
        return {
            config,
            decoder
        };
    }

    // 导出视频配置
    protected _exportConfig(): IVideoCanvasOptions {
        return {
            url: this.url,
            maskUrl: this.maskUrl,
            format: this.format,
            startTime: this.startTime,
            endTime: this.endTime,
            audioId: this.audioId,
            seekStart: this.seekStart,
            seekEnd: this.seekEnd,
            fadeInDuration: this.fadeInDuration,
            fadeOutDuration: this.fadeOutDuration,
            autoplay: this.autoplay,
            volume: this.volume,
            loop: this.loop,
            muted: this.muted,
            retryFetchs: this.retryFetchs,
            ignoreCache: this.ignoreCache
        };
    }

    // 解包数据
    // 从封装的ArrayBuffer中提取原始数据对象
    protected _unpackData(packedData: ArrayBuffer): { buffer: Uint8Array; maskBuffer: Uint8Array; hasMask: boolean } {
        const dataView = new DataView(packedData);
        let delimiterIndex = -1;
        for (let i = 0; i < dataView.byteLength; i++) {
            if (dataView.getUint8(i) === '!'.charCodeAt(0)) {
                delimiterIndex = i;
                break;
            }
        }
        if (delimiterIndex === -1)
            throw new Error("Invalid data format: header delimiter not found");
        const lengthBytes = new Uint8Array(dataView.buffer, 0, delimiterIndex);
        const objLength = parseInt(String.fromCharCode(...lengthBytes));
        if (isNaN(objLength) || objLength <= 0 || objLength > dataView.byteLength - delimiterIndex - 1)
            throw new Error("Invalid data format: Invalid data length");
        const objBytes = new Uint8Array(dataView.buffer, delimiterIndex + 1, objLength);
        const obj = JSON.parse(new TextDecoder("utf-8").decode(objBytes));
        const bufferOffset = delimiterIndex + 1 + objLength;
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key][0] === "buffer") {
                const [_, start, end] = obj[key];
                obj[key] = new Uint8Array(dataView.buffer.slice(bufferOffset + start, bufferOffset + end));
            }
        }
        return obj;
    }

}
