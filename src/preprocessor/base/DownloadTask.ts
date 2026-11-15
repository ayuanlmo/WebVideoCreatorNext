import path from "path";
import assert from "assert";
import fs from "fs-extra";
import _ from "lodash";
import AsyncLock from "async-lock";

import Task, {type ITaskOptions} from "./Task";
import util from "../../lib/util";

const downloadLock = new AsyncLock();

// 下载任务选项
export interface IDownloadTaskOptions extends ITaskOptions {
    url: string; // 资源URL
    retryFetchs?: number; // 重试下载次数
}

// 下载任务完成结果
export interface IDownloadResult {
    filePath: string; // 资源文件路径
    maskFilePath?: string; // 蒙版资源文件路径
}

export default class DownloadTask extends Task {

    // 任务类型
    public type: symbol = Task.TYPE.DOWNLOAD;
    public url: string; // 资源URL

    // 构造函数
    constructor(options: IDownloadTaskOptions) {
        super(options);
        const {url, retryFetchs} = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "retryFetchs must be number");
        this.url = url;
        this.retryCount = retryFetchs || 2;
    }

    // 启动任务
    public start(multiDownload: boolean = false): void {
        super.start();
        if (!multiDownload) {
            this._downloadFile(this.url)
                .then((filePath): void => this._emitCompleted({filePath}))
                .catch((err): boolean | void => this._emitError(err));
        }
    }

    // 下载文件
    protected async _downloadFile(url: string, mimesLimit?: (string | RegExp)[]): Promise<string> {
        const filePath = path.join(this.tmpDirPath, util.urlToPath(url));
        await downloadLock.acquire(String(util.crc32(url)), async (): Promise<string> => {
            if (!this.ignoreCache && await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath));
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(url, writeStream, {
                onProgress: (v): void => this._updateProgress(v),
                mimesLimit
            });
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

}
