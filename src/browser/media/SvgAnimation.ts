import innerUtil from "../inner-util";

const ____util = innerUtil();

// SVG动画选项
export interface ISvgAnimationOptions {
    target: SVGSVGElement; // SVG元素
    startTime: number; // 开始时间点（毫秒）
    endTime: number; // 结束时间点（毫秒）
}

// SVG动画
export default class SvgAnimation {

    public startTime: number; // 开始时间点（毫秒）
    public endTime: number; // 结束时间点（毫秒）
    public target: SVGSVGElement; // SVG元素
    public repetitionIndex: number = 0; // 重复索引
    public destoryed: boolean = false; // 是否已销毁

    // 构造函数
    constructor(options: ISvgAnimationOptions) {
        const u = ____util;
        u.assert(u.isObject(options), "SvgAnimation options must be Object");
        const {target, startTime, endTime} = options;
        u.assert(target instanceof SVGSVGElement, "target must be SVGSVGElement");
        u.assert(u.isNumber(startTime), "startTime must be number");
        u.assert(u.isNumber(endTime), "endTime must be number");
        this.target = target;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    // 判断当前时间点是否可播放
    public canPlay(time: number): boolean {
        // 已销毁不可播放
        if (this.destoryed) return false;
        // 如果当前时间超过元素开始结束时间则判定为不可播放
        const {startTime, endTime = Infinity} = this;
        if (time < startTime || time >= endTime)
            return false;
        return true;
    }

    // 加载动画
    public load(): boolean {
        try {
            // 停止SVG动画播放，后续由内部调度渲染
            this.target.pauseAnimations();
            return true;
        } catch (err) {
            console.error(err);
            this.destory();
            return false;
        }
    }

    // 是否准备完毕
    public isReady(): boolean {
        // SVG动画已暂停时才可以调度
        return this.target.animationsPaused();
    }

    // 索引帧并绘制
    public async seek(time: number): Promise<void> {
        // 设置SVG动画时间点
        this.target.setCurrentTime(time / 1000);
    }

    // 判断是否可销毁
    public canDestory(time: number): boolean {
        // 已销毁则避免重复销毁
        if (this.destoryed) return false;
        // 返回当前时间是否大于结束时间
        return time >= this.endTime;
    }

    // 销毁SVG动画
    public destory(): void {
        this.target = null;
        this.destoryed = true;
    }

}
