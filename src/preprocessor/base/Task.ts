import path from "path";
import crypto from "crypto";
import assert from "assert";
import {EventEmitter} from "eventemitter3";
import _ from "lodash";

// 任务选项
export interface ITaskOptions {
    retryCount?: number; // 重试次数
    retryDelay?: number; // 重试延迟（毫秒）
    ignoreCache?: boolean; // 是否忽略本地缓存
}

export default class Task extends EventEmitter {

    // 任务类型枚举
    public static TYPE = {
        UNKOWN: Symbol("UNKNOWN"), // 未知类型任务
        DOWNLOAD: Symbol("DOWNLOAD"), // 下载类型任务
        PROCESS: Symbol("PROCESS") // 处理类型任务
    };
    // 任务状态枚举
    public static STATE = {
        WAITING: Symbol("WAITING"), // 等待调度
        EXECUTING: Symbol("EXECUTING"), // 执行中
        COMPLETED: Symbol("COMPLETED") // 已完成
    }

    public id: string = crypto.randomUUID(); // 任务ID
    // 任务类型
    public type: symbol = Task.TYPE.UNKOWN;
    public state: symbol = Task.STATE.WAITING; // 任务状态
    public progress: number = 0; // 任务进度
    public retryCount: number; // 重试次数
    public retryDelay: number; // 重试延迟（毫秒）
    public errors: Error[] = []; // 错误列表
    public startupTime: number; // 启动时间点（毫秒）
    public errorTime: number; // 错误事件点（毫秒）
    public createTime: number = performance.now(); // 创建时间点（毫秒）
    public ignoreCache: boolean; // 是否忽略本地缓存
    protected tmpDirPath: string = path.resolve("tmp/preprocessor/"); // 临时路径

    // 构造函数
    constructor(options: ITaskOptions) {
        super();
        assert(_.isObject(options), "Task options must be Object");
        const {retryCount, retryDelay, ignoreCache} = options;
        assert(_.isUndefined(retryCount) || _.isFinite(retryCount), "retryCount must be number");
        assert(_.isUndefined(retryDelay) || _.isFinite(retryDelay), "retryDelay must be number");
        assert(_.isUndefined(ignoreCache) || _.isBoolean(ignoreCache), "ignoreCache must be boolean");
        this.retryCount = _.defaultTo(retryCount, 2);
        this.retryDelay = _.defaultTo(retryDelay, 1000);
        this.ignoreCache = ignoreCache || false;
    }

    // 启动任务
    public start(): void {
        this.setState(Task.STATE.EXECUTING);
        this.startupTime = performance.now();
    }

    // 更新进度
    protected _updateProgress(value: number): void {
        this.progress = Math.min(value, 100);
        this.emit("progress", this.progress);
    }

    // 发射已完成事件
    protected _emitCompleted(result: unknown): void {
        this.setState(Task.STATE.COMPLETED);
        this.emit("completed", result);
    }

    // 发送错误事件
    protected _emitError(err: Error): boolean | void {
        this.errors.push(err);
        this.errorTime = performance.now();
        if (this.errors.length <= this.retryCount) {
            // 设置为等待状态，等待调度
            this.setState(Task.STATE.WAITING);
            return;
        }
        return this.emit("error", err);
    }

    private setState(state: symbol): void {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    public canStart(): boolean {
        if (!this.isWaiting())
            return false;
        if (this.errors.length > this.retryCount)
            return false;
        if (performance.now() < this.errorTime + this.retryDelay)
            return false;
        return true;
    }

    public canRemove(): boolean {
        if (this.isCompleted())
            return true;
        if (this.errors.length > this.retryCount)
            return true;
        return false;
    }

    public isWaiting(): boolean {
        return this.state == Task.STATE.WAITING;
    }

    public isExecuting(): boolean {
        return this.state == Task.STATE.EXECUTING;
    }

    public isCompleted(): boolean {
        return this.state == Task.STATE.COMPLETED;
    }

}
