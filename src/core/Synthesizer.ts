import path from "path";
import crypto from "crypto";
import assert from "assert";
import {EventEmitter} from "eventemitter3";
import fs from "fs-extra";
import {PassThrough} from "stream";
import ffmpeg from "fluent-ffmpeg";
import pc from "picocolors";
import cliProgress from "cli-progress";
import _ from "lodash";

import {
    AUDIO_ENCODER_MAP,
    FORMAT_AUDIO_ENCODER_MAP,
    FORMAT_VIDEO_ENCODER_MAP,
    SUPPORT_FORMAT,
    VIDEO_ENCODER_MAP
} from "../lib/const";
import globalConfig from "../lib/global-config";
import Audio, {type IAudioOptions} from "../entity/Audio";
import logger from "../lib/logger";
import util from "../lib/util";
import {resolveFfmpegPath, resolveFfprobePath} from "../lib/ffmpeg-path";

ffmpeg.setFfmpegPath(resolveFfmpegPath());
ffmpeg.setFfprobePath(resolveFfprobePath());

// fluent-ffmpeg 命令实例
export type TFfmpegCommand = ReturnType<typeof ffmpeg>;

// cli 进度条（MultiBar.create 会替换为 GenericBar 实例）
type TCliProgress = (cliProgress.SingleBar | cliProgress.MultiBar | cliProgress.GenericBar) & { started?: boolean };

// 支持alpha通道的视频编码器（webm的alpha经容器BlockAdditional承载，仅libvpx系编码器支持，其余编码器会静默丢弃透明通道）
const ALPHA_VIDEO_ENCODERS: string[] = ["libvpx", "libvpx-vp9"];

// 带alpha的像素格式命名（yuva*/rgba*/ya8等），用于校验显式指定的pixelFormat
const ALPHA_PIXEL_FORMATS = /^(yuva|rgba|argb|abgr|bgra|gbrap|ya(8|16))/;

// 合成完成结果
export interface IRenderResult {
    duration: number; // 输出视频时长（毫秒）
    takes: number; // 合成耗时（毫秒）
    outputPath: string; // 输出路径
    rtf: number; // 实时率（输出时长/合成耗时）
}

// 序列帧合成器选项
export interface ISynthesizerOptions {
    outputPath?: string; // 导出视频路径
    width?: number; // 视频宽度
    height?: number; // 视频高度
    duration?: number; // 视频时长
    fps?: number; // 视频合成帧率
    format?: string; // 导出视频格式（mp4/webm）
    attachCoverPath?: string; // 附加到视频首帧的封面路径
    coverCapture?: boolean; // 是否捕获封面并输出
    coverCaptureTime?: number; // 封面捕获时间点（毫秒）
    coverCaptureFormat?: string; // 封面捕获格式（jpg/png/bmp）
    coverCaptureQuality?: number; // 封面捕获JPG质量（0-100，仅jpg格式生效）
    videoEncoder?: string; // 视频编码器
    videoQuality?: number; // 视频质量（0-100）
    videoBitrate?: string; // 视频码率（设置码率将忽略videoQuality）
    pixelFormat?: string; // 像素格式（yuv420p/yuv444p/rgb24）
    audioEncoder?: string; // 音频编码器
    audioBitrate?: string; // 音频码率
    volume?: number; // 视频音量（0-100）
    parallelWriteFrames?: number; // 并行写入帧数
    backgroundOpacity?: number; // 背景不透明度（0-1），仅webm格式支持
    showProgress?: boolean; // 是否在命令行展示进度
    // 其余透传字段
    [key: string]: unknown;
}

// 序列帧合成器
export default class Synthesizer extends EventEmitter {

    // 合成器状态枚举
    public static STATE = {
        READY: Symbol("READY"), // 已就绪
        SYNTHESIZING: Symbol("SYNTHESIZING"), // 合成中
        COMPLETED: Symbol("COMPLETED") // 已完成
    };

    // 合成器ID
    public id: string = `video_${crypto.randomUUID()}`;
    public state: symbol = Synthesizer.STATE.READY; // 合成器状态
    // 合成进度
    public progress: number = 0;
    public name: string = null; // 合成对象名称
    public outputPath: string; // 导出视频路径
    public fps: number; // 视频合成帧率
    public width: number; // 视频宽度
    public height: number; // 视频高度
    public duration: number; // 视频时长
    public format: string; // 视频格式（mp4/webm）
    public attachCoverPath: string; // 附加到视频首帧的封面路径
    public coverCapture: boolean; // 是否捕获封面并输出
    public coverCaptureTime: number; // 封面捕获时间点（毫秒）
    public coverCaptureFormat: string; // 封面捕获格式（jpg/png/bmp）
    public coverCaptureQuality: number; // 封面捕获JPG质量（0-100，仅jpg格式生效）
    public videoEncoder: string; // 视频编码器
    public videoQuality: number; // 视频质量（0-100）
    public videoBitrate: string; // 视频码率（如8M，设置码率将忽略videoQuality）
    public pixelFormat: string; // 像素格式（yuv420p/yuv444p/rgb24）
    public audioEncoder: string; // 音频编码器（aac/ogg）
    public audioBitrate: string; // 音频码率
    public volume: number; // 视频音量（0-100）
    public parallelWriteFrames: number; // 并行写入帧数
    public backgroundOpacity: number; // 背景不透明度（0-1）仅webm格式支持
    public showProgress: boolean; // 是否在命令行展示进度
    public audios: Audio[] = []; // 音频列表
    // 临时路径
    public tmpDirPath: string = path.resolve("tmp/synthesizer/");
    protected _startupTime: number = null; // 启动时间点
    protected _swapFilePath: string; // 交换文件路径
    // 帧计数
    protected _frameCount: number = 0;
    protected _cliProgress: TCliProgress = null; // cli进度
    // 目标帧数
    protected _targetFrameCount: number = 0;
    private frameBuffers: Buffer[] = null; // 帧缓冲区列表
    // 帧缓冲区指针
    private frameBufferIndex: number = 0;
    private pipeStream: PassThrough = null; // 帧写入管道流
    private encoder: TFfmpegCommand = null; // 当前编码器

    // 构造函数
    constructor(options: ISynthesizerOptions) {
        super();
        assert(_.isObject(options), "Synthesizer options must be object");
        const {
            width, height, fps, duration, format, outputPath,
            attachCoverPath, coverCapture, coverCaptureTime, coverCaptureFormat, coverCaptureQuality,
            videoEncoder, videoQuality, videoBitrate, pixelFormat, audioEncoder,
            audioBitrate, volume, parallelWriteFrames, backgroundOpacity, showProgress
        } = options;
        assert(_.isFinite(width) && width % 2 === 0, "width must be even number");
        assert(_.isFinite(height) && height % 2 === 0, "height must be even number");
        assert(_.isFinite(duration), "synthesis duration must be number");
        assert(_.isString(outputPath) || this._isVideoChunk(), "outputPath must be string");
        assert(_.isUndefined(fps) || _.isFinite(fps), "synthesis fps must be number");
        assert(_.isUndefined(format) || SUPPORT_FORMAT.includes(format), `format ${format} is not supported`);
        assert(_.isUndefined(attachCoverPath) || _.isString(attachCoverPath), "attachCoverPath must be string");
        assert(_.isUndefined(coverCapture) || _.isBoolean(coverCapture), "coverCapture must be boolean");
        assert(_.isUndefined(coverCaptureTime) || _.isFinite(coverCaptureTime), "coverCaptureTime must be number");
        assert(_.isUndefined(coverCaptureFormat) || _.isString(coverCaptureFormat), "coverCaptureFormat must be string");
        assert(_.isUndefined(coverCaptureQuality) || (_.isFinite(coverCaptureQuality) && coverCaptureQuality >= 0 && coverCaptureQuality <= 100), "coverCaptureQuality must be number between 0 and 100");
        assert(_.isUndefined(videoEncoder) || _.isString(videoEncoder), "videoEncoder must be string");
        assert(_.isUndefined(videoQuality) || _.isFinite(videoQuality), "videoQuality must be number");
        assert(_.isUndefined(videoBitrate) || _.isString(videoBitrate), "videoBitrate must be string");
        assert(_.isUndefined(pixelFormat) || _.isString(pixelFormat), "pixelFormat must be string");
        assert(_.isUndefined(audioEncoder) || _.isString(audioEncoder), "audioEncoder must be string");
        assert(_.isUndefined(audioBitrate) || _.isString(audioBitrate), "audioBitrate must be string");
        assert(_.isUndefined(volume) || _.isFinite(volume), "volume must be number");
        assert(_.isUndefined(parallelWriteFrames) || _.isFinite(parallelWriteFrames), "parallelWriteFrames must be number");
        assert(_.isUndefined(backgroundOpacity) || _.isFinite(backgroundOpacity), "backgroundOpacity must be number");
        assert(_.isUndefined(showProgress) || _.isBoolean(showProgress), "showProgress must be boolean")
        if (!format && outputPath && !this._isVideoChunk()) {
            const _format = path.extname(outputPath).substring(1);
            if (!_format)
                throw new Error(`Unable to recognize output video format: ${outputPath}`);
            if (!SUPPORT_FORMAT.includes(_format))
                throw new Error(`Unsupported output video format: ${_format}`);
            this.format = _format;
        } else if (format)
            this.format = format;
        else
            this.format = SUPPORT_FORMAT[0];
        this.width = width;
        this.height = height;
        this.fps = _.defaultTo(fps, 30);
        this.duration = duration;
        this.outputPath = _.isString(outputPath) ? path.resolve(outputPath) : outputPath;
        this.name = this.outputPath ? path.basename(this.outputPath) : null;
        this.attachCoverPath = _.isString(attachCoverPath) ? path.resolve(attachCoverPath) : attachCoverPath;
        this.coverCapture = _.defaultTo(coverCapture, false);
        this.coverCaptureTime = coverCaptureTime;
        this.coverCaptureFormat = _.defaultTo(coverCaptureFormat, "jpg");
        this.coverCaptureQuality = coverCaptureQuality;
        this.backgroundOpacity = _.defaultTo(backgroundOpacity, 1);
        this.videoEncoder = _.defaultTo(videoEncoder, _.defaultTo(this.format == "webm" ? globalConfig.webmEncoder : globalConfig.mp4Encoder, FORMAT_VIDEO_ENCODER_MAP[this.format][0] || "libx264"));
        // 透明通道需要编码器与像素格式共同承载alpha，否则被静默丢弃（上游 issues/34）：
        // 显式指定不支持alpha的编码器/像素格式时快速失败；仅全局默认不支持时回退libvpx-vp9并告警
        if (this.hasAlphaChannel) {
            if (!ALPHA_VIDEO_ENCODERS.includes(this.videoEncoder)) {
                if (_.isString(videoEncoder))
                    throw new Error(`videoEncoder ${this.videoEncoder} cannot carry the alpha channel required by backgroundOpacity < 1, use libvpx-vp9`);
                logger.warn(`videoEncoder ${this.videoEncoder} cannot carry the alpha channel, fallback to libvpx-vp9`);
                this.videoEncoder = "libvpx-vp9";
            }
            if (_.isString(pixelFormat) && !ALPHA_PIXEL_FORMATS.test(pixelFormat))
                throw new Error(`pixelFormat ${pixelFormat} cannot carry the alpha channel required by backgroundOpacity < 1, use yuva420p`);
        }
        this.videoQuality = _.defaultTo(videoQuality, 100);
        this.videoBitrate = videoBitrate;
        this.audioEncoder = _.defaultTo(audioEncoder, _.defaultTo(globalConfig.audioEncoder, FORMAT_AUDIO_ENCODER_MAP[this.format][0] || "aac"));
        this.audioBitrate = audioBitrate;
        this.volume = _.defaultTo(volume, 100);
        this.parallelWriteFrames = _.defaultTo(parallelWriteFrames, 10);
        this.pixelFormat = _.defaultTo(pixelFormat, this.hasAlphaChannel ? "yuva420p" : "yuv420p");
        this.showProgress = _.defaultTo(showProgress, false);
        this.frameBuffers = new Array(this.parallelWriteFrames);
        this._swapFilePath = path.join(this.tmpDirPath, `video_${crypto.randomUUID()}.${this.format}`);
        this._targetFrameCount = util.durationToFrameCount(this.duration, this.fps);
        if (this.showProgress) {
            this._cliProgress = new cliProgress.SingleBar({
                hideCursor: true,
                format: `[${pc.green("{bar}")}] {percentage}% | {value}/{total} | {eta_formatted} | {filename}`,
            }, cliProgress.Presets.shades_grey);
        }
    }

    // 启动合成
    public start(): void {
        if (!this.pipeStream)
            this.pipeStream = this.createPipeStream();
        // 捕获管道流引用，避免同步输入并 endInput 时 drain 提前置空导致编码器取到 null
        const pipeStream = this.pipeStream;
        assert(this.isReady(), "Synthesizer status is not READY, please reset the synthesizer: synthesizer.reset()");
        this.setState(Synthesizer.STATE.SYNTHESIZING);
        this._startupTime = _.defaultTo(this._startupTime, performance.now());
        this._targetFrameCount = util.durationToFrameCount(this.duration, this.fps);
        (async (): Promise<void> => {
            await fs.ensureDir(path.dirname(this.outputPath));
            await fs.ensureDir(this.tmpDirPath);
            // 等待启动前已添加的音频加载完成
            await this.waitForAudiosLoaded();
            await new Promise((resolve, reject): void => {
                this._createVideoEncoder(pipeStream)
                    .once("start", (cmd): void => util.ffmpegLog(cmd))
                    .on("progress", (e): void => {
                        if (!this._targetFrameCount)
                            return this._emitProgress(0);
                        const progres = e.frames / this._targetFrameCount;
                        this._emitProgress(progres * (this.audioSynthesis ? 98 : 100));
                    })
                    .once("error", reject)
                    .once("end", resolve)
                    .run();
            });
            if (!this._isVideoChunk()) {
                if (this.audioSynthesis) {
                    // 等待渲染期间新添加的音频加载完成
                    await this.waitForAudiosLoaded();
                    await new Promise((resolve, reject): void => {
                        this._createAudioEncoder()
                            .once("start", (cmd): void => util.ffmpegLog(cmd))
                            .on("progress", (e): void => this._emitProgress(98 + ((e.percent || 0) * 0.02)))
                            .once("error", reject)
                            .once("end", resolve)
                            .run();
                    });
                    await fs.remove(this._swapFilePath);
                } else
                    await fs.move(this._swapFilePath, this.outputPath, {overwrite: true});
            }
            this.coverCapture && await this.captureCover();
            this.setState(Synthesizer.STATE.COMPLETED);
            this._emitCompleted();
        })()
            .catch((err): void => this._emitError(err));
    }

    // 终止合成
    public abort(): void {
        this.drain();
        this.closeEncoder(true);
    }

    // 输入帧
    public input(buffer: Buffer): Promise<void> | void {
        if (!this.pipeStream)
            this.pipeStream = this.createPipeStream();
        this.frameBuffers[this.frameBufferIndex] = buffer;
        this._frameCount++;
        if (++this.frameBufferIndex < this.parallelWriteFrames)
            return;
        const stream = this.pipeStream;
        const writable = stream.write(Buffer.concat(this.frameBuffers));
        this.frameBufferIndex = 0;
        if (!writable) {
            return new Promise((resolve): void => {
                const done = (): void => {
                    stream.off("drain", done);
                    stream.off("close", done);
                    resolve();
                };
                stream.once("drain", done);
                stream.once("close", done);
            });
        }
    }

    // 结束帧输入
    public endInput(): void {
        this.drain();
        this.closeEncoder();
    }

    // 创建帧写入管道流（附带错误监听，避免未处理的error事件崩溃进程）
    private createPipeStream(): PassThrough {
        const stream = new PassThrough();
        stream.on("error", (err): void => this._emitError(err));
        return stream;
    }

    // 等待音频加载完成
    private async waitForAudiosLoaded(): Promise<void> {
        await Promise.all(this.audios.map((audio): Promise<void> => audio.load()));
    }

    // 将缓冲区剩余帧写入管道
    private drain(): void {
        if (!this.pipeStream)
            return;
        if (this.frameBufferIndex > 0)
            this.pipeStream.write(Buffer.concat(this.frameBuffers.slice(0, this.frameBufferIndex)));
        this.frameBufferIndex = 0;
        if (!this.pipeStream.closed)
            this.pipeStream.end();
        this.pipeStream = null;
    }

    // 发送进度事件
    protected _emitProgress(value: number): void {
        if (value > 100)
            value = 100;
        this.progress = Math.floor(value * 1000) / 1000;
        if (this._cliProgress) {
            if (!this._cliProgress.started) {
                if (this._cliProgress instanceof cliProgress.MultiBar)
                    this._cliProgress = this._cliProgress.create(this._targetFrameCount, 0);
                else
                    this._cliProgress.start(this._targetFrameCount, 0);
                this._cliProgress.started = true;
            }
            this._cliProgress.update(this._frameCount, {filename: this.name});
        }
        this.emit("progress", this.progress, this._frameCount, this._targetFrameCount);
    }

    // 发送已完成事件
    protected _emitCompleted(): void {
        this._emitProgress(100);
        if (this._cliProgress) {
            this._cliProgress.stop();
            this._cliProgress = null;
        }
        const takes = performance.now() - this._startupTime;
        this._startupTime = null;
        const outputDuration = this.getOutputDuration();
        const result: IRenderResult = {
            takes,
            duration: outputDuration,
            outputPath: this.outputPath,
            rtf: outputDuration / takes
        };
        this.emit("completed", result);
    }

    // 发送错误事件
    protected _emitError(err: Error | string): void {
        if (_.isString(err))
            err = new Error(err);
        const message = err.message;
        // 3221225477为Windows访问违例(0xC0000005)，139为Linux/macOS段错误(128+SIGSEGV)
        if (message.indexOf("Error while opening encoder for output stream") != -1 || /ffmpeg exited with code (3221225477|139)\b/.test(message) || message.indexOf("SIGSEGV") != -1)
            err = new Error(`Video codec ${this.videoEncoder} may not be supported, please check if your hardware supports it: https://github.com/ayuanlmo/WebVideoCreatorNext/blob/master/docs/video-encoder.md. Some hardware encoders may have limitations in parallel encoding (such as NVENC https://github.com/keylase/nvidia-patch)`);
        if (this._cliProgress) {
            this._cliProgress.stop();
            this._cliProgress = null;
        }
        if (this.eventNames().includes("error"))
            this.emit("error", err);
        else
            logger.error(err);
    }

    // 添加音频
    public addAudio(audio: IAudioOptions | Audio): Audio {
        if (!(audio instanceof Audio))
            audio = new Audio(audio);
        // 开始加载音频
        audio.load()
            .catch((err): void => this._emitError(err));
        this.audios.push(audio);
        return audio;
    }

    // 添加多个音频
    public addAudios(audios: Array<IAudioOptions | Audio>): void {
        audios.forEach((audio): Audio => this.addAudio(audio));
    }

    // 更新音频
    public updateAudio(audioId: number, options?: Partial<IAudioOptions>): Audio {
        assert(_.isObject(options), "options must be Object");
        const audio = this.audios.find((audio): boolean => audio.id === audioId);
        audio && Object.assign(audio, options);
        return audio;
    }

    // 创建视频编码器
    protected _createVideoEncoder(pipeStream: PassThrough): TFfmpegCommand {
        const {
            outputPath, width, height, fps, format, videoEncoder, videoBitrate,
            videoQuality, pixelFormat, attachCoverPath, _swapFilePath
        } = this;
        const vencoder = ffmpeg();
        // 设置视频码率将忽略质量设置
        if (videoBitrate)
            vencoder.videoBitrate(videoBitrate);
        else {
            // 计算总像素量
            const pixels = width * height;
            // 根据像素总量设置视频码率
            vencoder.videoBitrate(`${(2560 / 921600 * pixels) * (videoQuality / 100)}k`);
        }
        const encodingType = this.getVideoEncodingType();
        if (encodingType == "H264" || encodingType == "H265") {
            // 使用主要配置
            vencoder.outputOption("-profile:v main");
            // 使用中等预设
            vencoder.outputOption("-preset medium");
        }
        vencoder.addInput(pipeStream);
        if (attachCoverPath) {
            // 附加封面
            vencoder.addInput(attachCoverPath);
            vencoder.complexFilter(`[1:v]scale=${width}:${height}[cover];[0:v][cover]overlay=repeatlast=0,scale=w=${width}:h=${height},format=${pixelFormat}`);
        } else {
            vencoder
                // 设置视频宽高
                .setSize(`${width}x${height}`)
                // 设置像素格式
                .outputOption("-pix_fmt", pixelFormat)
        }
        // 保持透明通道
        this.hasAlphaChannel && vencoder.outputOption("-auto-alt-ref 0");
        // 显式指定图像管道的输入解码器，与Page捕获帧格式保持一致（backgroundOpacity<1时为png，否则globalConfig.frameFormat）。
        // ffmpeg>=7的image2pipe经管道自动探测含ICC profile的Chrome截图JPEG时会失败（Video: none→输出无流→EINVAL），显式指定可绕过探测。
        const inputFrameFormat = this.backgroundOpacity < 1 ? "png" : _.defaultTo(globalConfig.frameFormat, "jpeg");
        const inputVideoCodec = inputFrameFormat == "png" ? "png" : "mjpeg";
        vencoder
            // 使用图像管道
            .inputFormat("image2pipe")
            // 指定输入帧率
            .inputFPS(fps)
            // 显式指定输入图像解码器
            .inputOption("-c:v", inputVideoCodec)
            // 去除冗余信息
            .inputOption("-hide_banner")
            // 指定视频编码器
            .videoCodec(videoEncoder);
        // 将MOOV头移到最前面（仅mp4格式支持）
        if (format == "mp4")
            vencoder.outputOption("-movflags +faststart");
        vencoder
            // 指定输出格式
            .toFormat(format)
            // 指定输出路径
            .output(this._isVideoChunk() ? outputPath : _swapFilePath);
        this.encoder = vencoder;
        return vencoder;
    }

    // 创建音频编码器
    protected _createAudioEncoder(): TFfmpegCommand {
        const {
            outputPath, _swapFilePath, format, audioEncoder,
            audioBitrate, volume: videoVolume, audios
        } = this;
        const aencoder = ffmpeg();
        // 指定音频码率
        audioBitrate && aencoder.audioBitrate(audioBitrate);
        const outputDuration = this.getOutputDuration();
        aencoder
            .addInput(_swapFilePath)
            .videoCodec("copy")
            .setDuration(outputDuration / 1000)
            .audioCodec(audioEncoder);
        // 将MOOV头移到最前面（仅mp4格式支持）
        if (format == "mp4")
            aencoder.outputOption("-movflags +faststart");
        aencoder
            .toFormat(format)
            .addOutput(outputPath);
        // 生成音频时间轴的复合过滤器参数
        let outputs = "";
        const complexFilter = audios.reduce((result, audio, index): string => {
            const {
                path,
                url,
                loop,
                startTime,
                endTime = outputDuration,
                duration,
                volume,
                seekStart,
                seekEnd,
                fadeInDuration,
                fadeOutDuration
            } = audio;
            if (seekEnd && seekEnd - seekStart > duration)
                return result;
            // 添加音频输入
            aencoder.addInput(path || url);
            // 设置裁剪开始时间点
            seekStart && aencoder.addInputOption("-ss", util.millisecondsToHmss(seekStart));  //截取开始时间点
            // 设置裁剪结束时间点
            seekEnd && aencoder.addInputOption("-to", util.millisecondsToHmss(seekEnd));  //截取结束时间点
            // 时长裁剪过滤器
            const cutFilter = `atrim=start=0:end=${(endTime - startTime) / 1000}`;
            // 循环过滤器
            const loopFilter = loop ? ",aloop=loop=-1:size=2e+09" : "";
            // 延迟过滤器
            const delayFilter = `,adelay=${startTime}|${startTime}`;
            // 音量过滤器
            const volumeFilter = `,volume=${Math.floor((volume * videoVolume) * 0.01) / 100}`;
            // 音频淡入过滤器
            const fadeInFilter = fadeInDuration ? `,afade=t=in:st=${startTime / 1000}:d=${fadeInDuration / 1000}` : "";
            // afade位于adelay之后按输出时间轴计时，淡出起点须取音频实际停止点（startTime+可用内容时长），
            // 直接与文件时长比较会在startTime>0时把淡出提前到错误位置（上游 issues/39）
            const contentLength = (seekEnd ? Math.min(seekEnd, duration) : duration) - seekStart;
            const playLength = loop ? endTime - startTime : Math.min(endTime - startTime, contentLength);
            // 音频淡出过滤器
            const fadeOutFilter = fadeOutDuration ? `,afade=t=out:st=${Math.max(0, startTime + playLength - fadeOutDuration) / 1000}:d=${fadeOutDuration / 1000}` : "";
            // 输出标志
            const output = `a${index}`;
            outputs += `[${output}]`;
            return result + `[${1 + index}]${cutFilter}${loopFilter}${delayFilter}${volumeFilter}${fadeInFilter}${fadeOutFilter}[${output}];`;
        }, "");
        // 应用符合过滤器
        complexFilter && aencoder.complexFilter(`${complexFilter}${outputs}amix=inputs=${audios.length}:normalize=0`);
        this.encoder = aencoder;
        return aencoder;
    }

    // 捕获封面
    private async captureCover(): Promise<void> {
        const {outputPath, coverCaptureTime, coverCaptureFormat, coverCaptureQuality} = this;
        assert(["jpg", "png", "bmp"].includes(coverCaptureFormat), "coverCaptureFormat must be jpg or png or bmp");
        let captureTime: number;
        if (_.isFinite(coverCaptureTime))
            captureTime = Math.min(coverCaptureTime, this.getOutputDuration());
        else
            captureTime = this.getOutputDuration() * 0.2;
        const coverPath = path.join(path.dirname(outputPath), `${path.basename(outputPath)}.${coverCaptureFormat}`);
        await util.captureScreenshot(outputPath, coverPath, captureTime, coverCaptureQuality);
    }

    // 关闭编码器
    private closeEncoder(abort = false): void {
        if (!this.encoder)
            return;
        // 如果为强制终止则移除结束事件
        abort && this.encoder.removeAllListeners("end");
        // 强制退出（确认stdin仍可写，避免向已关闭的管道写入抛出异常）
        // ffmpegProc 为 fluent-ffmpeg 运行时挂载的子进程引用，@types 未声明
        const ffmpegProc = (this.encoder as TFfmpegCommand & {
            ffmpegProc?: { stdin: { writable: boolean; write(data: string): void } }
        }).ffmpegProc;
        if (ffmpegProc && ffmpegProc.stdin.writable)
            ffmpegProc.stdin.write("q");
        this.encoder = null;
    }

    // 获取已合成视频时长
    public getOutputDuration(): number {
        if (!this.fps || !this._frameCount)
            return this.duration || 0;
        return Math.floor(this._frameCount / this.fps) * 1000;
    }

    // 移除输出文件
    public async removeOutputFile(): Promise<void> {
        const {outputPath, coverCaptureFormat} = this;
        const coverPath = path.join(path.dirname(outputPath), `${path.basename(outputPath)}.${coverCaptureFormat}`);
        await fs.remove(outputPath);
        await fs.remove(coverPath);
    }

    // 重置合成器
    public reset(): void {
        this.frameBufferIndex = 0;
        this.frameBuffers = new Array(this.parallelWriteFrames);
        this._frameCount = 0;
        this._startupTime = null;
        this.closeEncoder(true);
        if (this.pipeStream && !this.pipeStream.closed)
            this.pipeStream.end();
        this.pipeStream = null;
        this.setState(Synthesizer.STATE.READY);
    }

    // 获取当前视频编码器编码类型
    public getVideoEncodingType(): string {
        const videoEncoder = this.videoEncoder;
        for (let key in VIDEO_ENCODER_MAP) {
            if (VIDEO_ENCODER_MAP[key].includes(videoEncoder))
                return key;
        }
        return null;
    }

    // 获取当前音频编码器编码类型
    public getAudioEncodingType(): string {
        const audioEncoder = this.audioEncoder;
        for (let key in AUDIO_ENCODER_MAP) {
            if (AUDIO_ENCODER_MAP[key].includes(audioEncoder))
                return key;
        }
        return null;
    }

    // 是否已就绪
    public isReady(): boolean {
        return this.state == Synthesizer.STATE.READY;
    }

    // 是否合成中
    public isSynthesizing(): boolean {
        return this.state == Synthesizer.STATE.SYNTHESIZING;
    }

    // 是否已完成
    public isCompleted(): boolean {
        return this.state == Synthesizer.STATE.COMPLETED;
    }

    // 移除所有监听器
    public removeListeners(): void {
        this.removeAllListeners("completed");
        this.removeAllListeners("progress");
        this.removeAllListeners("error");
    }

    // 挂载CliProgress
    public attachCliProgress(instance: TCliProgress): void {
        this.showProgress = true;
        this._cliProgress = instance;
    }

    // 设置合成器状态
    private setState(state: symbol): void {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    // 获取已处理帧数
    public get frameCount(): number {
        return this._frameCount;
    }

    // 获取目标总帧数
    public get targetFrameCount(): number {
        return this._targetFrameCount;
    }

    // 获取是否合成音频
    public get audioSynthesis(): boolean {
        return this.audios.length > 0;
    }

    // 获取是否具有透明通道
    public get hasAlphaChannel(): boolean {
        return this.format == "webm" && this.backgroundOpacity < 1;
    }

    // 判断是否VideoChunk
    protected _isVideoChunk(): boolean {
        return false;
    }

}
