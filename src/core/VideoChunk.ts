import path from "path";
import crypto from "crypto";
import assert from "assert";
import _ from "lodash";
import type {PassThrough} from "stream";

import Synthesizer, {type ISynthesizerOptions, type TFfmpegCommand} from "./Synthesizer";
import {BITSTREAM_FILTER} from "../lib/const";
import Transition, {type ITransitionOptions} from "../entity/Transition";
import Audio, {type IAudioOptions} from "../entity/Audio";
import util from "../lib/util";

// 分块合成器选项
export interface IVideoChunkOptions extends ISynthesizerOptions {
    transition?: Transition | string; // 进入下一视频分块的转场
    autoremove?: boolean; // 分块被合并后是否自动删除分块文件
}

// 视频分块
export default class VideoChunk extends Synthesizer {

    public transition: Transition; // 进入下一视频分块的转场
    public autoremove: boolean; // 被合并后是否自动删除分块文件

    // 构造函数
    constructor(options: IVideoChunkOptions = {}) {
        super(options);
        const {transition, autoremove} = options;
        this.outputPath = _.defaultTo(this.outputPath, path.join(this.tmpDirPath, `chunk_${crypto.randomUUID()}.ts`));
        this.name = _.defaultTo(this.name, path.basename(this.outputPath));
        assert(util.getPathExtname(this.outputPath) == "ts", "Video chunk output path extname must be .ts");
        transition && this.setTransition(transition);
        this.autoremove = _.defaultTo(autoremove, true);
        this.coverCapture = false;
        this.format = "mpegts";
        const encodingType = this.getVideoEncodingType();
        assert(_.isString(BITSTREAM_FILTER[encodingType]), `Video encoder ${this.videoEncoder} does not support use in VideoChunk, only support encoding using H264, H265, and VP9`)
    }

    // 添加音频
    public addAudio(audio: IAudioOptions | Audio): Audio {
        if (!(audio instanceof Audio))
            audio = new Audio(audio);
        this.audios.push(audio);
        return audio;
    }

    // 设置合成下一视频分块时的转场
    public setTransition(transition: Transition | string | ITransitionOptions): void {
        if (_.isString(transition))
            this.transition = new Transition({id: transition});
        else if (transition instanceof Transition)
            this.transition = transition;
        else
            this.transition = new Transition(transition);
    }

    // 获取已合成视频时长
    public getOutputDuration(): number {
        return super.getOutputDuration() - this.transitionDuration;
    }

    // 创建视频编码器
    protected _createVideoEncoder(pipeStream: PassThrough): TFfmpegCommand {
        const encodingType = this.getVideoEncodingType();
        const bitstreamFilter = BITSTREAM_FILTER[encodingType];
        const vencoder = super._createVideoEncoder(pipeStream);
        vencoder.outputOption(`-bsf:v ${bitstreamFilter}`)
        return vencoder;
    }

    // 判断是否VideoChunk
    protected _isVideoChunk(): boolean {
        return true;
    }

    // 获取转场ID
    public get transitionId(): string | 0 {
        return this.transition ? this.transition.id : 0;
    }

    // 获取转场时长
    public get transitionDuration(): number {
        return this.transition ? this.transition.duration : 0;
    }

}
