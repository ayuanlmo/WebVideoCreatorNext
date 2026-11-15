import { describe, it, expect } from "vitest";
import innerUtil from "../../src/browser/inner-util";

const util = innerUtil();

describe("inner-util（页面内工具）", (): void => {
    it("assert 通过真值", (): void => {
        expect((): void => util.assert(true)).not.toThrow();
    });
    it("assert 非真值抛消息", (): void => {
        expect((): void => util.assert(false, "boom")).toThrowError("boom");
    });
    it("assert 直接抛出 Error 实例", (): void => {
        const err = new Error("custom");
        expect((): void => util.assert(false, err)).toThrow(err);
    });
    it("类型判断族", (): void => {
        expect(util.isObject({})).toBe(true);
        expect(util.isFunction((): void => { })).toBe(true);
        expect(util.isString("s")).toBe(true);
        expect(util.isNumber(1)).toBe(true);
        expect(util.isBoolean(false)).toBe(true);
        expect(util.isError(new Error("x"))).toBe(true);
        expect(util.isNil(null)).toBe(true);
        expect(util.isNil(undefined)).toBe(true);
        expect(util.isUndefined(undefined)).toBe(true);
        expect(util.isNull(null)).toBe(true);
    });
    it("defaultTo 只在 nil 时回退", (): void => {
        expect(util.defaultTo(null, 9)).toBe(9);
        expect(util.defaultTo(undefined, 9)).toBe(9);
        expect(util.defaultTo(0, 9)).toBe(0);
    });
});
