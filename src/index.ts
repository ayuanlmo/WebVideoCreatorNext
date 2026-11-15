import WebVideoCreator from "./api/WebVideoCreator";
import SingleVideo from "./api/SingleVideo";
import MultiVideo from "./api/MultiVideo";
import ChunkVideo from "./api/ChunkVideo";
import examples from "./examples/index";
import * as core from "./core/index";
import * as entity from "./entity/index";
import logger from "./lib/logger";
import util from "./lib/util";

import {AUDIO_ENCODER, TRANSITION, VIDEO_ENCODER} from "./lib/const";

export default WebVideoCreator;
export {
    VIDEO_ENCODER, // 视频编码器
    AUDIO_ENCODER, // 音频编码器
    TRANSITION, // 转场效果
    SingleVideo, // 单幕视频
    MultiVideo, // 多幕视频
    ChunkVideo, // 分块视频
    WebVideoCreator as WebVideoCreatorNext, // WebVideoCreator（与 default 同体）
    examples, // 示例
    core, // 核心类
    entity, // 实体类
    logger, // 日志类
    // 工具类
    util
};
