import assert from "assert";
import _ from "lodash";

import DownloadTask, {type IDownloadResult, type IDownloadTaskOptions} from "./DownloadTask";
import ProcessTask from "./ProcessTask";
import {type ITaskOptions} from "./Task";
import logger from "../../lib/logger";

// 预处理器选项
export interface IPreprocessorOptions {
    parallelDownloads?: number; // 并行下载数量
    parallelProcess?: number; // 并行处理数量
}

// 预处理器
export default class Preprocessor {

    public parallelDownloads: number; // 并行下载数量
    public parallelProcess: number; // 并行处理数量
    private downloadQueue: DownloadTask[] = []; // 下载队列
    private processQueue: ProcessTask[] = []; // 处理队列
    private downloadQueueResumeCallback: (value?: unknown) => void = null; // 下载队列恢复回调函数
    private processQueueResumeCallback: (value?: unknown) => void = null; // 处理队列恢复回调函数
    public downloadTasks: DownloadTask[] = []; // 下载任务列表
    public processTasks: ProcessTask[] = []; // 处理任务列表

    // 构造函数
    constructor(options: IPreprocessorOptions) {
        assert(_.isObject(options), "VideoPreprocessor options must be Object");
        const {parallelDownloads, parallelProcess} = options;
        assert(_.isUndefined(parallelDownloads) || _.isFinite(parallelDownloads), "parallelDownloads must be number");
        assert(_.isUndefined(parallelProcess) || _.isFinite(parallelProcess), "parallelProcess must be number");
        this.parallelDownloads = _.defaultTo(parallelDownloads, 10);
        this.parallelProcess = _.defaultTo(parallelProcess, 10);
        // 调度下载队列
        this.dispatchDownloadQueue();
        // 调度处理队列
        this.dispatchProcessQueue();
        // 调度任务
        this.dispatchTasks();
    }

    // 发起处理
    public async process(options: object): Promise<unknown> {
        const downloadTask = this.createDownloadTask(options as IDownloadTaskOptions);
        const downloadResult: IDownloadResult = await new Promise<IDownloadResult>((resolve, reject): void => {
            downloadTask
                .once("completed", resolve)
                .once("error", reject);
        });
        const processTask = this.createProcessTask({...downloadResult, ...options});
        return await new Promise((resolve, reject): void => {
            processTask
                .once("completed", resolve)
                .once("error", reject);
        });
    }

    // 创建下载任务
    public createDownloadTask(options: IDownloadTaskOptions): DownloadTask {
        const task = new DownloadTask(options);
        this.addDownloadTask(task);
        return task;
    }

    // 添加处理任务
    public addDownloadTask(task: DownloadTask): void {
        assert(task instanceof DownloadTask, "task must be DownloadTask instance");
        this.downloadQueue.push(task);
        if (this.downloadQueueResumeCallback) {
            const fn = this.downloadQueueResumeCallback;
            this.downloadQueueResumeCallback = null;
            fn();
        }
    }

    // 创建处理任务
    public createProcessTask(options: object): ProcessTask {
        const task = new ProcessTask(options as ITaskOptions);
        this.addProcessTask(task);
        return task;
    }

    // 添加处理任务
    public addProcessTask(task: ProcessTask): void {
        assert(task instanceof ProcessTask, "task must be ProcessTask instace");
        this.processQueue.push(task);
        if (this.processQueueResumeCallback) {
            const fn = this.processQueueResumeCallback;
            this.processQueueResumeCallback = null;
            fn();
        }
    }

    // 调度下载队列
    private dispatchDownloadQueue(): void {
        (async (): Promise<void> => {
            const task = this.downloadQueue.shift();
            if (!task || this.downloadTasks.length >= this.parallelDownloads) {
                await new Promise((resolve): (value: unknown) => void => this.downloadQueueResumeCallback = resolve);
                return this.dispatchDownloadQueue();
            }
            this.downloadTasks.push(task);
            this.dispatchDownloadQueue();
        })()
            .catch((err): void => logger.error(err));
    }

    // 调度处理队列
    private dispatchProcessQueue(): void {
        (async (): Promise<void> => {
            const task = this.processQueue.shift();
            if (!task || this.processTasks.length >= this.parallelProcess) {
                await new Promise((resolve): (value: unknown) => void => this.processQueueResumeCallback = resolve);
                return this.dispatchProcessQueue();
            }
            this.processTasks.push(task);
            this.dispatchProcessQueue();
        })()
            .catch((err): void => logger.error(err));
    }

    // 任务调度
    private dispatchTasks(): void {
        try {
            this.downloadTasks = this.downloadTasks.filter((task): boolean => {
                if (task.canRemove())
                    return false;
                if (task.canStart())
                    task.start();
                return true;
            });
            if (this.downloadTasks.length < this.parallelDownloads) {
                if (this.downloadQueueResumeCallback) {
                    const fn = this.downloadQueueResumeCallback;
                    this.downloadQueueResumeCallback = null;
                    fn();
                }
            }
            this.processTasks = this.processTasks.filter((task): boolean => {
                if (task.canRemove())
                    return false;
                if (task.canStart())
                    task.start();
                return true;
            });
            if (this.processTasks.length < this.parallelProcess) {
                if (this.processQueueResumeCallback) {
                    const fn = this.processQueueResumeCallback;
                    this.processQueueResumeCallback = null;
                    fn();
                }
            }
            // 不阻塞进程退出
            setTimeout(this.dispatchTasks.bind(this), 0).unref();
        } catch (err) {
            logger.error(err);
        }
    }

}
