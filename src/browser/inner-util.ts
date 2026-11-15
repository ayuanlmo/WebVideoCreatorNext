// 内部工具包

// 内部工具包对象形状
export interface IInnerUtil {
    assert(value: unknown, message?: string | Error): void;

    isObject(value: unknown): value is object;

    isFunction(value: unknown): value is Function;

    isUint8Array(value: unknown): value is Uint8Array;

    isUndefined(value: unknown): value is undefined;

    isNull(value: unknown): value is null;

    isNil(value: unknown): value is null | undefined;

    isString(value: unknown): value is string;

    isNumber(value: unknown): boolean;

    isBoolean(value: unknown): value is boolean;

    isError(value: unknown): value is Error;

    defaultTo<T>(value: T | null | undefined, defaultValue: T): T;
}

export default (): IInnerUtil => ({

    // 简易的断言（仅 value === true 视为通过）
    assert(value: unknown, message?: string | Error): void {
        if (value === true) return;
        throw (message instanceof Error ? message : new Error(message));
    },

    // 判断是否对象
    isObject(value: unknown): value is object {
        return value instanceof Object;
    },

    // 判断是否函数
    isFunction(value: unknown): value is Function {
        return value instanceof Function;
    },

    // 判断是否Uint8Array
    isUint8Array(value: unknown): value is Uint8Array {
        return value instanceof Uint8Array;
    },

    // 判断是否未定义
    isUndefined(value: unknown): value is undefined {
        return value === undefined;
    },

    // 判断是否为null
    isNull(value: unknown): value is null {
        return value === null;
    },

    // 判断是否未定义或为null
    isNil(value: unknown): value is null | undefined {
        return this.isUndefined(value) || this.isNull(value);
    },

    // 是否为字符串值
    isString(value: unknown): value is string {
        return typeof value == "string";
    },

    // 判断是否数字值（含数字字符串）
    isNumber(value: unknown): boolean {
        return !isNaN(value as number);
    },

    // 判断是否布尔值
    isBoolean(value: unknown): value is boolean {
        return value === true || value === false;
    },

    // 判断是否错误对象
    isError(value: unknown): value is Error {
        return value instanceof Error;
    },

    // 默认值赋值
    defaultTo<T>(value: T | null | undefined, defaultValue: T): T {
        if (this.isNil(value))
            return defaultValue;
        return value;
    }

});
