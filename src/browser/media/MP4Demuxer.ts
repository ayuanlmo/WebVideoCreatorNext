// MP4解复用器

// 解复用输出的视频配置（用于配置 VideoDecoder）
export interface IMP4DemuxConfig {
    codec: string;
    codedWidth: number;
    codedHeight: number;
    description: Uint8Array;
    bitrate: number;
    duration: number;
    fps: number;
    frameInterval: number;
    frameCount: number;
}

export default class MP4Demuxer {

    public file: IMP4BoxFile; // mp4box 文件对象
    protected _configCallback: ((config: IMP4DemuxConfig) => void) | null = null; // 配置回调函数
    protected _chunkCallback: ((chunk: EncodedVideoChunk) => void) | null = null; // 视频块回调函数

    // 构造函数
    constructor() {
        this.file = ____MP4Box.createFile();
        this.file.onReady = this._onReady.bind(this);
        this.file.onSamples = this._onSamples.bind(this);
    }

    // 监听配置
    public onConfig(fn: (config: IMP4DemuxConfig) => void): void {
        this._configCallback = fn;
    }

    // 监听视频块
    public onChunk(fn: (chunk: EncodedVideoChunk) => void): void {
        this._chunkCallback = fn;
    }

    // 监听错误
    public onError(fn: (err: Error) => void): void {
        this.file.onError = fn;
    }

    // 加载文件
    public load(buffer: Uint8Array): void {
        const rawBuffer = buffer.buffer as ArrayBuffer & { fileStart?: number };
        rawBuffer.fileStart = 0;
        this.file.appendBuffer(rawBuffer);
        this.file.flush();
    }

    // 文件已就绪
    protected _onReady(info: IMP4BoxInfo): void {
        // 选取第一条视频轨道
        const track = info.videoTracks[0];
        // 兼容编码映射
        const COMPLATIBLE_CODEC_MAP: Record<string, string> = {
            "avc1.64003c": "avc1.640033"
        };
        // 配置信息回调用于配置视频解码器
        const duration = (track.movie_duration / track.movie_timescale * 1000) || (track.samples_duration / track.timescale * 1000);
        const fps = Number((track.nb_samples / duration * 1000).toFixed());
        const frameInterval = duration / track.nb_samples;
        this._configCallback && this._configCallback({
            codec: track.codec.startsWith('vp08') ? 'vp8' : (COMPLATIBLE_CODEC_MAP[track.codec] || track.codec),
            codedWidth: track.video ? track.video.width : track.track_width,
            codedHeight: track.video ? track.video.height : track.track_height,
            description: this._getDescription(track),
            bitrate: track.bitrate,
            duration,
            fps,
            frameInterval,
            frameCount: track.nb_samples
        });
        // 开始文件解复用
        this.file.setExtractionOptions(track.id);
        this.file.start();
    }

    // 获得样本
    protected _onSamples(trackId: number, _user: unknown, samples: IMP4BoxSample[]): void {
        // 将所有样本回调
        for (const sample of samples) {
            this._chunkCallback && this._chunkCallback(new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: 1e6 * sample.cts / sample.timescale,
                duration: 1e6 * sample.duration / sample.timescale,
                data: sample.data
            }));
        }
    }

    // 获取描述信息
    protected _getDescription(track: IMP4BoxTrack): Uint8Array {
        const trak = this.file.getTrackById(track.id);
        for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
                // DataStream 为 vendor/mp4box.js 暴露的全局构造器
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                box.write(stream);
                return new Uint8Array(stream.buffer, 8);
            }
        }
        throw new Error("avcC, hvcC, vpcC, or av1C box not found");
    }

}
