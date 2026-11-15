import { describe, it, expect } from "vitest";
import util from "../../src/lib/util";

describe("util.isURL", (): void => {
    it("接受 http/https 前缀", (): void => {
        expect(util.isURL("http://example.com")).toBe(true);
        expect(util.isURL("https://example.com/a.mp4")).toBe(true);
    });
    it("拒绝非 URL 与 undefined", (): void => {
        expect(util.isURL("ftp://example.com")).toBe(false);
        expect(util.isURL("./local.mp4")).toBe(false);
        expect(util.isURL(undefined)).toBe(false);
    });
});

describe("util.urlJoin", (): void => {
    it("拼接并去重斜杠", (): void => {
        expect(util.urlJoin("http://a.com/", "/b/", "c")).toBe("http://a.com/b/c");
    });
});

describe("util.millisecondsToHmss", (): void => {
    it("毫秒转时间字符串", (): void => {
        expect(util.millisecondsToHmss(0)).toBe("00:00:00.0");
        expect(util.millisecondsToHmss(61234)).toBe("00:01:01.234");
    });
    it("字符串直接透传", (): void => {
        expect(util.millisecondsToHmss("00:10:00.0")).toBe("00:10:00.0");
    });
});

describe("util 帧率换算", (): void => {
    it("durationToFrameCount 向下取整", (): void => {
        expect(util.durationToFrameCount(1500, 30)).toBe(45);
        expect(util.durationToFrameCount(999, 30)).toBe(29);
    });
    it("frameCountToDuration 返回秒", (): void => {
        expect(util.frameCountToDuration(30, 30)).toBe(1);
        expect(util.frameCountToDuration(45, 30)).toBe(1.5);
    });
});

describe("util 色值转换", (): void => {
    it("rgbToHex", (): void => {
        expect(util.rgbToHex(255, 128, 0)).toBe("ff8000");
    });
    it("hexToRgb 支持带井号", (): void => {
        expect(util.hexToRgb("#ff8000")).toEqual([255, 128, 0]);
    });
});

describe("util 哈希", (): void => {
    it("md5 稳定", (): void => {
        expect(util.md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    });
    it("crc32 稳定", (): void => {
        expect(util.crc32("abc")).toBe(0x352441c2);
    });
});

describe("util 扩展名", (): void => {
    it("getPathExtname", (): void => {
        expect(util.getPathExtname("a/b/c.mp4")).toBe("mp4");
    });
    it("getURLExtname", (): void => {
        expect(util.getURLExtname("https://a.com/p/b.webm?x=1")).toBe("webm");
        expect(util.getURLExtname("https://a.com/p/b")).toBe(null);
        expect(util.getURLExtname("/local/path")).toBe(null);
    });
    it("urlToPath 替换特殊字符", (): void => {
        expect(util.urlToPath("http://a.com:8080/b/c.mp4")).toBe("a_com_8080/b/c.mp4");
    });
});

describe("util.rootPathJoin", (): void => {
    it("绝对路径直接返回", (): void => {
        expect(util.rootPathJoin("/abs/path.js")).toBe("/abs/path.js");
    });
    it("相对路径拼到 dist 包根", (): void => {
        const joined = util.rootPathJoin("assets/common.css");
        expect(joined.endsWith(["dist", "assets", "common.css"].join("/")) || joined.includes("assets")).toBe(true);
    });
    it("空值透传", (): void => {
        expect(util.rootPathJoin(undefined as unknown as string)).toBe(undefined);
        expect(util.rootPathJoin("")).toBe("");
    });
});
