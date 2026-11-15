import {AUDIO_ENCODER, VIDEO_ENCODER} from "./const";

// 全局配置
export interface IGlobalConfig {

    debug: boolean; // WebVideoCreator调试日志

    browserVersion: string | null; // 浏览器版本

    browserHeadless: boolean | "shell"; // 浏览器无头开关

    browserFrameRateLimit: boolean; // 浏览器帧率限制开关

    browserDebug: boolean; // 浏览器Debug开关

    ffmpegDebug: boolean; // FFmpeg Debug开关

    ffmpegExecutablePath: string | null; // ffmpeg可执行文件路径

    ffprobeExecutablePath: string | null; // ffprobe可执行文件路径

    browserUseGPU: boolean; // 浏览器GPU加速开关

    browserUseAngle: boolean; // 浏览器是否使用Angle作为渲染后端

    browserDisableDevShm: boolean; // 是否禁用浏览器使用共享内存

    browserExecutablePath: string | null; // 浏览器可执行文件路径

    browserLaunchTimeout: number; // 浏览器启动超时时间（毫秒）

    browserProtocolTimeout: number; // 浏览器协议通信超时时间（毫秒）

    allowUnsafeContext: boolean; // 是否允许不安全的上下文

    compatibleRenderingMode: boolean; // 兼容渲染模式

    numBrowserMin: number; // 资源池可并行的最小浏览器实例数量

    numBrowserMax: number; // 资源池可并行的最大浏览器实例数量

    numPageMin: number; // 浏览器实例可并行的最小页面实例数量

    numPageMax: number; // 浏览器实例可并行的最大页面实例数量

    userAgent: string | null; // 访问页面时的用户UA

    frameQuality: number; // 捕获帧图质量（0-100）

    frameFormat: string; // 帧图格式（jpeg/png）

    preprocessChunkSize: number; // 预处理数据回传浏览器的分片大小（字节），回传数据超过该大小时启用分片传输

    beginFrameTimeout: number; // BeginFrame捕获图像超时时间（毫秒）

    mp4Encoder: string; // 全局MP4格式的视频编码器

    webmEncoder: string; // 全局WEBM格式的视频编码器

    audioEncoder: string; // 全局音频编码器

}

export default {

    debug: false, // WebVideoCreator调试日志

    browserVersion: null as string | null, // 浏览器版本

    browserHeadless: "shell" as boolean | "shell", // 浏览器无头开关

    browserFrameRateLimit: true, // 浏览器帧率限制开关

    browserDebug: false, // 浏览器Debug开关

    ffmpegDebug: false, // FFmpeg Debug开关

    ffmpegExecutablePath: null as string | null, // ffmpeg可执行文件路径

    ffprobeExecutablePath: null as string | null, // ffprobe可执行文件路径

    browserUseGPU: true, // 浏览器GPU加速开关

    browserUseAngle: true, // 浏览器是否使用Angle作为渲染后端

    browserDisableDevShm: false, // 是否禁用浏览器使用共享内存

    browserExecutablePath: null as string | null, // 浏览器可执行文件路径

    browserLaunchTimeout: 30000, // 浏览器启动超时时间（毫秒）

    browserProtocolTimeout: 180000, // 浏览器协议通信超时时间（毫秒）

    allowUnsafeContext: false, // 是否允许不安全的上下文

    compatibleRenderingMode: false, // 兼容渲染模式

    numBrowserMin: 1, // 资源池可并行的最小浏览器实例数量

    numBrowserMax: 5, // 资源池可并行的最大浏览器实例数量

    numPageMin: 1, // 浏览器实例可并行的最小页面实例数量

    numPageMax: 5, // 浏览器实例可并行的最大页面实例数量

    userAgent: null as string | null, // 访问页面时的用户UA

    frameQuality: 80, // 捕获帧图质量（0-100）

    frameFormat: "jpeg", // 帧图格式（jpeg/png）

    preprocessChunkSize: 33554432, // 预处理数据回传浏览器的分片大小（字节），默认32MB，单次应答保持在浏览器约100MB缓冲上限之下

    beginFrameTimeout: 5000, // BeginFrame捕获图像超时时间（毫秒）

    mp4Encoder: VIDEO_ENCODER.CPU.H264 as string, // 全局MP4格式的视频编码器

    webmEncoder: VIDEO_ENCODER.CPU.VP8 as string, // 全局WEBM格式的视频编码器

    audioEncoder: AUDIO_ENCODER.AAC as string // 全局音频编码器

} as IGlobalConfig;
