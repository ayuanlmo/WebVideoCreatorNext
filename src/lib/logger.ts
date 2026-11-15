import util from "util";
import pc from "picocolors";

import globalConfig from "./global-config";

interface IStackInfo {
    name: string; // 调用来源文件名
    path?: string | null; // 调用来源路径
    codeLine: number; // 代码行号
    codeColumn: number; // 代码列号
}

const logTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
});

// 格式化日志时间（yyyy-MM-dd HH:mm:ss.SSS）
function formatLogTime(date: Date): string {
    const parts = logTimeFormatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part): boolean => part.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

// 日志文本格式化
class LogText {

    public level: string; // 日志级别
    public text: string; // 日志文本
    public source: IStackInfo; // 日志来源
    public time: Date = new Date(); // 日志产生时间点

    constructor(level: string, ...params: unknown[]) {
        this.level = level;
        // 使用util.format将参数格式化为文本
        this.text = util.format.apply(null, params);
        // 获取调用栈顶信息
        this.source = this.getStackTopCodeInfo();
    }

    // 获取调用栈顶部信息
    private getStackTopCodeInfo(): IStackInfo {
        const unknownInfo: IStackInfo = {name: "unknown", codeLine: 0, codeColumn: 0};
        const stackArray = new Error().stack.split("\n");
        const text = stackArray[4];
        if (!text)
            return unknownInfo;
        const match = text.match(/at (.+) \((.+)\)/) || text.match(/at (.+)/);
        // 上游使用 Node util.isString，该API在 Node 22+ 已移除，此处等价替换为 typeof 判断
        if (!match || typeof (match[2] || match[1]) !== "string")
            return unknownInfo;
        const temp = match[2] || match[1];
        const _match = temp.match(/([a-zA-Z0-9_\-\.]+)\:(\d+)\:(\d+)$/);
        if (!_match)
            return unknownInfo;
        const [, scriptPath, codeLine, codeColumn] = _match;
        return {
            name: scriptPath ? scriptPath.replace(/.js$/, "") : "unknown",
            path: scriptPath || null,
            codeLine: parseInt(String(codeLine || 0)),
            codeColumn: parseInt(String(codeColumn || 0))
        };
    }

    // 导出为日志内容
    public toString(): string {
        return `[${formatLogTime(this.time)}][${this.level}][${this.source.name}<${this.source.codeLine},${this.source.codeColumn}>] ${this.text}`;
    }

}

export default {

    // 打印成功日志
    success(...params: unknown[]): void {
        console.info(pc.green(new LogText("success", ...params).toString()));
    },

    // 打印信息日志
    info(...params: unknown[]): void {
        console.info(pc.cyanBright(new LogText("info", ...params).toString()));
    },

    // 打印普通日志
    log(...params: unknown[]): void {
        console.info(pc.white(new LogText("log", ...params).toString()));
    },

    // 打印内部调试日志
    _debug(...params: unknown[]): void {
        console.info(pc.white(new LogText("debug", ...params).toString()));
    },

    // 打印调试日志
    debug(...params: unknown[]): void {
        if (!globalConfig.debug)
            return;
        console.info(pc.white(new LogText("debug", ...params).toString()));
    },

    // 打印警告日志
    warn(...params: unknown[]): void {
        console.info(pc.yellowBright(new LogText("warn", ...params).toString()));
    },

    // 打印错误日志
    error(...params: unknown[]): void {
        console.info(pc.redBright(new LogText("error", ...params).toString()));
    }

};
