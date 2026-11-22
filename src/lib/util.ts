import os from "os";
import path from "path";
import crypto from 'crypto';
import zlib from "zlib";
import assert from "assert";
import {Readable, Writable} from 'stream';
import {pipeline} from "stream/promises";
import {fileURLToPath} from "url";
import fs from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
import _ from "lodash";

import globalConfig from "./global-config";
import logger from "./logger";

// 项目根路径
// 注意：编译后本文件位于dist/lib/目录下，两层dirname后ROOT_PATH指向dist目录
const ROOT_PATH = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 远端资源检查结果
export interface IRemoteResourceInfo {
    mime: string; // MIME类型
    size: number | null; // 资源大小（字节），未知时为null
}

// 分离音轨选项
export interface ISeparateVideoAudioTrackOptions {
    seekStart?: number; // 裁剪开始时间点（毫秒）
    seekEnd?: number; // 裁剪结束时间点（毫秒）
    audioEncoder?: string; // 音频编码器，默认"libmp3lame"
    audioBitrate?: string; // 音频码率，默认"320k"
    audioSampleRate?: string; // 音频采样率，默认"44100"
    outputFormat?: string; // 输出格式，默认"mp3"
}

// 音频裁剪选项
export interface IClipAudioOptions {
    seekStart?: number; // 裁剪开始时间点（毫秒）
    seekEnd?: number; // 裁剪结束时间点（毫秒）
}

// 下载选项
export interface IDownloadOptions {
    onProgress?: (percent: number) => void; // 下载进度回调
    mimesLimit?: (string | RegExp)[]; // 限制MIME类型列表
    retryFetchs?: number; // 重试次数
    retryDelay?: number; // 重试延迟
    _retryCount?: number; // 内部重试计数
    // 其余透传给fetch的选项
    [key: string]: unknown;
}

// ffprobe 媒体流信息（仅建模实际使用面）
export interface IMediaStreamInfo {
    codec_type?: string;
    codec_name?: string;
    tags?: Record<string, string>;
}

// ffprobe 媒体元数据（仅建模实际使用面）
export interface IMediaMetadata {
    format?: { duration?: number | string };
    streams?: IMediaStreamInfo[];
}

export default {

    // 拼接路径
    rootPathJoin(relativePath: string): string {
        if (!relativePath)
            return relativePath;
        // 如果是绝对路径则直接返回绝对路径
        if (path.isAbsolute(relativePath))
            return relativePath;
        return path.join(ROOT_PATH, relativePath);
    },

    // 检查远端资源是否可访问
    async checkRemoteResource(url: string, mimesLimit?: (string | RegExp)[]): Promise<IRemoteResourceInfo> {
        url = url.replace("localhost", "127.0.0.1");
        const response = await fetch(url, {method: "HEAD"});
        if (!response.ok)
            throw new Error(`Resource ${url} request error: [${response.status || 0}] ${response.statusText || "Unknown"}`);
        const mime = response.headers.get("content-type") || "unknown";
        const size = response.headers.get("content-length");
        if (_.isArray(mimesLimit)) {
            let matched;
            for (let limit of mimesLimit) {
                if (limit == mime || (_.isRegExp(limit) && limit.test(mime))) {
                    matched = true;
                    break;
                }
            }
            if (!matched)
                throw new Error(`Resource ${url} content type ${mime} is not supported`);
        }
        return {
            mime,
            size: size ? Number(size) : null
        };
    },

    // 获取媒体元数据
    async getMediaMetadata(source: string): Promise<IMediaMetadata> {
        if (!await fs.pathExists(source) && !this.isURL(source))
            throw new Error(`media source ${source} not found`);
        return new Promise((resolve, reject): void => {
            // @types/fluent-ffmpeg 的 ffprobe 重载不覆盖 (input, callback) 形式
            (ffmpeg.ffprobe as unknown as (source: string, callback: (err: Error | null, metadata: IMediaMetadata) => void) => void)(source, (err, metadata): void => {
                if (err) return reject(err);
                resolve(metadata);
            });
        });
    },

    // 获取媒体视频编码器
    async getMediaVideoCodecName(source: string, allStreams = false): Promise<string | string[]> {
        const {streams} = await this.getMediaMetadata(source);
        const videoStreams = streams.filter((v): boolean => v.codec_type === "video");
        if (!videoStreams.length)
            throw new Error(`${source} video stream not found`);
        return allStreams ? videoStreams.map((stream): string => stream.codec_name) : videoStreams[0].codec_name;
    },

    // 获取媒体时长
    async getMediaDuration(source: string): Promise<number> {
        const metadata = await this.getMediaMetadata(source);  //获取媒体信息
        if (!metadata || !metadata.format || !_.isFinite(metadata.format.duration))
            throw new Error(`Media ${source} duration invalid`);
        return Number(metadata.format.duration || 0) * 1000;
    },

    // 检查媒体是否具有透明通道
    async checkMediaHasAplhaChannel(source: string): Promise<boolean> {
        const metadata = await this.getMediaMetadata(source);  //获取媒体信息
        if (!metadata || !metadata.streams || !metadata.streams[0])
            throw new Error(`Media ${source} streams invalid`);
        if (!metadata.streams[0].tags || !metadata.streams[0].tags["ALPHA_MODE"])
            return false;
        return Number(metadata.streams[0].tags["ALPHA_MODE"]) > 0;
    },

    // 判断是否URL
    isURL(value: unknown): boolean {
        return !_.isUndefined(value) && /^(http|https)/.test(String(value));
    },

    // 判断是否处于Linux平台
    isLinux(): boolean {
        return os.platform() === "linux";
    },

    // 判断是否写入流
    isWriteStream(value: unknown): boolean {
        return !!value && (value instanceof Writable || "writable" in (value as object) || !!(value as {
            writable?: boolean
        }).writable);
    },

    // 拼接URL
    urlJoin(...values: string[]): string {
        let url = "";
        for (let i = 0; i < values.length; i++)
            url += `${i > 0 ? "/" : ""}${values[i].replace(/^\/*/, "").replace(/\/*$/, "")}`;
        return url;
    },

    // URL转本地路径
    urlToPath(value: string): string {
        const {host, pathname} = new URL(value);
        return `${host.replace(/\.|:/g, "_")}${pathname.replace(/\.\.|:|@|\?|\*/g, "_")}`
    },

    // 获取URL扩展名
    getURLExtname(value: string): string | null {
        if (!this.isURL(value))
            return null;
        const {pathname} = new URL(value);
        const extname = path.extname(pathname);
        if (!extname)
            return null;
        return extname.substring(1);
    },

    // 获取路径扩展名
    getPathExtname(value: string): string {
        return path.extname(value).substring(1);
    },

    // 毫秒转H:m:s.ms时间字符串
    millisecondsToHmss(milliseconds: number | string): string {
        if (_.isString(milliseconds)) return milliseconds;
        milliseconds = parseInt(String(milliseconds));
        const sec = Math.floor(milliseconds / 1000);
        const hours = Math.floor(sec / 3600);
        const minutes = Math.floor((sec - hours * 3600) / 60);
        const seconds = sec - hours * 3600 - minutes * 60;
        const ms = milliseconds % 60000 - seconds * 1000;
        return `${hours > 9 ? hours : "0" + hours}:${minutes > 9 ? minutes : "0" + minutes}:${seconds > 9 ? seconds : "0" + seconds}.${ms}`;
    },

    // 将时长转换为总帧数
    durationToFrameCount(duration: number, fps: number): number {
        assert(_.isFinite(duration), "duration must be number");
        assert(_.isFinite(fps), "fps must be number");
        return Math.floor(duration / 1000 * fps)
    },

    // 将总帧数转换为时长
    frameCountToDuration(frameCount: number, fps: number): number {
        assert(_.isFinite(frameCount), "duration must be number");
        assert(_.isFinite(fps), "fps must be number");
        return frameCount / fps;
    },

    // 从视频捕获截图
    async captureScreenshot(source: string, dest: string, timemark: number, quality?: number): Promise<void> {
        return new Promise((resolve, reject): void => {
            const cmd = ffmpeg(source)
                .addInputOption("-ss", this.millisecondsToHmss(timemark))
                .outputOptions(["-frames:v", "1"]);
            // JPG质量映射到MJPEG量化器qscale（2-31，值越小质量越高），其余格式不支持质量参数
            if (_.isFinite(quality) && path.extname(dest) == ".jpg")
                cmd.outputOption("-q:v", String(Math.max(2, Math.min(31, Math.round(31 - (quality / 100) * 29)))));
            cmd.output(dest)
                .once("error", reject)
                .once("end", resolve)
                .run();
        });
    },

    // 从视频分离音轨
    async separateVideoAudioTrack(source: string, dest: string, options: ISeparateVideoAudioTrackOptions = {}): Promise<boolean> {
        assert(_.isObject(options), "options must be Object");
        const {
            seekStart, seekEnd, audioEncoder = "libmp3lame", audioBitrate = "320k",
            audioSampleRate = "44100", outputFormat = "mp3"
        } = options;
        assert(_.isString(source), "source must be an url or path");
        assert(_.isString(dest), "dest must be an path");
        const acodeer = ffmpeg();
        acodeer.addInput(source);
        _.isFinite(seekStart) &&
        acodeer.addInputOption("-ss", this.millisecondsToHmss(seekStart));
        _.isFinite(seekEnd) &&
        seekEnd > (seekStart || 0) &&
        acodeer.addInputOption("-to", this.millisecondsToHmss(seekEnd));
        let audioDuration;
        if (_.isFinite(seekEnd))
            audioDuration = seekEnd - (seekStart || 0);
        else
            audioDuration = (await this.getMediaDuration(source)) - (seekStart || 0);
        return new Promise((resolve, reject): void => {
            acodeer
                .addInputOption("-vn")
                .complexFilter("[0]apad")
                .setDuration(audioDuration / 1000)
                .audioCodec(audioEncoder)
                .audioBitrate(audioBitrate)
                .outputOptions(`-ar ${audioSampleRate}`)
                .toFormat(outputFormat)
                .output(dest)
                .once("start", (cmd): void => this.ffmpegLog(cmd))
                .once("error", (err): void => {
                    fs.removeSync(dest);
                    // 无音频返回false
                    if (
                        err.message.indexOf("no streams") != -1 ||
                        err.message.indexOf("not contain") != -1
                    )
                        return resolve(false);
                    reject(err);
                })
                .once("end", (): void => resolve(true))
                .run();
        });
    },

    // 音频裁剪
    async clipAudio(source: string, dest: string, options: IClipAudioOptions = {}): Promise<void> {
        assert(_.isObject(options), "options must be Object");
        const {seekStart = 0, seekEnd} = options;
        assert(_.isString(source), "source must be an url or path");
        assert(_.isString(dest), "dest must be an path");
        const acodeer = ffmpeg();
        acodeer.addInput(source);
        _.isFinite(seekStart) &&
        acodeer.addInputOption("-ss", this.millisecondsToHmss(seekStart));
        _.isFinite(seekEnd) &&
        seekEnd > (seekStart || 0) &&
        acodeer.addInputOption("-to", this.millisecondsToHmss(seekEnd));
        return new Promise((resolve, reject): void => {
            acodeer
                .audioCodec("copy")
                .output(dest)
                .once("start", (cmd): void => this.ffmpegLog(cmd))
                .once("error", reject)
                .once("end", resolve)
                .run();
        });
    },

    // RGB色值转十六进制字符串
    rgbToHex(r: number, g: number, b: number): string {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    // 十六进制字符串转RGB色值
    hexToRgb(hex: string): number[] {
        const value = parseInt(hex.replace(/^#/, ""), 16);
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    },

    // MD5计算
    md5(value: string): string {
        return crypto.createHash("md5").update(value).digest("hex");
    },

    // CRC32计算
    crc32(value: string | Buffer): number {
        return zlib.crc32(value);
    },

    // 下载资源
    async download(url: string, dest: string | NodeJS.WritableStream, options: IDownloadOptions = {}): Promise<void> {
        const {onProgress, mimesLimit, retryFetchs = 0, retryDelay = 500, _retryCount = 0, ...fetchOptions} = options;
        assert(this.isURL(url), `url ${url} is invalid`);
        url = url.replace("localhost", "127.0.0.1");
        const isPathDest = _.isString(dest);
        if (!isPathDest && !this.isWriteStream(dest))
            throw new Error("Download dest is invalid");
        const tmpPath = isPathDest ? `${dest}.tmp` : null;
        try {
            const {size} = await this.checkRemoteResource(url, mimesLimit);
            const response = await fetch(url, fetchOptions as RequestInit);
            if (!response.ok)
                throw new Error(`Resource ${url} request error: [${response.status}] ${response.statusText || "Unknown"}`);
            if (!response.body)
                throw new Error(`Resource ${url} response body is empty`);
            let body = response.body;
            if (onProgress) {
                let writtenSize = 0;
                body = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
                    transform(chunk, controller): void {
                        writtenSize += chunk.length;
                        onProgress(size ? Math.floor(writtenSize / size * 100) : 0);
                        controller.enqueue(chunk);
                    }
                }));
            }
            const writeStream = isPathDest ? fs.createWriteStream(tmpPath) : dest;
            // pipeline等待写入流finish（完整flush）并双向传播错误
            await pipeline(Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]), writeStream);
            if (isPathDest)
                await fs.move(tmpPath, dest, {overwrite: true});
        } catch (err) {
            if (tmpPath)
                await fs.remove(tmpPath).catch((): void => {
                });
            if (retryFetchs > _retryCount) {
                await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, retryDelay));
                return await this.download(url, dest, {...options, _retryCount: _retryCount + 1});
            }
            throw new Error(`Download resource ${url} failed: ${(err as Error).message}`);
        }
    },

    // FFmpeg日志汇总输出
    ffmpegLog(log: string): void {
        if (!globalConfig.ffmpegDebug)
            return;
        logger._debug(log);
    }

}
