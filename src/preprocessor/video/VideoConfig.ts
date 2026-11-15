import assert from "assert";
import _ from "lodash";

import util from "../../lib/util";

// 视频配置选项（对应页面 /api/video_preprocess 请求体）
export interface IVideoConfigOptions {
    url: string; // 视频URL
    maskUrl?: string; // 蒙版视频URL
    format?: string; // 视频格式（mp4/webm）
    startTime: number; // 开始播放时间点（毫秒）
    endTime: number; // 结束播放时间（毫秒）
    audioId?: number; // 内部音频ID
    seekStart?: number; // 裁剪开始时间点（毫秒）
    seekEnd?: number; // 裁剪结束时间点（毫秒）
    fadeInDuration?: number; // 音频淡入时长（毫秒）
    fadeOutDuration?: number; // 音频淡出时长（毫秒）
    autoplay?: boolean; // 是否自动播放
    volume?: number; // 视频音量（0-100）
    loop?: boolean; // 是否循环播放
    muted?: boolean; // 是否静音
    retryFetchs?: number; // 重试下载次数
    ignoreCache?: boolean; // 是否忽略本地缓存
}

export default class VideoConfig {

    public url: string; // 视频URL
    public maskUrl: string; // 蒙版视频URL
    public format: string; // 视频格式（mp4/webm）
    public startTime: number; // 开始播放时间点（毫秒）
    public endTime: number; // 结束播放时间（毫秒）
    public audioId: number; // 内部音频ID
    public seekStart: number; // 裁剪开始时间点（毫秒）
    public seekEnd: number; // 裁剪结束时间点（毫秒）
    public fadeInDuration: number; // 音频淡入时长（毫秒）
    public fadeOutDuration: number; // 音频淡出时长（毫秒）
    public autoplay: boolean; // 是否自动播放
    public volume: number; // 视频音量（0-100）
    public loop: boolean; // 是否循环播放
    public muted: boolean; // 是否静音
    public retryFetchs: number; // 重试下载次数
    public ignoreCache: boolean; // 是否忽略本地缓存

    // 构造函数
    constructor(options: IVideoConfigOptions) {
        assert(_.isObject(options), "VideoConfig options must be Object");
        const {
            url,
            maskUrl,
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
            retryFetchs,
            ignoreCache
        } = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isFinite(startTime), "startTime must be number");
        assert(_.isFinite(endTime), "endTime must be number");
        assert(_.isUndefined(maskUrl) || util.isURL(maskUrl), "maskUrl is invalid");
        assert(_.isUndefined(format) || _.isString(format), "format mudt be string");
        assert(_.isUndefined(audioId) || _.isFinite(audioId), "audioId must be number");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "fadeOutDuration must be number");
        assert(_.isUndefined(autoplay) || _.isBoolean(autoplay), "autoplay must be number");
        assert(_.isUndefined(volume) || _.isFinite(volume), "volume must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "loop must be boolean");
        assert(_.isUndefined(muted) || _.isBoolean(muted), "muted must be boolean");
        this.url = url;
        this.maskUrl = maskUrl;
        this.format = _.defaultTo(format, util.getURLExtname(this.url));
        this.startTime = startTime;
        this.endTime = endTime;
        this.audioId = audioId;
        this.seekStart = seekStart;
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.autoplay = autoplay;
        this.volume = volume;
        this.loop = loop;
        this.muted = muted;
        this.retryFetchs = retryFetchs;
        this.ignoreCache = ignoreCache;
    }

}
