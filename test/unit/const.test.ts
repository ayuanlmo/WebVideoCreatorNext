import { describe, it, expect } from "vitest";
import {
    SUPPORT_FORMAT, VIDEO_ENCODER, VIDEO_ENCODER_MAP, AUDIO_ENCODER_MAP,
    BITSTREAM_FILTER, FORMAT_VIDEO_ENCODER_MAP, TRANSITION
} from "../../src/lib/const";

describe("const 编码器常量", (): void => {
    it("SUPPORT_FORMAT 包含 mp4/webm", (): void => {
        expect(SUPPORT_FORMAT).toContain("mp4");
        expect(SUPPORT_FORMAT).toContain("webm");
    });
    it("VIDEO_ENCODER 默认软编码值", (): void => {
        expect(VIDEO_ENCODER.CPU.H264).toBe("libx264");
        expect(VIDEO_ENCODER.CPU.VP8).toBe("libvpx");
        expect(VIDEO_ENCODER.NVIDIA.H264).toBe("h264_nvenc");
    });
    it("VIDEO_ENCODER_MAP 由类型名聚合编码器列表", (): void => {
        expect(VIDEO_ENCODER_MAP["H264"]).toContain("libx264");
        expect(VIDEO_ENCODER_MAP["H264"]).toContain("h264_nvenc");
        expect(VIDEO_ENCODER_MAP["VP9"]).toContain("libvpx-vp9");
    });
    it("AUDIO_ENCODER_MAP 保留上游按字符聚合的既有行为", (): void => {
        // 上游对字符串做 Object.entries，键为字符下标而非编码器名（1:1 保留，不做修正）
        expect(AUDIO_ENCODER_MAP["0"]).toEqual(["a", "l"]);
        expect(AUDIO_ENCODER_MAP["2"]).toEqual(["c", "b"]);
    });
    it("BITSTREAM_FILTER", (): void => {
        expect(BITSTREAM_FILTER.H264).toBe("h264_mp4toannexb");
    });
    it("FORMAT_VIDEO_ENCODER_MAP 容器约束", (): void => {
        expect(FORMAT_VIDEO_ENCODER_MAP["mp4"]).toContain(VIDEO_ENCODER.CPU.H264);
        expect(FORMAT_VIDEO_ENCODER_MAP["webm"]).toContain(VIDEO_ENCODER.CPU.VP8);
        expect(FORMAT_VIDEO_ENCODER_MAP["mp4"]).not.toContain(VIDEO_ENCODER.CPU.VP9);
    });
    it("TRANSITION 含常用转场", (): void => {
        expect(TRANSITION.FADE).toBe("fade");
        expect(TRANSITION.DISSOLVE).toBe("dissolve");
        expect(Object.values(TRANSITION).length).toBeGreaterThan(40);
    });
});
