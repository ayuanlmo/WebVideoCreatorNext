import innerUtil from "../inner-util";

const ____util = innerUtil();

// 动态图像选项
export interface IDynamicImageOptions {
    id?: string; // 元素ID
    class?: string; // 元素类名
    url: string; // 图像来源
    format?: string; // 图像格式（gif/webp/apng）
    width?: number; // 图像宽度
    height?: number; // 图像高度
    startTime: number; // 开始播放时间点（毫秒）
    endTime: number; // 结束播放时间（毫秒）
    loop?: boolean; // 是否强制循环
    retryFetchs?: number; // 重试下载次数
}

// 上游 seek() 中画布尺寸初始化分支引用了未定义的 config 标识符（运行时抛出 ReferenceError）。
// 按 1:1 约束保留该行为：此处用仅类型（ambient）声明使标识符在运行时仍解析为全局查找，
// 从而与上游字符串注入后的 ReferenceError 完全一致，不做“修复”。
declare const config: { codedWidth: number; codedHeight: number };

// 动态图像
export default class DynamicImage {

    public url: string; // 图像来源
    public format: string; // 图像格式（gif/webp/apng）
    public startTime: number; // 开始播放时间点（毫秒）
    public endTime: number; // 结束播放时间（毫秒）
    public loop: boolean; // 是否强制循环
    public retryFetchs: number; // 重试下载次数
    public frameIndex: number = 0; // 帧索引
    public repetitionIndex: number = 0; // 重复索引
    public currentTime: number = 0; // 当前播放时间点（毫秒）
    public canvas: HTMLCanvasElement = null; // 画布元素
    public canvasCtx: CanvasRenderingContext2D = null; // 画布2D渲染上下文
    public lastFrameTimestamp: number = null; // 上一帧时间戳（毫秒）
    public lastFrameDuration: number = null; // 上一帧时长（毫秒）
    public errorCallback: (err: Error) => void; // 错误回调函数
    public decoder: ImageDecoder = null; // 图像解码器（ImageDecoder）
    public removed: boolean = false; // 是否被移除
    public destoryed: boolean = false; // 是否已销毁

    // 构造函数
    constructor(options: IDynamicImageOptions) {
        const u = ____util;
        u.assert(u.isObject(options), "DynamicImage options must be Object");
        const {url, format, startTime, endTime, loop, retryFetchs} = options;
        u.assert(u.isString(url), "url must be string");
        u.assert(u.isNumber(startTime), "startTime must be number");
        u.assert(u.isNumber(endTime), "endTime must be number");
        u.assert(u.isUndefined(format) || u.isString(format), "format must be string");
        u.assert(u.isUndefined(loop) || u.isBoolean(loop), "loop must be boolean");
        u.assert(u.isUndefined(retryFetchs) || u.isNumber(retryFetchs), "retryFetchs must be number");
        this.url = url;
        this.startTime = startTime;
        this.endTime = endTime;
        this.format = format;
        this.loop = loop;
        this.retryFetchs = u.defaultTo(retryFetchs, 2);
    }

    // 绑定画布元素
    public bind(canvas: HTMLCanvasElement, options: ICanvasOptions = {}): void {
        const {alpha = true, imageSmoothingEnabled = true} = options;
        this.canvas = canvas;
        this.canvas.____onRemoved = (): boolean => this.removed = true;
        // 获取画布2D上下文
        this.canvasCtx = this.canvas.getContext("2d", {alpha}) as CanvasRenderingContext2D;
        // 设置抗锯齿开关
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
    }

    // 判断当前时间点是否可播放
    public canPlay(time: number): boolean {
        // 已销毁不可播放
        if (this.destoryed) return false;
        // 如果当前时间超过元素开始结束时间则判定未不可播放
        const {startTime, endTime} = this;
        if (time < startTime || time >= endTime)
            return false;
        return true;
    }

    // 加载图像
    public async load(): Promise<boolean> {
        try {
            // 下载图像数据
            const response = await captureCtx.fetch(this.url, {retryFetchs: this.retryFetchs});
            // 如果获得null可能响应存在问题，直接销毁对象，具体错误报告由Page.js的响应拦截器处理
            if (!response) {
                this.destory();
                return false;
            }
            // 获取MIME类型
            let contentType = response.headers.get("Content-Type") || response.headers.get("content-type");
            if (!contentType)
                throw new Error(`image Content-Type unknown is not supported`);
            contentType = contentType.split(";")[0];
            // 检查图像解码器是否是否支持此图像类型
            if (!await ImageDecoder.isTypeSupported(contentType))
                throw new Error(`image type ${contentType} is not supported`);
            // 实例化图像解码器
            this.decoder = new ImageDecoder({
                // MIME类型
                type: contentType,
                // 图像数据
                data: response.body
            });
            // 等待数据完成加载
            await this.decoder.completed;
            return true;
        } catch (err) {
            console.error(err);
            this.destory();
            return false;
        }
    }

    // 是否准备完毕
    public isReady(): boolean {
        return !!this.decoder;
    }

    // 索引帧并绘制
    public async seek(time: number): Promise<void> {
        // 已销毁不可索引
        if (this.destoryed) return;
        // 如果元素已移除或当前图像不循环且播放结束则不再索引
        if (this.removed || (!this.loop && this.isEnd())) return;
        // 获取图像轨道
        const track = this.getSelectedTrack();
        // 无可用图像轨道将跳过处理
        if (!track) return;
        // 当解码完成且帧索引指向最后一帧时重置帧指针
        if (this.decoder.complete && this.frameIndex >= track.frameCount + 1)
            this.reset();
        // 当存在上一帧且上一帧未完成停留时长前将跳过绘制下一帧，节约重绘频次
        if (time !== 0 && this.lastFrameDuration && time < (this.lastFrameTimestamp + this.lastFrameDuration)) {
            this.currentTime = time;
            return;
        }
        // 等待帧解码
        const result: ImageDecodeResult = await new Promise<ImageDecodeResult>((resolve, reject): void => {
            // 解码该帧图像
            this.decoder.decode({frameIndex: this.frameIndex++})
                .then(resolve)
                .catch((err): void => {
                    // 为效率考虑解码和绘制是同时进行的，如绘制快于解码时可能出现超出帧范围需容错处理
                    if (err instanceof RangeError) {
                        // 重置帧索引
                        this.reset();
                        // 等待30毫秒后再触发resolve，避免后续疯狂递归
                        ____setTimeout(resolve, 30);
                    }
                    // 其它错误抛出
                    else
                        reject(err);
                });
        });
        // 如果因重置未解码任何帧将重新seek
        if (!result) return this.seek(time);
        // 如未解码出任何图像帧将跳过该时间点
        if (!result.image) return;
        const frame = result.image;
        const {displayWidth, displayHeight} = frame;
        // 画布宽度为0时使用解码宽度初始化
        if (this.canvas.width === 0)
            this.canvas.width = config.codedWidth;
        // 画布高度为0时使用解码高度初始化
        if (this.canvas.height === 0)
            this.canvas.height = config.codedHeight;
        // 清除上一帧画面
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // 绘制当前帧
        this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
        // 记录当前帧时长
        this.lastFrameDuration = frame.duration / 1000;
        // 记录当前帧时间戳
        this.lastFrameTimestamp = time;
        // 更新当前时间点
        this.currentTime = time;
    }

    // 判断动画是否已结束
    public isEnd(): boolean {
        // 获取图像轨道
        const track = this.getSelectedTrack();
        // 无可用图像轨道将返回已结束
        if (!track) return true;
        // 如果强制不循环将只播放一次
        if (this.loop === false)
            return this.repetitionIndex >= 1;
        // 其它情况遵循文件自身重复次数
        return this.repetitionIndex >= track.repetitionCount + 1;
    }

    // 判断是否可销毁
    public canDestory(time: number): boolean {
        // 已销毁则避免重复销毁
        if (this.destoryed) return false;
        // 返回当前时间是否大于结束时间
        return time >= this.endTime;
    }

    // 重置图像状态
    public reset(): void {
        // 播放进度重置
        this.currentTime = 0;
        // 帧索引重置
        this.frameIndex = 0;
        // 上一帧时间戳重置
        this.lastFrameTimestamp = null;
        // 上一帧时长重置
        this.lastFrameDuration = null;
        // 重复次数自增1
        this.repetitionIndex++;
    }

    // 注册错误回调函数
    public onError(callback: (err: Error) => void): void {
        this.errorCallback = callback;
    }

    // 获取已选取轨道
    public getSelectedTrack(): ImageTrack | null {
        return this.decoder.tracks.selectedTrack;
    }

    // 销毁动态图像实例
    public destory(): void {
        // 如果解码器存在则先关闭解码器
        this.decoder && this.decoder.close();
        this.decoder = null;
        // 重置图像
        this.reset();
        this.repetitionIndex = 0;
        if (this.canvas)
            this.canvas.style.display = "none";
        this.canvas = null;
        this.canvasCtx = null;
        // 设置已销毁
        this.destoryed = true;
    }

}
