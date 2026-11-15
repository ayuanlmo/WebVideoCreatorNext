// 浏览器页面全局环境声明（仅类型，不产生任何运行时代码）

export {};

declare global {
    // ---- vendor 库全局形状（由 vendor 脚本暴露，非 npm 包类型）----

    // mp4box 描述/参数集盒子（可序列化写入 DataStream）
    interface IMP4BoxBox {
        write(stream: IDataStream): void;
    }

    // mp4box 采样描述表条目
    interface IMP4BoxStsdEntry {
        avcC?: IMP4BoxBox;
        hvcC?: IMP4BoxBox;
        vpcC?: IMP4BoxBox;
        av1C?: IMP4BoxBox;
    }

    // mp4box 轨道封装层级（仅建模取描述信息所需路径）
    interface IMP4BoxTrak {
        mdia: { minf: { stbl: { stsd: { entries: IMP4BoxStsdEntry[] } } } };
    }

    // mp4box 视频轨道元信息
    interface IMP4BoxTrack {
        id: number;
        codec: string;
        video?: { width: number; height: number };
        track_width: number;
        track_height: number;
        bitrate: number;
        movie_duration: number;
        movie_timescale: number;
        samples_duration: number;
        timescale: number;
        nb_samples: number;
    }

    // mp4box 采样
    interface IMP4BoxSample {
        is_sync: boolean;
        cts: number;
        timescale: number;
        duration: number;
        data: Uint8Array;
    }

    // mp4box 轨道就绪信息
    interface IMP4BoxInfo {
        videoTracks: IMP4BoxTrack[];
    }

    // mp4box 解复用文件对象
    interface IMP4BoxFile {
        onReady?: (info: IMP4BoxInfo) => void;
        onSamples?: (trackId: number, user: unknown, samples: IMP4BoxSample[]) => void;
        onError?: (err: Error) => void;

        appendBuffer(buffer: ArrayBuffer & { fileStart?: number }): void;

        flush(): void;

        setExtractionOptions(trackId: number, user?: unknown, nbSamples?: number): void;

        start(): void;

        getTrackById(id: number): IMP4BoxTrak;
    }

    // mp4box 库全局（由 Page 从 MP4Box 转挂）
    interface IMP4BoxGlobal {
        createFile(): IMP4BoxFile;
    }

    // mp4box DataStream 实例（vendor 脚本顶层 var 暴露为全局构造器）
    interface IDataStream {
        buffer: ArrayBuffer;
    }

    interface IDataStreamCtor {
        new(buffer?: ArrayBuffer | Uint8Array, byteOffset?: number, endianness?: number): IDataStream;

        BIG_ENDIAN: number;
        LITTLE_ENDIAN: number;
    }

    // lottie 动画实例（仅建模实际使用面）
    interface ILottieAnimation {
        destroy(): void;
    }

    interface ILottieAnimationOptions {
        loop?: boolean;
        animationData: unknown;
        renderer?: string;
        autoplay?: boolean;

        [key: string]: unknown;
    }

    // lottie 动画库全局（由 Page 从 lottie 转挂）
    interface ILottieGlobal {
        loadAnimation(options: ILottieAnimationOptions): ILottieAnimation;
    }

    // 媒体画布绑定选项（各媒体类 bind/_initOffscreenCanvas 共用）
    interface ICanvasOptions {
        alpha?: boolean; // 是否支持透明通道
        imageSmoothingEnabled?: boolean; // 是否开启抗锯齿
        imageSmoothingQuality?: ImageSmoothingQuality; // 抗锯齿强度
    }

    // 字体观测库（由 Page.waitForFontsLoaded 转挂）
    interface IFontFaceObserver {
        load(): Promise<unknown>;
    }

    interface IFontFaceObserverCtor {
        new(family: string, options?: Record<string, unknown>): IFontFaceObserver;
    }

    interface Window {
        ____util: import("./inner-util").IInnerUtil; // 内部工具包
        ____MP4Box: IMP4BoxGlobal; // mp4box 库（由 Page 从 MP4Box 转挂）
        ____lottie: ILottieGlobal; // lottie 动画库（由 Page 从 lottie 转挂）
        ____FontFaceObserver: IFontFaceObserverCtor; // 字体观测库（由 Page.waitForFontsLoaded 转挂）
        ____MP4Demuxer: typeof import("./media/MP4Demuxer").default; // MP4解复用器类
        ____SvgAnimation: typeof import("./media/SvgAnimation").default; // SVG动画类
        ____VideoCanvas: typeof import("./media/VideoCanvas").default; // 视频画布类
        ____DynamicImage: typeof import("./media/DynamicImage").default; // 动态图像类
        ____LottieCanvas: typeof import("./media/LottieCanvas").default; // Lottie画布类
        ____CaptureContext: typeof import("./CaptureContext").default; // 捕获上下文类
        captureCtx: import("./CaptureContext").default; // 捕获上下文实例
        ____setInterval: typeof setInterval; // 被时间虚拟化改写前暂存的原生定时器函数
        ____clearInterval: typeof clearInterval;
        ____setTimeout: typeof setTimeout;
        ____clearTimeout: typeof clearTimeout;
        ____requestAnimationFrame: typeof requestAnimationFrame;
        ____Date: DateConstructor; // 被时间虚拟化改写前暂存的原生Date构造函数
        [key: string]: unknown;
    }

    // 内部工具包全局实例（由 bundle 入口挂载）
    var ____util: import("./inner-util").IInnerUtil;
    // mp4box 库全局（由 Page 从 MP4Box 转挂）
    var ____MP4Box: IMP4BoxGlobal;
    // mp4box DataStream 全局（vendor 脚本顶层 var 暴露）
    var DataStream: IDataStreamCtor;
    // lottie 动画库全局（由 Page 从 lottie 转挂）
    var ____lottie: ILottieGlobal;
    // 捕获上下文实例（由 bundle 入口创建）
    var captureCtx: import("./CaptureContext").default;

    // 被时间虚拟化改写前暂存的原生定时器函数
    var ____setInterval: typeof setInterval;
    var ____clearInterval: typeof clearInterval;
    var ____setTimeout: typeof setTimeout;
    var ____clearTimeout: typeof clearTimeout;
    var ____requestAnimationFrame: typeof requestAnimationFrame;
    var ____Date: DateConstructor;

    // puppeteer exposeFunction 注入的 Node 侧函数，调用返回 Promise
    function ____screencastCompleted(): Promise<void>;

    function ____seekCSSAnimations(currentTime: number): Promise<void>;

    function ____seekTimeActions(currentTime: number): Promise<void>;

    function ____skipFrame(): Promise<void>;

    function ____captureFrame(): Promise<boolean>;

    function ____addAudio(options: import("../lib/capture-ctx-api").IAudioAddPayload): Promise<void>;

    function ____updateAudioEndTime(audioId: number, endTime: number): Promise<void>;

    function ____throwError(code?: number, message?: string): Promise<void>;

    // 元素上的移除通知钩子（由媒体对象与捕获上下文写入）
    interface Node {
        ____onRemoved?: () => void;
    }

    // 由捕获上下文补充到元素原型上的数字/布尔属性读取方法
    interface Element {
        getNumberAttribute?(name: string): number | undefined;

        getBooleanAttribute?(name: string): boolean | undefined;
    }

    // 被时间虚拟化改写前暂存的原生 performance.now
    interface Performance {
        ____now(): number;
    }

    // 被控制台输出重写前暂存的原生 console 方法
    interface Console {
        ____log: (...data: unknown[]) => void;
        ____warn: (...data: unknown[]) => void;
        ____error: (...data: unknown[]) => void;
        ____debug: (...data: unknown[]) => void;
    }
}
