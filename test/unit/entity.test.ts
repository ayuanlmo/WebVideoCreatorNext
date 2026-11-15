import { describe, it, expect } from "vitest";
import path from "path";
import Transition from "../../src/entity/Transition";
import Audio, { type IAudioOptions } from "../../src/entity/Audio";
import Font, { type IFontOptions } from "../../src/entity/Font";
import { Audio as NamedAudio } from "../../src/entity/index";
import { TRANSITION } from "../../src/lib/const";

describe("Transition", (): void => {
    it("默认时长 500ms", (): void => {
        const t = new Transition({ id: TRANSITION.FADE });
        expect(t.id).toBe("fade");
        expect(t.duration).toBe(500);
    });
    it("非法转场 id 抛错", (): void => {
        expect((): Transition => new Transition({ id: "not-a-transition" })).toThrowError(/may not be supported/);
    });
    it("非数字时长抛错", (): void => {
        expect((): Transition => new Transition({ id: TRANSITION.FADE, duration: "500" as unknown as number })).toThrowError(/duration must be number/);
    });
});

describe("Audio", (): void => {
    it("默认值与上游一致", (): void => {
        const a = new Audio({ path: "res/a.mp3" });
        expect(a.path).toBe(path.resolve("res/a.mp3"));
        expect(a.startTime).toBe(0);
        expect(a.volume).toBe(100);
        expect(a.loop).toBe(false);
        expect(a.retryFetchs).toBe(2);
        expect(a.ignoreCache).toBe(false);
    });
    it("path/url 都缺失时抛错", (): void => {
        expect((): Audio => new Audio({} as unknown as IAudioOptions)).toThrowError(/path or url must be string/);
    });
    it("loop 非布尔抛错（含上游笔误消息）", (): void => {
        expect((): Audio => new Audio({ url: "http://a.com/a.mp3", loop: 1 as unknown as boolean })).toThrowError(/Audio loop must be boolean/);
    });
    it("具名导出与默认导出同体", (): void => {
        expect(NamedAudio).toBe(Audio);
    });
});

describe("Font", (): void => {
    it("从路径推断 format", (): void => {
        const f = new Font({ path: "res/font.woff2", family: "Test" });
        expect(f.format).toBe("woff2");
        expect(f.family).toBe("Test");
    });
    it("显式 format 会被扩展名覆盖（上游既有行为）", (): void => {
        const f = new Font({ path: "res/font.ttf", family: "Test", format: "woff" });
        expect(f.format).toBe("ttf");
    });
    it("family 缺失抛错", (): void => {
        expect((): Font => new Font({ path: "res/font.ttf" } as unknown as IFontOptions)).toThrowError(/family must be string/);
    });
    it("url 优先于 path 推断 format", (): void => {
        const f = new Font({ url: "https://cdn.com/f.woff", path: "res/font.ttf", family: "Test" });
        expect(f.format).toBe("woff");
    });
});
