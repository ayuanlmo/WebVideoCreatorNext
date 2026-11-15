// 页面捕获上下文 captureCtx 的 API 类型契约（Node 与浏览器两侧共用，零依赖）。
// 运行时实现为 src/browser/CaptureContext.ts（esbuild 打包后挂载为页面全局 captureCtx）。

// 捕获上下文配置对象（Node 侧经 Page 注入页面）
// 预处理数据分片传输清单（回传数据超过分片大小时由 /api/video_preprocess 返回）
export interface IPreprocessChunkManifest {
    id: string; // 数据块ID
    size: number; // 数据总大小（字节）
    chunkSize: number; // 分片大小（字节）
    chunks: number; // 分片数量
}

export interface ICaptureContextConfig {
    fps?: number; // 渲染帧率
    startTime?: number; // 开始捕获时间点（毫秒）
    duration?: number; // 总时长（毫秒）
    frameCount?: number; // 目标总帧数
    autostart?: boolean; // 页面就绪后是否自动开始捕获
    videoDecoderHardwareAcceleration?: string; // 视频解码器硬件加速方法提示
}

// 捕获上下文 fetch 选项（在原生 RequestInit 基础上支持重试）
export interface IFetchOptions extends RequestInit {
    retryFetchs?: number; // 重试拉取次数，默认2
    retryDelay?: number; // 重试间隔（毫秒），默认500
}

// 页面侧音频选项（Node 侧实体 IAudioOptions 在此基础上扩展 id/path）
export interface ICaptureAudioOptions {
    url?: string; // 音频URL
    startTime?: number; // 起始时间点（毫秒），默认0
    endTime?: number; // 结束时间点（毫秒）
    loop?: boolean; // 是否循环播放，默认false
    volume?: number; // 音量（0-100），默认100
    seekStart?: number; // 裁剪起始时间点（毫秒），默认0
    seekEnd?: number; // 裁剪结束时间点（毫秒）
    fadeInDuration?: number; // 淡入时长（毫秒）
    fadeOutDuration?: number; // 淡出时长（毫秒）
    retryFetchs?: number; // 重试拉取次数，默认2
    ignoreCache?: boolean; // 是否忽略本地缓存，默认false
}

// 页面侧经 ____addAudio 上报的音频载荷（addAudio API 与 <audio> 元素转换两条路径的并集）
export interface IAudioAddPayload extends ICaptureAudioOptions {
    id?: number; // 内部音频ID（元素转换路径）
    audioId?: number; // 内部音频ID（addAudio API 路径）
    format?: string; // 音频格式
    autoplay?: boolean; // 是否自动播放
    muted?: boolean; // 是否静音
}

// 页面全局 captureCtx 的公开 API
export interface ICaptureContext {
    config: ICaptureContextConfig;
    currentTime: number; // 当前时间点（毫秒）
    pauseFlag: boolean;
    stopFlag: boolean;
    resumeCallback: (() => void) | null;

    init(): void;

    ready(): boolean;

    start(): void;

    abort(): void;

    fetch(url: string, options?: IFetchOptions, retryIndex?: number): Promise<Response | null>;

    addAudio(options?: ICaptureAudioOptions): void;

    addAudios(audios?: ICaptureAudioOptions[]): void;
}
