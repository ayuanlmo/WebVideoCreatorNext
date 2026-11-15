import assert from "assert";
import _ from "lodash";

import Preprocessor, {type IPreprocessorOptions} from "../base/Preprocessor";
import VideoDownloadTask, {type IVideoDownloadTaskOptions} from "./VideoDownloadTask";
import VideoProcessTask, {type IVideoProcessResult, type IVideoProcessTaskOptions} from "./VideoProcessTask";
import VideoConfig from "./VideoConfig";
import {VIDEO_ENCODER, VIDEO_ENCODER_MAP} from "../../lib/const";
import globalConfig from "../../lib/global-config";

// 视频预处理器选项
export interface IVideoPreprocessorOptions extends IPreprocessorOptions {
    videoEncoder?: string; // 视频编码器（必须为H264编码器）
}

// 视频预处理器
export default class VideoPreprocessor extends Preprocessor {

    public videoEncoder: string; // 视频编码器（必须为H264编码器）

    // 构造函数
    constructor(options: IVideoPreprocessorOptions) {
        super(options);
        const {videoEncoder} = options;
        assert(_.isUndefined(videoEncoder) || _.isString(videoEncoder), "videoEncoder must be string");
        assert(_.isUndefined(videoEncoder) || VIDEO_ENCODER_MAP.H264.includes(videoEncoder), `videoEncoder ${videoEncoder} is not H264 encoder`);
        this.videoEncoder = _.defaultTo(videoEncoder, _.defaultTo(globalConfig.mp4Encoder, VIDEO_ENCODER.CPU.H264));
    }

    // 发起处理
    public async process(config: VideoConfig): Promise<IVideoProcessResult> {
        assert(config instanceof VideoConfig, "process config must be VideoConfig");
        return await super.process(config) as IVideoProcessResult;
    }

    // 创建视频下载任务
    public createDownloadTask(options: IVideoDownloadTaskOptions): VideoDownloadTask {
        const task = new VideoDownloadTask(options);
        this.addDownloadTask(task);
        return task;
    }

    // 创建视频处理任务
    public createProcessTask(options: IVideoProcessTaskOptions): VideoProcessTask {
        const task = new VideoProcessTask({...options, videoEncoder: this.videoEncoder});
        this.addProcessTask(task);
        return task;
    }

}
