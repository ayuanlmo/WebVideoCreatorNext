import fs from "fs-extra";
import assert from "assert";
import _ from "lodash";
import ffmpeg from "fluent-ffmpeg";
import {PassThrough} from "stream";
import AsyncLock from "async-lock";

import ProcessTask from "../base/ProcessTask";
import {type ITaskOptions} from "../base/Task";
import Audio from "../../entity/Audio";
import util from "../../lib/util";
import {VIDEO_ENCODER} from "../../lib/const";

// 视频处理任务选项
export interface IVideoProcessTaskOptions extends ITaskOptions {
    filePath: string; // 视频文件路径
    maskFilePath?: string; // 蒙版视频文件路径
    format: string; // 视频格式（mp4/webm）
    startTime: number; // 开始播放时间点（毫秒）
    endTime: number; // 结束播放时间（毫秒）
    audioId: number; // 内部音频ID
    seekStart?: number; // 裁剪开始时间点（毫秒）
    seekEnd?: number; // 裁剪结束时间点（毫秒）
    fadeInDuration?: number; // 音频淡入时长（毫秒）
    fadeOutDuration?: number; // 音频淡出时长（毫秒）
    autoplay?: boolean; // 是否自动播放
    volume?: number; // 视频音量（0-100）
    loop?: boolean; // 是否循环播放
    muted?: boolean; // 是否静音
    videoEncoder?: string; // 视频编码器
}

// 视频处理结果
export interface IVideoProcessResult {
    audio: Audio | null; // 添加到合成器的音频对象
    buffer: Buffer; // video_preprocess 响应回传到浏览器的数据
}

// 处理异步锁
const processLock = new AsyncLock();

export default class VideoProcessTask extends ProcessTask {

    public filePath: string; // 视频文件路径
    public format: string; // 视频格式
    public maskFilePath: string; // 蒙版视频文件路径
    public audioFilePath: string; // 音频文件路径
    public transcodedFilePath: string; // 已转码文件路径
    public startTime: number; // 开始播放时间点（毫秒）
    public endTime: number; // 结束播放时间点（毫秒）
    public audioId: number; // 音频ID
    public seekStart: number; // 裁剪开始时间点（毫秒）
    public seekEnd: number; // 裁剪结束时间点（毫秒）
    public fadeInDuration: number; // 视频音频淡入时长（毫秒）
    public fadeOutDuration: number; // 视频音频淡出时长（毫秒）
    public autoplay: boolean; // 是否自动播放
    public volume: number; // 视频音量
    public loop: boolean; // 是否循环播放
    public muted: boolean; // 是否静音
    public videoEncoder: string; // 视频编码器

    // 构造函数
    constructor(options: IVideoProcessTaskOptions) {
        super(options);
        const {
            filePath,
            maskFilePath,
            format,
            startTime,
            endTime,
            audioId,
            seekStart,
            seekEnd,
            fadeInDuration,
            fadeOutDuration,
            autoplay,
            volume,
            loop,
            muted,
            videoEncoder
        } = options;
        assert(_.isString(filePath), "filePath must be string");
        assert(_.isString(format) && ["mp4", "webm"].includes(format), "format must be string");
        assert(_.isFinite(startTime), "startTime must be number");
        assert(_.isFinite(endTime), "endTime must be number");
        assert(_.isFinite(audioId), "audioId must be number");
        assert(_.isUndefined(maskFilePath) || _.isString(maskFilePath), "maskFilePath must be string");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "fadeOutDuration must be number");
        assert(_.isUndefined(autoplay) || _.isBoolean(autoplay), "autoplay must be number");
        assert(_.isUndefined(volume) || _.isFinite(volume), "volume must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isUndefined(muted) || _.isBoolean(muted), "muted must be number");
        assert(_.isUndefined(videoEncoder) || _.isString(videoEncoder), "videoEncoder must be string");
        this.filePath = filePath;
        this.maskFilePath = maskFilePath;
        this.format = format;
        this.startTime = startTime;
        this.endTime = endTime;
        this.audioId = audioId;
        this.seekStart = _.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.autoplay = autoplay;
        this.volume = _.defaultTo(volume, 100);
        this.loop = _.defaultTo(loop, false);
        this.muted = _.defaultTo(muted, false);
        this.videoEncoder = _.defaultTo(videoEncoder, VIDEO_ENCODER.CPU.H264);
    }

    // 处理视频
    public async process(): Promise<IVideoProcessResult> {
        // 非静音音频需分离音频文件
        !this.muted && await this.separateAudioFile();
        if (this.format == "webm") {
            // 视频转码为H264
            await this.videoTranscoding();
            // 检查是否具有透明通道
            const hasAlphaChannel = await util.checkMediaHasAplhaChannel(this.filePath);
            // 具备透明通道将分离出蒙版视频
            hasAlphaChannel && await this.videoMaskExtract();
        }
        let buffer: Buffer;
        let maskBuffer: Buffer | null = null;
        // 当存在seek时进行裁剪
        if (this.hasClip) {
            buffer = await this.videoClip(this.outputFilePath);
            if (this.maskFilePath)
                maskBuffer = await this.videoClip(this.maskFilePath);
        } else {
            buffer = await fs.readFile(this.outputFilePath);
            if (this.maskFilePath)
                maskBuffer = await fs.readFile(this.maskFilePath);
        }
        return {
            // 添加到合成器的音频对象
            audio: this.audioFilePath ? new Audio({
                id: this.audioId,
                path: this.audioFilePath,
                startTime: this.startTime,
                endTime: this.endTime,
                seekStart: this.seekStart,
                seekEnd: this.seekEnd,
                fadeInDuration: this.fadeInDuration,
                fadeOutDuration: this.fadeOutDuration,
                volume: this.volume,
                loop: this.loop
            }) : null,
            // video_preprocess响应回传到浏览器的数据
            buffer: this.packData({
                buffer,
                maskBuffer,
                hasMask: !!this.maskFilePath,
                hasAudio: this.hasAudio,
                hasClip: this.hasClip
            })
        }
    }

    // 视频裁剪
    private async videoClip(filePath: string): Promise<Buffer> {
        const cliper = ffmpeg(filePath);
        let seekEnd = this.seekEnd;
        const duration = (seekEnd || Infinity) - (this.seekStart || 0);
        const endTime = this.startTime + duration;
        if (endTime != Infinity && endTime > this.endTime)
            seekEnd = seekEnd - (endTime - this.endTime);
        this.seekStart && cliper.addInputOption("-ss", util.millisecondsToHmss(this.seekStart));
        seekEnd && cliper.addInputOption("-to", util.millisecondsToHmss(seekEnd));
        const buffers: Buffer[] = [];
        const stream = new PassThrough();
        const receivePromise = new Promise<Buffer>((resolve, reject): void => {
            stream.on("data", (data): number => buffers.push(data));
            stream.once("error", reject)
            stream.once("end", (): void => resolve(Buffer.concat(buffers)));
        });
        await new Promise((resolve, reject): void => {
            cliper
                .addOutputOption(`-c:v ${this.videoEncoder}`)
                .addOutputOption("-an")
                .addOutputOption("-crf 18")
                .addOutputOption("-movflags frag_keyframe+empty_moov")
                .toFormat("mp4")
                .once("error", reject)
                .once("end", resolve)
                .pipe(stream, {end: true});
        });
        return await receivePromise;
    }

    // 透明视频蒙版提取
    private async videoMaskExtract(): Promise<void> {
        return await processLock.acquire(`videoMaskExtract-${util.crc32(this.filePath)}`, async (): Promise<void> => {
            const maskFilePath = `${this.filePath}_mask.mp4`
            if (!this.ignoreCache && await fs.pathExists(maskFilePath)) {
                this.maskFilePath = maskFilePath;
                return;
            }
            const videoEncoderName = await util.getMediaVideoCodecName(this.filePath);
            let codec: string;
            switch (videoEncoderName) {
                case "vp8":
                    codec = "libvpx";
                    break;
                case "vp9":
                    codec = "libvpx-vp9";
                    break;
                default:
                    throw new Error(`Video file ${this.filePath} codec name ${videoEncoderName} is not supported`);
            }
            await new Promise((resolve, reject): void => {
                ffmpeg(this.filePath)
                    .addInputOption(`-c:v ${codec}`)
                    .videoFilter("alphaextract")
                    .addOutputOption(`-c:v ${this.videoEncoder}`)
                    .addOutputOption("-an")
                    .outputOption("-movflags +faststart")
                    .addOutput(maskFilePath)
                    .once("start", (cmd): void => util.ffmpegLog(cmd))
                    .once("end", resolve)
                    .once("error", (err): void => {
                        fs.removeSync(maskFilePath);
                        reject(err);
                    })
                    .run();
            });
            this.maskFilePath = maskFilePath;
        });
    }

    // 视频转码
    private async videoTranscoding(): Promise<void> {
        return await processLock.acquire(`videoTranscoding-${util.crc32(this.filePath)}`, async (): Promise<void> => {
            const transcodedFilePath = `${this.filePath}_transcoded.mp4`;
            if (!this.ignoreCache && await fs.pathExists(transcodedFilePath)) {
                this.transcodedFilePath = transcodedFilePath;
                return;
            }
            const videoEncoderName = await util.getMediaVideoCodecName(this.filePath);
            let codec: string;
            switch (videoEncoderName) {
                case "vp8":
                    codec = "libvpx";
                    break;
                case "vp9":
                    codec = "libvpx-vp9";
                    break;
                default:
                    throw new Error(`Video file ${this.filePath} codec name ${videoEncoderName} is not supported`);
            }
            await new Promise((resolve, reject): void => {
                ffmpeg(this.filePath)
                    .addInputOption(`-c:v ${codec}`)
                    .addOutputOption(`-c:v ${this.videoEncoder}`)
                    .addOutputOption("-an")
                    .addOutputOption("-crf 18")
                    .outputOption("-movflags +faststart")
                    .addOutput(transcodedFilePath)
                    .once("start", (cmd): void => util.ffmpegLog(cmd))
                    .once("end", resolve)
                    .once("error", (err): void => {
                        // 只清理转码残留的临时文件，绝不能删除源视频
                        fs.removeSync(transcodedFilePath);
                        reject(err);
                    })
                    .run();
            });
            this.transcodedFilePath = transcodedFilePath;
        });
    }

    // 分离视频的音频
    private async separateAudioFile(): Promise<void> {
        return await processLock.acquire(`separateAudioFile-${util.crc32(this.filePath)}`, async (): Promise<void> => {
            const audioFormat = "mp3";
            const audioFilePath = `${this.filePath}.${audioFormat}`;
            if (this.ignoreCache || !await fs.pathExists(audioFilePath)) {
                const hasAudioTrack = await util.separateVideoAudioTrack(this.filePath, audioFilePath, {
                    audioEncoder: "libmp3lame",
                    outputFormat: audioFormat
                });
                if (hasAudioTrack)
                    this.audioFilePath = audioFilePath;
            } else
                this.audioFilePath = audioFilePath;
        });
    }

    // 封装数据
    // 将对象封装为Buffer才能回传浏览器页面处理
    private packData(data: Record<string, unknown>): Buffer {
        const obj: Record<string, unknown> = {};
        const buffers: Buffer[] = [];
        let bufferOffset = 0;
        for (let key in data) {
            const value = data[key];
            const buffer = _.isBuffer(value) ? value as Buffer : null;
            if (buffer) {
                obj[key] = ["buffer", bufferOffset, bufferOffset + buffer.length];
                bufferOffset += buffer.length;
                buffers.push(buffer);
            } else
                obj[key] = value;
        }
        const objBuffer = Buffer.from(JSON.stringify(obj))
        buffers.unshift(objBuffer);
        buffers.unshift(Buffer.from(`${objBuffer.length}!`));
        return Buffer.concat(buffers);
    }

    public get outputFilePath(): string {
        return this.transcodedFilePath || this.filePath;
    }

    // 是否包含音频
    public get hasAudio(): boolean {
        return !!this.audioFilePath;
    }

    // 是否裁剪
    public get hasClip(): boolean {
        return this.seekStart > 0 || this.seekEnd > 0;
    }

}
