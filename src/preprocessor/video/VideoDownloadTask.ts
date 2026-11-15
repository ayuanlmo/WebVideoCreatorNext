import assert from "assert";
import _ from "lodash";
import DownloadTask, {type IDownloadTaskOptions} from "../base/DownloadTask";
import util from "../../lib/util";

// 视频下载任务选项
export interface IVideoDownloadTaskOptions extends IDownloadTaskOptions {
    maskUrl?: string; // 蒙版资源URL
}

export default class VideoDownloadTask extends DownloadTask {

    // 任务类型
    public type: symbol = DownloadTask.TYPE.DOWNLOAD;
    public maskUrl: string; // 蒙版资源URL

    // 构造函数
    constructor(options: IVideoDownloadTaskOptions) {
        super(options);
        const {url, maskUrl, retryFetchs} = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isUndefined(maskUrl) || _.isString(maskUrl), "maskUrl is invalid");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "retryFetchs must be number");
        this.url = url;
        this.maskUrl = maskUrl;
        this.retryCount = retryFetchs || 2;
    }

    // 启动任务
    public start(): void {
        if (!this.maskUrl)
            super.start();
        else {
            super.start(true);
            const mimesLimit = [
                /^video\//,
                /^application\/octet-stream/
            ];
            Promise.all([
                this._downloadFile(this.url, mimesLimit),
                this._downloadFile(this.maskUrl, mimesLimit)
            ])
                .then(([filePath, maskFilePath]): void => this._emitCompleted({filePath, maskFilePath}))
                .catch((err): boolean | void => this._emitError(err));
        }
    }

}
