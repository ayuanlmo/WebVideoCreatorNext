// 单幕视频合成示例

import WebVideoCreatorNext, {logger} from "../index";
import type {IRenderResult} from "../core/Synthesizer";

export default async ({
                          url,
                          width,
                          height,
                          fps,
                          duration,
                          videoEncoder,
                          outputPath
                      }: {
    url: string; // 页面URL
    width: number; // 视频宽度
    height: number; // 视频高度
    fps: number; // 视频帧率
    duration: number; // 视频时长（毫秒）
    videoEncoder: string; // 视频编码器
    outputPath: string; // 视频输出路径
}): Promise<void> => {
    const wvc = new WebVideoCreatorNext();
    wvc.config({
        mp4Encoder: videoEncoder
    });
    const video = wvc.createSingleVideo({
        url,
        width,
        height,
        fps,
        duration,
        outputPath,
        showProgress: true
    });
    video.once("completed", async (result: IRenderResult): Promise<void> => {
        logger.success(`Render Completed!!!\nvideo duration: ${Math.floor(result.duration / 1000)}s\ntakes: ${Math.floor(result.takes / 1000)}s\nRTF: ${result.rtf}`);
        await wvc.destroy();
    });
    video.start();
}
