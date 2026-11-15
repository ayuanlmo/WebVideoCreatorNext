import SvgAnimation from "./media/SvgAnimation";
import VideoCanvas from "./media/VideoCanvas";
import DynamicImage from "./media/DynamicImage";
import LottieCanvas from "./media/LottieCanvas";
import type {
    IAudioAddPayload,
    ICaptureAudioOptions,
    ICaptureContext,
    ICaptureContextConfig,
    IFetchOptions
} from "../lib/capture-ctx-api";

// 媒体调度列表成员（由元素转换产生的媒体对象）
type TDispatchMedia = SvgAnimation | VideoCanvas | DynamicImage | LottieCanvas;

// 虚拟化定时器条目：[定时器ID, 注册时间点, 间隔/超时时长, 回调]
type TTimerEntry = [timerId: number, timestamp: number, interval: number, callback: (currentTime?: number) => void];

// 元素代理目标：原元素的属性/方法集合动态镜像到新画布，无法逐一静态描述
interface IElementProxyTarget {
    remove(): void;

    [key: string]: unknown;
}

// 时间虚拟化改写的窗口表面（以虚拟时间实现替换原生定时器/Date）
interface IVirtualizedSurface {
    setInterval(callback: (currentTime?: number) => void, interval?: number): number | undefined;

    clearInterval(timerId: number | undefined): void;

    setTimeout(callback: (currentTime?: number) => void, timeout?: number): number | undefined;

    clearTimeout(timerId: number | undefined): void;

    requestAnimationFrame(callback: FrameRequestCallback): number | undefined;

    Date: DateConstructor;
}

// 捕获上下文
export default class CaptureContext implements ICaptureContext {

    // 媒体选择器
    public SVG_SELECTOR: string = "svg";
    public AUDIO_SELECTOR: string = 'audio[src$=".mp3"],audio[src$=".ogg"],audio[src$=".acc"],audio[src*=".mp3?"],audio[src*=".ogg?"],audio[src*=".aac?"],audio[src^="blob:"],audio[src^="data:"],audio:has(> source[src]),audio[capture]';
    public VIDEO_SELECTOR: string = 'video[src$=".mp4"],video[src$=".webm"],video[src$=".mkv"],video[src*=".mp4?"],video[src*=".webm?"],video[src*=".mkv?"],video[capture],canvas[video-capture]';
    public DYNAMIC_IMAGE_SELECTOR: string = 'img[src$=".gif"],img[src$=".webp"],img[src$=".apng"],img[src*=".gif?"],img[src*=".webp?"],img[src*=".apng?"],img[capture],canvas[dyimage-capture]';
    public LOTTIE_SELECTOR: string = "lottie,canvas[lottie-capture]";

    // 启动时间点（毫秒）
    public startTime: number = Date.now();
    // 当前时间点（毫秒）
    public currentTime: number = 0;
    // 当前帧指针
    public frameIndex: number = 0;
    // 帧间隔时间（毫秒）
    public frameInterval: number = 0;
    // 准备完毕标志
    public readyFlag: boolean = false;
    // 启动标志
    public startFlag: boolean = false;
    // 停止标志
    public stopFlag: boolean = false;
    // 暂停标志
    public pauseFlag: boolean = false;
    public readyTime: number; // 准备完毕时间点
    public readyCallback: (() => void) | null; // 准备完毕回调
    public resumeCallback: (() => void) | null = null; // 恢复回调
    public intervalCallbacks: TTimerEntry[] = []; // 间隔回调列表
    public timeoutCallbacks: TTimerEntry[] = []; // 超时回调列表
    // 计时器自增ID
    public timerId: number = 0;
    // 自增音频ID
    public audioId: number = 0;
    // 应用于Date对象的时间偏移HACK（处理mojs动画）
    public timeOffset: number = 0;
    public config: ICaptureContextConfig = { // 配置对象
        fps: null, // 渲染帧率
        startTime: 0, // 开始时间点
        duration: null, // 总时长
        frameCount: null // 目标总帧数
    };
    public dispatchMedias: TDispatchMedia[] = []; // 媒体调度列表（SvgAnimation | VideoCanvas | DynamicImage | LottieCanvas 实例）

    // 构造函数
    constructor() {
        // 控制台输出重写
        this._consoleRewrite();
        // 元素行为重写
        this._elementRewrite();
        // 时间虚拟化重写
        this._timeVirtualizationRewrite();
    }

    // 初始化上下文
    public init(): void {
        // 自动触发超时和间隔回调
        this._callTimeoutCallbacks();
        this._callIntervalCallbacks();
    }

    // 准备完毕
    public ready(): boolean {
        // 设置准备完毕标志为true
        this.readyFlag = true;
        // 设置准备完毕时的时间点
        this.readyTime = performance.____now();
        // 如果存在准备前的启动则调用
        if (this.readyCallback) {
            this.readyCallback();
            return true;
        }
        return false;
    }

    // 是否已经启动捕获
    public isCapturing(): boolean {
        return this.currentTime >= (this.config.startTime || 0);
    }

    // 开始捕获
    public start(): void {
        // 如果在准备完毕前启动则延迟到准备完毕再启动
        if (!this.readyFlag) {
            this.readyCallback = this.start;
            return;
        }
        // 检查配置
        this._checkConfig();
        // 插入捕获辅助元素
        this._insertCaptureHelper();
        // 转换元素为媒体元素
        this._convertElementsToMedias();
        // 监听媒体插入
        this._observMediaInsert();
        // 更新开始时间
        this.startTime = Date.now();
        // 计算帧间隔时间
        this.frameInterval = 1000 / this.config.fps;

        // 递归捕获帧
        (function nextFrame(): void {
            (async (): Promise<void> => {
                // 设置启动标志位
                if (!this.startFlag)
                    this.startFlag = true;
                // 如果已停止则跳出
                if (this.stopFlag)
                    return ____screencastCompleted();

                // 媒体调度
                const mediaRenderPromises = this.dispatchMedias.map((media): Promise<any> => (async (): Promise<any> => {
                    // 媒体可销毁时执行销毁
                    if (media.canDestory(this.currentTime))
                        return media.destory();
                    // 如媒体不可播放则跳过调度
                    if (!media.canPlay(this.currentTime))
                        return;
                    // 媒体未准备完毕时调用加载
                    if (!media.isReady()) {
                        // 加载媒体，如加载失败则跳过
                        if (!await media.load())
                            return;
                    }
                    const mediaCurrentTime = this.currentTime - media.startTime - (media.offsetTime || 0);
                    await media.seek(mediaCurrentTime > 0 ? mediaCurrentTime : 0);
                })());
                await Promise.all(mediaRenderPromises);

                // CSS动画调度                
                await ____seekCSSAnimations(this.currentTime);
                // 动作序列调度
                await ____seekTimeActions(this.currentTime);

                // 根据帧间隔推进当前时间
                this.currentTime += this.frameInterval;
                // 时间偏移HACK重置（处理mojs动画）
                this.timeOffset = 0;
                // 触发轮询回调列表
                this._callIntervalCallbacks(this.currentTime);
                // 触发超时回调列表
                this._callTimeoutCallbacks(this.currentTime);

                // 是否处于捕获中状态
                if (this.isCapturing()) {

                    // 捕获帧图 - 此函数请见Page.js的#envInit的exposeFunction
                    if (!await ____captureFrame()) {
                        this.stopFlag = true;
                        return;
                    }

                    // 遇到暂停标志时等待恢复
                    if (this.pauseFlag)
                        await new Promise((resolve): (value: unknown) => void => this.resumeCallback = resolve);
                    // 捕获帧数到达目标帧数时终止捕获
                    if (++this.frameIndex >= this.config.frameCount) {
                        this.stopFlag = true;
                        // 完成录制回调 - 此函数请见Page.js的#envInit的exposeFunction
                        return ____screencastCompleted();
                    }
                    // 如果未到达目标帧数但已被停止也触发录制完成
                    else if (this.stopFlag)
                        return ____screencastCompleted();

                }
                // 跳过无需捕获的帧
                else
                    await ____skipFrame();

                // 开始捕获下一帧
                nextFrame.bind(this)();
            })()
                .catch((err): void => console.error(err));
        }).bind(this)();
    }

    // 终止捕获
    public abort(): void {
        if (!this.isCapturing())
            return;
        this.stopFlag = true;
    }

    // 检查配置
    protected _checkConfig(): void {
        const {fps, duration, frameCount} = this.config;
        if (isNaN(fps) || fps <= 0)
            throw new Error(`config fps ${fps} is invalid`);
        if (isNaN(duration) || duration <= 0)
            throw new Error(`config duration ${duration} is invalid`);
        if (isNaN(frameCount) || frameCount <= 0)
            throw new Error(`config frameCount ${frameCount} is invalid`);
    }

    // 插入捕获辅助元素
    // BeginFrame可能会陷入假死，这个元素会不断旋转确保总是产生新的帧
    protected _insertCaptureHelper(): void {
        const captureHelper = document.createElement("capture-helper");
        // 设置几乎看不见的样式
        Object.assign(captureHelper.style, {
            width: "0.1px",
            height: "0.1px",
            opacity: 0.1,
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 999,
            backgroundColor: "#fff",
            transform: "rotate(0deg)"
        });
        // 加入到body中
        (document.body || document).appendChild(captureHelper);
        let rotate = 0;
        (function update(): void {
            rotate = rotate >= 360 ? 0 : (rotate + 0.1);
            captureHelper.style.transform = `rotate(${rotate}deg)`;
            // 如果已启动则高频更新，未启动时摸鱼
            if (this.startFlag)
                ____setTimeout(update.bind(this), 0);
            else
                ____setTimeout(update.bind(this), 1000);
        }).bind(this)();
    }

    // 转换元素为媒体对象
    protected _convertElementsToMedias(): void {
        const svgs = document.querySelectorAll<SVGSVGElement>(this.SVG_SELECTOR);
        const audios = document.querySelectorAll<HTMLAudioElement>(this.AUDIO_SELECTOR);
        const videos = document.querySelectorAll<HTMLVideoElement>(this.VIDEO_SELECTOR);
        const dynamicImages = document.querySelectorAll<HTMLImageElement>(this.DYNAMIC_IMAGE_SELECTOR);
        const lotties = document.querySelectorAll<HTMLElement>(this.LOTTIE_SELECTOR);
        svgs.forEach((e): SvgAnimation => captureCtx.convertToSvgAnimation(e));
        audios.forEach((e): void => captureCtx.convertToInnerAudio(e));
        videos.forEach((e): VideoCanvas => captureCtx.convertToVideoCanvas(e));
        dynamicImages.forEach((e): DynamicImage => captureCtx.convertToDynamicImage(e));
        lotties.forEach((e): LottieCanvas => captureCtx.convertToLottieCanvas(e));
    }

    // 监听媒体插入
    protected _observMediaInsert(): void {
        const observer = new MutationObserver((mutations: MutationRecord[]): void => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    if (mutation.addedNodes.length > 0) {
                        for (const addedNode of mutation.addedNodes) {
                            if (!(addedNode instanceof Element))
                                return;
                            if (addedNode.matches("canvas"))
                                break;
                            else if (addedNode.matches(this.SVG_SELECTOR))
                                this.convertToSvgAnimation(addedNode as SVGSVGElement);
                            else if (addedNode.matches(this.DYNAMIC_IMAGE_SELECTOR))
                                this.convertToDynamicImage(addedNode as HTMLImageElement);
                            else if (addedNode.matches(this.AUDIO_SELECTOR))
                                this.convertToInnerAudio(addedNode as HTMLAudioElement);
                            else if (addedNode.matches(this.VIDEO_SELECTOR))
                                this.convertToVideoCanvas(addedNode as HTMLVideoElement);
                            else if (addedNode.matches(this.LOTTIE_SELECTOR))
                                this.convertToLottieCanvas(addedNode as HTMLElement);
                        }
                    }
                    if (mutation.removedNodes.length > 0) {
                        for (const removedNode of mutation.removedNodes) {
                            // 通知节点移除
                            removedNode.____onRemoved && removedNode.____onRemoved();
                        }
                    }
                }
            }
        });
        observer.observe(document.body || document, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    // 控制台输出重写
    protected _consoleRewrite(): void {
        const getPrintFun = (fn: (...data: unknown[]) => void): (...args: unknown[]) => void => ((...args: unknown[]): void =>
            fn.bind(console)(args.reduce((t, v): string => {
                if (v instanceof Error)
                    return `${t}\n${v.stack} `;
                else if (v instanceof Object)
                    return `${t}${JSON.stringify(v)} `;
                return `${t}${String(v)} `;
            }, "")));
        console.____log = console.log;
        console.log = getPrintFun(console.____log);
        console.____warn = console.warn;
        console.warn = getPrintFun(console.____warn);
        console.____error = console.error;
        console.error = getPrintFun(console.____error);
        console.____debug = console.debug;
        console.debug = getPrintFun(console.____debug);
    }

    // 元素行为重写
    protected _elementRewrite(): void {
        // 支持获取html元素布尔属性
        HTMLElement.prototype.getBooleanAttribute = function (name: string): boolean {
            const value = this.getAttribute(name);
            if (value == null) return undefined;
            return value == "false" ? false : true;
        }
        // 支持获取html元素数字属性
        HTMLElement.prototype.getNumberAttribute = function (name: string): number {
            const value = this.getAttribute(name);
            if (value == null) return undefined;
            return Number(value);
        }
        // 支持获取svg元素数字属性
        SVGSVGElement.prototype.getNumberAttribute = function (name: string): number {
            const value = this.getAttribute(name);
            if (value == null) return undefined;
            return Number(value);
        }
    }

    // 时间虚拟化重写
    protected _timeVirtualizationRewrite(): void {
        const virtualWindow = window as unknown as IVirtualizedSurface;
        // 暂存setInterval函数
        window.____setInterval = window.setInterval;
        // 重写setInterval函数
        virtualWindow.setInterval = (fn: (currentTime?: number) => void, interval: number): number => {
            if (typeof fn !== "function" || isNaN(interval))
                return;
            this.timerId--;
            this.intervalCallbacks.push([this.timerId, this.currentTime, interval, fn]);
            return this.timerId;
        };
        // 暂存clearInterval函数
        window.____clearInterval = window.clearInterval;
        // 重写cleanInterval函数
        virtualWindow.clearInterval = (timerId: number | undefined): void => {
            if (!timerId) return;
            if (timerId >= 0)
                return window.____clearInterval(timerId);
            this.intervalCallbacks = this.intervalCallbacks.filter(([_timerId]): boolean => {
                if (_timerId == timerId)
                    return false;
                return true;
            });
        }
        // 暂存setTimeout函数
        window.____setTimeout = window.setTimeout;
        // 重写setTimeout函数
        virtualWindow.setTimeout = (fn: (currentTime?: number) => void, timeout: number = 0): number => {
            if (typeof fn !== "function" || isNaN(timeout))
                return;
            this.timerId--;
            this.timeoutCallbacks.push([this.timerId, this.currentTime, timeout, fn]);
            return this.timerId;
        };
        // 暂存clearTimeout函数
        window.____clearTimeout = window.clearTimeout;
        // 重写clearTimeout函数
        virtualWindow.clearTimeout = (timerId: number | undefined): void => {
            if (!timerId) return;
            if (timerId >= 0)
                return window.____clearTimeout(timerId);
            this.timeoutCallbacks = this.timeoutCallbacks.filter(([_timerId]): boolean => {
                if (_timerId == timerId)
                    return false;
                return true;
            });
        }
        // 暂存requestAnimationFrame函数
        window.____requestAnimationFrame = window.requestAnimationFrame;
        // 重写requestAnimationFrame，传递上下文提供的currentTime确保在非60fps捕获时实现帧率同步
        virtualWindow.requestAnimationFrame = (fn: FrameRequestCallback): number => {
            if (!this.startFlag)
                return setTimeout((currentTime): void => fn(currentTime as number), 0);
            if (this.stopFlag)
                return;
            // 下一个事件循环再调用
            return window.____requestAnimationFrame((): void => fn(this.currentTime));
        };
        // 暂存Date对象
        window.____Date = Date;
        const ctx = this;
        // 重写Date构造函数（lib DateConstructor 无任意参数透传签名，构造回退处以结构断言）
        virtualWindow.Date = function Date(...args: unknown[]): string | Date {
            if (new.target === undefined)
                return new window.____Date(ctx.startTime + ctx.currentTime).toString();
            if (args.length === 0)
                return new window.____Date(ctx.startTime + ctx.currentTime);
            return new (window.____Date as unknown as new (...args: unknown[]) => Date)(...args);
        } as unknown as DateConstructor;
        // 将挂载的函数
        Object.assign(window.Date, {
            prototype: window.____Date.prototype,
            now: (): number => Math.floor(this.startTime + this.currentTime) + (this.timeOffset += 0.01),
            parse: window.____Date.parse.bind(window.____Date),
            UTC: window.____Date.UTC.bind(window.____Date)
        });
        // 重写performance.now函数
        performance.____now = performance.now;
        performance.now = (): number => this.currentTime;
        // 启动前进行定时器调度，避免死锁
        (async (): Promise<void> => {
            (function dispatchBeforeStart(): void {
                // 如果已启动则不再调度，调度权交由nextFrame调度
                if (this.startFlag)
                    return;
                // 如果已准备完毕开始调度操作
                if (this.readyFlag) {
                    const currentTime = performance.____now() - this.readyTime;
                    this._callTimeoutCallbacks(currentTime);
                    this._callIntervalCallbacks(currentTime);
                    ____setTimeout(dispatchBeforeStart.bind(this), 0);
                }
                // 如果还未准备完毕则进行轮询检查
                else
                    ____setTimeout(dispatchBeforeStart.bind(this), 1000);
            }).bind(this)();
        })();
    }

    // 拼接完整URL
    protected _currentUrlJoin(relativeUrl: string): string {
        if (!relativeUrl || /^(https?:)?\/\//.test(relativeUrl))
            return relativeUrl;
        const currentURL = window.location.href;
        return new URL(relativeUrl, currentURL).href;
    }

    // 解析音频来源，blob来源转为data URI后再跨桥传输（Node侧无法访问blob URL）
    protected async _resolveAudioSource(url: string | undefined): Promise<string | undefined> {
        if (!url || url.indexOf("blob:") !== 0)
            return url;
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject): void => {
            const reader = new FileReader();
            reader.onload = (): void => resolve(String(reader.result));
            reader.onerror = (): void => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    // 触发轮询函数回调
    protected _callIntervalCallbacks(currentTime?: number): void {
        if (this.intervalCallbacks.length == 0)
            return;
        for (let i = 0; i < this.intervalCallbacks.length; i++) {
            const [, timestamp, interval, fn] = this.intervalCallbacks[i];
            if (currentTime < timestamp + interval)
                continue;
            this.intervalCallbacks[i][1] = currentTime;
            // 下一个事件循环再调用
            ____setTimeout((): void => fn(currentTime), 0);
        }
    }

    // 触发超时函数回调
    protected _callTimeoutCallbacks(currentTime?: number): void {
        if (this.timeoutCallbacks.length == 0)
            return;
        this.timeoutCallbacks = this.timeoutCallbacks.filter(([, timestamp, timeout, fn]): boolean => {
            if (currentTime < timestamp + timeout)
                return true;
            // 下一个事件循环再调用
            ____setTimeout((): void => fn(currentTime), 0);
            return false;
        });
    }

    // 创建画布
    protected _createCanvas(options: {
        id?: string;
        class?: string;
        width?: number;
        height?: number
    }): HTMLCanvasElement {
        const {id, class: _class, width, height} = options;
        const canvas = document.createElement("canvas");
        id && canvas.setAttribute("id", id);
        _class && canvas.setAttribute("class", _class);
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // 添加音频
    public addAudio(options: ICaptureAudioOptions = {}): void {
        const audioId = this.audioId++;
        void (async (): Promise<void> => {
            const payload: IAudioAddPayload = {audioId, ...options};
            if (payload.url)
                payload.url = await this._resolveAudioSource(this._currentUrlJoin(payload.url));
            void ____addAudio(payload);
        })().catch((err: unknown): void => console.error(err));
    }

    // 添加多个音频
    public addAudios(audios: ICaptureAudioOptions[] = []): void {
        audios.forEach((audio): void => this.addAudio(audio));
    }

    // 转化为SVG动画对象
    public convertToSvgAnimation(e: SVGSVGElement): SvgAnimation {
        const hasAnimation = e.querySelector("animate, animateTransform, animateMotion, animateColor");
        // 未找到任何动画元素则不做处理，这些SVG元素可能是静态的或者由其它动画库控制
        if (!hasAnimation)
            return null;
        const options = {
            // SVG元素
            target: e,
            // 动画播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 动画播放结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration)
        };
        // 实例化SVG动画对象
        const svgAnimation = new SvgAnimation(options);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(svgAnimation);
        return svgAnimation;
    }

    // 将HTML视频元素转换为内部合成音频
    public convertToInnerAudio(e: HTMLAudioElement): void {
        // 获取seek时间
        const currentTimeAttribute = e.getNumberAttribute("currentTime");
        const audioId = this.audioId++;
        // 兼容<source>子元素指定的音频来源
        const sourceElement = e.querySelector("source[src]");
        const src = e.getAttribute("src") || (sourceElement ? sourceElement.getAttribute("src") : null);
        const options = {
            // 内部音频唯一ID
            id: audioId,
            // 音频来源
            url: this._currentUrlJoin(src) || undefined,
            // 音频格式
            format: e.getAttribute("format") || undefined,
            // 音频开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 音频结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 音频裁剪开始时间点（毫秒）
            seekStart: e.getNumberAttribute("seek-start") || e.getNumberAttribute("seekStart") || (currentTimeAttribute ? currentTimeAttribute * 1000 : undefined),
            // 音频裁剪结束时间点（毫秒）
            seekEnd: e.getNumberAttribute("seek-end") || e.getNumberAttribute("seekEnd"),
            // 音频淡入时长（毫秒）
            fadeInDuration: e.getNumberAttribute("fade-in-duration") || e.getNumberAttribute("fadeInDuration"),
            // 音频淡出时长（毫秒）
            fadeOutDuration: e.getNumberAttribute("fade-out-duration") || e.getNumberAttribute("fadeOutDuration"),
            // 音频音量
            volume: (e.getNumberAttribute("volume") || e.volume || 1) * 100,
            // 音频是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 音频是否自动播放
            autoplay: e.getBooleanAttribute("autoplay"),
            // 音频是否静音
            muted: e.getBooleanAttribute("muted"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs"),
            // 是否忽略本地缓存
            ignoreCache: e.getBooleanAttribute("ignore-cache") || e.getBooleanAttribute("ignoreCache")
        };
        e.____onRemoved = (): void => void ____updateAudioEndTime(audioId, this.currentTime);
        void (async (): Promise<void> => {
            options.url = await this._resolveAudioSource(options.url);
            void ____addAudio(options);
        })().catch((err: unknown): void => console.error(err));
    }

    // 将HTML视频元素转换为视频画布
    public convertToVideoCanvas(e: HTMLVideoElement): VideoCanvas {
        // 获取seek时间
        const currentTimeAttribute = e.getNumberAttribute("currentTime");
        const options = {
            // 元素ID
            id: e.getAttribute("id") || undefined,
            // 元素类名
            class: e.getAttribute("class") || undefined,
            // 内部音频唯一ID
            audioId: this.audioId++,
            // 视频来源
            url: this._currentUrlJoin(e.getAttribute("src")) || undefined,
            // 蒙版视频来源
            maskUrl: this._currentUrlJoin(e.getAttribute("_maskSrc") || e.getAttribute("maskSrc")) || undefined,
            // 视频格式
            format: e.getAttribute("format") || undefined,
            // 视频宽度
            width: e.getNumberAttribute("width") || e.width,
            // 视频高度
            height: e.getNumberAttribute("height") || e.height,
            // 视频开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 视频结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 音频淡入时长（毫秒）
            fadeInDuration: e.getNumberAttribute("fade-in-duration") || e.getNumberAttribute("fadeInDuration"),
            // 音频淡出时长（毫秒）
            fadeOutDuration: e.getNumberAttribute("fade-out-duration") || e.getNumberAttribute("fadeOutDuration"),
            // 视频裁剪开始时间点（毫秒）
            seekStart: e.getNumberAttribute("seek-start") || e.getNumberAttribute("seekStart") || (currentTimeAttribute ? currentTimeAttribute * 1000 : undefined),
            // 视频裁剪结束时间点（毫秒）
            seekEnd: e.getNumberAttribute("seek-end") || e.getNumberAttribute("seekEnd"),
            // 视频是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 视频音频音量
            volume: (e.getNumberAttribute("volume") || e.volume || 1) * 100,
            // 视频是否自动播放
            autoplay: e.getBooleanAttribute("autoplay"),
            // 解码器硬件加速方法提示
            hardwareAcceleration: this.config.videoDecoderHardwareAcceleration,
            // 视频是否静音
            muted: e.getBooleanAttribute("muted"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs"),
            // 是否忽略本地缓存
            ignoreCache: e.getBooleanAttribute("ignore-cache") || e.getBooleanAttribute("ignoreCache"),
        };
        let canvas: HTMLCanvasElement;
        if (!(e instanceof HTMLCanvasElement)) {
            // 创建画布元素
            canvas = this._createCanvas(options);
            // 复制目标元素样式
            this._copyElementStyle(e, canvas);
            // 代理目标元素所有属性和行为
            this._buildElementProxy(e, canvas);
            // 将目标元素替换为画布
            e.replaceWith(canvas);
        } else {
            canvas = e;
            canvas.width = 0;
            canvas.height = 0;
        }
        // 实例化视频画布实例
        const videoCanvas = new VideoCanvas(options);
        // 绑定画布元素
        videoCanvas.bind(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(videoCanvas);
        return videoCanvas;
    }

    // 将HTML图像元素转换为动态图像
    public convertToDynamicImage(e: HTMLImageElement): DynamicImage {
        const options = {
            // 元素ID
            id: e.getAttribute("id") || undefined,
            // 元素类名
            class: e.getAttribute("class") || undefined,
            // 图像来源
            url: this._currentUrlJoin(e.getAttribute("src")) || undefined,
            // 图像格式
            format: e.getAttribute("format") || undefined,
            // 图像宽度
            width: e.getNumberAttribute("width") || e.width,
            // 图像高度
            height: e.getNumberAttribute("height") || e.height,
            // 图像播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 图像播放结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs")
        };
        let canvas: HTMLCanvasElement;
        if (!(e instanceof HTMLCanvasElement)) {
            // 创建画布元素
            canvas = this._createCanvas(options);
            // 复制目标元素样式
            this._copyElementStyle(e, canvas);
            // 代理目标元素所有属性和行为
            this._buildElementProxy(e, canvas);
            // 将目标元素替换为画布
            e.replaceWith(canvas);
        } else {
            canvas = e;
            canvas.width = 0;
            canvas.height = 0;
        }
        // 实例化动态图像实例
        const dynamicImage = new DynamicImage(options);
        // 绑定画布元素
        dynamicImage.bind(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(dynamicImage);
        return dynamicImage;
    }

    // 将HTMLLottie元素转换为Lottie画布
    public convertToLottieCanvas(e: HTMLElement): LottieCanvas {
        const options = {
            // 元素ID
            id: e.getAttribute("id") || undefined,
            // 元素类名
            class: e.getAttribute("class") || undefined,
            // lottie来源
            url: this._currentUrlJoin(e.getAttribute("src")) || undefined,
            // 动画宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width"),
            // 动画宽度
            height: parseInt(e.style.height) || e.getNumberAttribute("height"),
            // 动画播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 动画播放结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs")
        };
        let canvas: HTMLCanvasElement;
        if (!(e instanceof HTMLCanvasElement)) {
            // 创建画布元素
            canvas = this._createCanvas(options);
            // 复制目标元素样式
            this._copyElementStyle(e, canvas);
            // 代理目标元素所有属性和行为
            this._buildElementProxy(e, canvas)
            // 将目标元素替换为画布
            e.replaceWith(canvas);
        } else {
            canvas = e;
            canvas.width = 0;
            canvas.height = 0;
        }
        // 实例化Lottie动画实例
        const lottieCanvas = new LottieCanvas(options);
        // 绑定画布元素
        lottieCanvas.bind(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(lottieCanvas);
        return lottieCanvas;
    }

    // 抛出错误中断捕获
    public throwError(code: number, message: string): void {
        void ____throwError(code, message);
    }

    // 复制元素样式
    protected _copyElementStyle(source: HTMLElement, target: HTMLElement): void {
        const sourceStyle = window.getComputedStyle(source);
        for (let i = 0; i < sourceStyle.length; i++) {
            const property = sourceStyle[i];
            const value = sourceStyle.getPropertyValue(property);
            target.style.setProperty(property, value);
        }
    }

    // 建立元素代理
    // 将对旧元素的所有行为代理到新元素
    protected _buildElementProxy(source: HTMLElement, _target: HTMLElement): void {
        // 原元素属性/方法集合动态镜像到新画布（目标属性无法逐一静态描述）
        const target = _target as unknown as IElementProxyTarget;
        // 监听元素
        Object.defineProperties(source, {
            textContent: {get: (): unknown => target.textContent, set: v => target.textContent = v},
            innerHTML: {get: (): unknown => target.innerHTML, set: v => target.innerHTML = v},
            innerText: {get: (): unknown => target.innerText, set: v => target.innerText = v},
            setHTML: {get: (): unknown => target.setHTML, set: v => target.setHTML = v},
            getInnerHTML: {get: (): unknown => target.getInnerHTML, set: v => target.getInnerHTML = v},
            getRootNode: {get: (): unknown => target.getRootNode, set: v => target.getRootNode = v},
            value: {get: (): unknown => target.value, set: v => target.value = v},
            style: {get: (): unknown => target.style, set: v => target.style = v},
            src: {get: (): unknown => target.src, set: v => target.src = v},
            classList: {get: (): unknown => target.classList, set: v => target.classList = v},
            className: {get: (): unknown => target.className, set: v => target.className = v},
            hidden: {get: (): unknown => target.hidden, set: v => target.hidden = v},
            animate: {get: (): unknown => target.animate, set: v => target.animate = v},
            attributes: {get: (): unknown => target.attributes, set: v => target.attributes = v},
            childNodes: {get: (): unknown => target.childNodes, set: v => target.childNodes = v},
            children: {get: (): unknown => target.children, set: v => target.children = v},
            addEventListener: {get: (): unknown => target.addEventListener, set: v => target.addEventListener = v},
            removeEventListener: {
                get: (): unknown => target.removeEventListener,
                set: v => target.removeEventListener = v
            },
            append: {get: (): unknown => target.append, set: v => target.append = v},
            appendChild: {get: (): unknown => target.appendChild, set: v => target.appendChild = v},
            prepend: {get: (): unknown => target.prepend, set: v => target.prepend = v},
            replaceChild: {get: (): unknown => target.replaceChild, set: v => target.replaceChild = v},
            replaceChildren: {get: (): unknown => target.replaceChildren, set: v => target.replaceChildren = v},
            removeChild: {get: (): unknown => target.removeChild, set: v => target.removeChild = v},
            blur: {get: (): unknown => target.blur, set: v => target.blur = v},
            title: {get: (): unknown => target.title, set: v => target.title = v},
            toString: {get: (): () => string => target.toString, set: v => target.toString = v},
            autofocus: {get: (): unknown => target.autofocus, set: v => target.autofocus = v},
            parentElement: {get: (): unknown => target.parentElement, set: v => target.parentElement = v},
            parentNode: {get: (): unknown => target.parentNode, set: v => target.parentNode = v},
            clientWidth: {get: (): unknown => target.clientWidth, set: v => target.clientWidth = v},
            clientHeight: {get: (): unknown => target.clientHeight, set: v => target.clientHeight = v},
            clientTop: {get: (): unknown => target.clientTop, set: v => target.clientTop = v},
            clientLeft: {get: (): unknown => target.clientLeft, set: v => target.clientLeft = v},
            removeAttribute: {get: (): unknown => target.removeAttribute, set: v => target.removeAttribute = v},
            removeAttributeNode: {
                get: (): unknown => target.removeAttributeNode,
                set: v => target.removeAttributeNode = v
            },
            removeAttributeNS: {get: (): unknown => target.removeAttributeNS, set: v => target.removeAttributeNS = v},
            setAttribute: {get: (): unknown => target.setAttribute, set: v => target.setAttribute = v},
            setAttributeNS: {get: (): unknown => target.setAttributeNS, set: v => target.setAttributeNS = v},
            setAttributeNode: {get: (): unknown => target.setAttributeNode, set: v => target.setAttributeNode = v},
            setAttributeNodeNS: {
                get: (): unknown => target.setAttributeNodeNS,
                set: v => target.setAttributeNodeNS = v
            },
            getAttributeNames: {get: (): unknown => target.getAttributeNames, set: v => target.getAttributeNames = v},
            getAttribute: {get: (): unknown => target.getAttribute, set: v => target.getAttribute = v},
            getAttributeNS: {get: (): unknown => target.getAttributeNS, set: v => target.getAttributeNS = v},
            getAttributeNode: {get: (): unknown => target.getAttributeNode, set: v => target.getAttributeNode = v},
            getAttributeNodeNS: {
                get: (): unknown => target.getAttributeNodeNS,
                set: v => target.getAttributeNodeNS = v
            },
            hasAttribute: {get: (): unknown => target.hasAttribute, set: v => target.hasAttribute = v},
            hasAttributeNS: {get: (): unknown => target.hasAttributeNS, set: v => target.hasAttributeNS = v},
            hasAttributes: {get: (): unknown => target.hasAttributes, set: v => target.hasAttributes = v},
            // 上游在此键之后还重复声明了一次 hasChildNodes（对象字面量后者覆盖前者，无行为差异），此处只声明一次
            hasChildNodes: {get: (): unknown => target.hasChildNodes, set: v => target.hasChildNodes = v},
            hasOwnProperty: {
                get: (): (v: PropertyKey) => boolean => target.hasOwnProperty,
                set: v => target.hasOwnProperty = v
            },
            offsetParent: {get: (): unknown => target.offsetParent, set: v => target.offsetParent = v},
            offsetTop: {get: (): unknown => target.offsetTop, set: v => target.offsetTop = v},
            offsetLeft: {get: (): unknown => target.offsetLeft, set: v => target.offsetLeft = v},
            offsetWidth: {get: (): unknown => target.offsetWidth, set: v => target.offsetWidth = v},
            offsetHeight: {get: (): unknown => target.offsetHeight, set: v => target.offsetHeight = v},
            getAnimations: {get: (): unknown => target.getAnimations, set: v => target.getAnimations = v},
            scroll: {get: (): unknown => target.scroll, set: v => target.scroll = v},
            scrollBy: {get: (): unknown => target.scrollBy, set: v => target.scrollBy = v},
            scrollIntoView: {get: (): unknown => target.scrollIntoView, set: v => target.scrollIntoView = v},
            scrollIntoViewIfNeeded: {
                get: (): unknown => target.scrollIntoViewIfNeeded,
                set: v => target.scrollIntoViewIfNeeded = v
            },
            scrollTop: {get: (): unknown => target.scrollTop, set: v => target.scrollTop = v},
            scrollLeft: {get: (): unknown => target.scrollLeft, set: v => target.scrollLeft = v},
            scrollWidth: {get: (): unknown => target.scrollWidth, set: v => target.scrollWidth = v},
            scrollHeight: {get: (): unknown => target.scrollHeight, set: v => target.scrollHeight = v},
            dataset: {get: (): unknown => target.dataset, set: v => target.dataset = v},
            insert: {get: (): unknown => target.insert, set: v => target.insert = v},
            insertBefore: {get: (): unknown => target.insertBefore, set: v => target.insertBefore = v},
            before: {get: (): unknown => target.before, set: v => target.before = v},
            firstChild: {get: (): unknown => target.firstChild, set: v => target.firstChild = v},
            firstElementChild: {get: (): unknown => target.firstElementChild, set: v => target.firstElementChild = v},
            lastChild: {get: (): unknown => target.lastChild, set: v => target.lastChild = v},
            lastElementChild: {get: (): unknown => target.lastElementChild, set: v => target.lastElementChild = v},
            closest: {get: (): unknown => target.closest, set: v => target.closest = v},
            valueOf: {get: (): () => Object => target.valueOf, set: v => target.valueOf = v},
            click: {get: (): unknown => target.click, set: v => target.click = v},
            cloneNode: {get: (): unknown => target.cloneNode, set: v => target.cloneNode = v},
            nodeName: {get: (): unknown => target.nodeName, set: v => target.nodeName = v},
            nodeType: {get: (): unknown => target.nodeType, set: v => target.nodeType = v},
            nodeValue: {get: (): unknown => target.nodeValue, set: v => target.nodeValue = v},
            normalize: {get: (): unknown => target.normalize, set: v => target.normalize = v},
            matches: {get: (): unknown => target.matches, set: v => target.matches = v},
            play: {
                get: (): () => void => (): void => {
                }
            },
            pause: {
                get: (): () => void => (): void => {
                }
            }
        });
        source.remove = (): void => target.remove();
    }

    // 拉取响应
    public async fetch(url: string, options: IFetchOptions = {}, _retryIndex: number = 0): Promise<Response | null> {
        const {retryFetchs = 2, retryDelay = 500, ...fetchOptions} = options;
        return await new Promise((resolve, reject): void => {
            fetch(url, fetchOptions)
                .then(async (response): Promise<void> => {
                    if (response.status >= 500)
                        throw new Error(`Failed to load resource: [${fetchOptions.method || "GET"}] ${response.url} - [${response.status}] ${response.statusText}\n${await response.text()}`);
                    else if (response.status >= 400)
                        resolve(null);
                    else
                        resolve(response);
                })
                .catch((err): void => {
                    if (_retryIndex >= retryFetchs)
                        reject(err);
                    else
                        ____setTimeout((): Promise<Response> => this.fetch(url, options, _retryIndex + 1), retryDelay);
                });
        });
    }

}
