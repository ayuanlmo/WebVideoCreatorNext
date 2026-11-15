import assert from "assert"
import path from "path";
import fs from "fs-extra";
import _ from "lodash";
import AsyncLock from "async-lock";

import util from "../lib/util";
import type {ICaptureAudioOptions} from "../lib/capture-ctx-api";

const downloadLock = new AsyncLock();

// data: URI音频MIME到文件后缀映射
const DATA_URI_MIME_EXT_MAP: { [key: string]: string } = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "audio/webm": "weba"
};

// 音频选项
export interface IAudioOptions extends ICaptureAudioOptions {
    id?: number; // 音频ID
    path?: string; // 音频路径
}

// 音频
export default class Audio {

    public id: number | undefined; // 音频ID
    public path: string | undefined; // 音频路径
    public url: string | undefined; // 音频URL
    public startTime: number; // 起始时间点（毫秒）
    public endTime: number | undefined; // 结束时间点（毫秒）
    public duration: number | undefined; // 时长
    public loop: boolean | number; // 是否循环播放
    public volume: number; // 音量（0-100）
    public seekStart: number; // 裁剪起始时间点（毫秒）
    public seekEnd: number | undefined; // 裁剪结束实际点（毫秒）
    public fadeInDuration: number | undefined; // 淡入时长（毫秒）
    public fadeOutDuration: number | undefined; // 淡出时长（毫秒
    public retryFetchs: number; // 重试拉取次数
    public ignoreCache: boolean; // 是否忽略本地缓存
    public tmpDirPath: string = path.resolve("tmp/preprocessor/"); // 临时路径
    private loadPromise: Promise<void> | undefined; // 加载承诺

    // 构造函数
    constructor(options: IAudioOptions) {
        assert(_.isObject(options), "addAudio options must be object");
        const {
            id, path: _path, url, startTime, endTime, loop, volume, seekStart, seekEnd,
            fadeInDuration, fadeOutDuration, retryFetchs, ignoreCache
        } = options;
        assert(_.isUndefined(id) || _.isFinite(id), "Audio id must be number");
        assert(_.isString(_path) || _.isString(url), "Audio path or url must be string");
        assert(_.isUndefined(startTime) || _.isFinite(startTime), "Audio startTime must be number");
        assert(_.isUndefined(endTime) || _.isFinite(endTime), "Audio endTime must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "Audio loop must be boolean");
        assert(_.isUndefined(volume) || _.isFinite(volume), "Audio volume must be number");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "Audio seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "Audio seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "Audio fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "Audio fadeOutDuration must be number");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "Audio retryFetchs must be number");
        assert(_.isUndefined(ignoreCache) || _.isBoolean(ignoreCache), "Audio fadeOutDuration must be boolean");
        this.id = id;
        this.path = _.isString(_path) ? path.resolve(_path) : _path;
        this.url = url;
        this.startTime = _.defaultTo(startTime, 0);
        this.endTime = endTime;
        this.loop = _.defaultTo(loop, false);
        this.volume = _.defaultTo(volume, 100);
        this.seekStart = _.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.retryFetchs = _.defaultTo(retryFetchs, 2);
        this.ignoreCache = _.defaultTo(ignoreCache, false);
    }

    // 资源加载
    public async load(): Promise<void> {
        if (this.loadPromise)
            return this.loadPromise;
        this.loadPromise = (async (): Promise<void> => {
            if (this.path) {
                if (!await fs.pathExists(this.path))
                    throw new Error(`Audio source ${this.path} not exists`);
                if (!(await fs.stat(this.path)).isFile())
                    throw new Error(`Audio source ${this.path} must be file`);
            } else if (this.url)
                this.path = await this.downloadFile(this.url);
            this.duration = await util.getMediaDuration(this.path as string);
            if (this.endTime > 0 && this.startTime > this.endTime)
                throw new Error(`Audio startTime (${this.startTime}) > endTime (${this.endTime})`);
            if (this.seekEnd && this.seekStart > this.seekEnd)
                throw new Error(`Audio seekStart (${this.seekStart}) > seekEnd (${this.seekEnd})`);
        })();
        return this.loadPromise;
    }

    // 下载文件
    private async downloadFile(url: string): Promise<string> {
        // data: URI直接解码落盘（blob:来源已在页面侧转换为data: URI），不走网络下载
        if (url.indexOf("data:") === 0) {
            const commaIndex = url.indexOf(",");
            const meta = url.substring(5, commaIndex);
            const mime = meta.split(";")[0];
            const ext = DATA_URI_MIME_EXT_MAP[mime] || "audio";
            const filePath = path.join(this.tmpDirPath, `data_${util.crc32(url)}.${ext}`);
            await downloadLock.acquire(String(util.crc32(url)), async (): Promise<void> => {
                if (!this.ignoreCache && await fs.pathExists(filePath)) return;
                await fs.ensureDir(this.tmpDirPath);
                const payload = url.substring(commaIndex + 1);
                const buffer = meta.endsWith(";base64") ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf-8");
                await fs.writeFile(filePath, buffer);
            });
            return filePath;
        }
        const filePath = path.join(this.tmpDirPath, util.urlToPath(url));
        await downloadLock.acquire(String(util.crc32(url)), async (): Promise<string> => {
            if (!this.ignoreCache && await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath));
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(url, writeStream, {
                mimesLimit: [
                    /^audio\//,
                    /^application\/octet-stream/
                ],
                retryFetchs: this.retryFetchs
            });
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

}
