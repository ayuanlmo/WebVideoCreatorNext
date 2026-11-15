import assert from "assert";
import path from "path";
import fs from "fs-extra";
import _ from "lodash";

import util from "../lib/util";

// 字体选项
export interface IFontOptions {
    url?: string; // 字体URL
    path?: string; // 字体路径
    family: string; // 字体集名称
    format?: string; // 字体格式
    style?: string; // 字体样式
    weight?: number | string; // 字体粗细
    retryFetchs?: number; // 重试拉取次数，默认2
    ignoreCache?: boolean; // 是否忽略本地缓存，默认false
}

// 字体
export default class Font {

    public url: string | undefined; // 字体URL
    public path: string | undefined; // 字体路径
    public family: string; // 字体集名称
    public format: string | null | undefined; // 字体格式
    public style: string | undefined; // 字体样式
    public weight: number | string | undefined; // 字体粗细
    public retryFetchs: number; // 重试拉取次数
    public ignoreCache: boolean; // 是否忽略本地缓存
    public tmpDirPath: string = path.resolve("tmp/local_font/"); // 临时路径
    private innerURL: string | undefined; // 内部字体URL
    private loadPromise: Promise<void> | undefined; // 加载承诺

    // 构造函数
    constructor(options: IFontOptions) {
        assert(_.isObject(options), "Font options must be Object");
        const {url, path: _path, family, format, style, weight, retryFetchs, ignoreCache} = options;
        assert(_.isString(url) || _.isString(_path), "Font path or url must be string");
        assert(_.isString(family), "Font family must be string");
        assert(_.isUndefined(format) || _.isString(format), "Font format must be string");
        assert(_.isUndefined(style) || _.isString(style), "Font style must be string");
        assert(_.isUndefined(weight) || _.isFinite(weight) || _.isString(weight), "Font weight must be number or string");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "Font retryFetchs must be number");
        assert(_.isUndefined(ignoreCache) || _.isBoolean(ignoreCache), "Font fadeOutDuration must be boolean");
        this.url = url;
        this.path = _.isString(_path) ? path.resolve(_path) : _path;
        this.family = family;
        if (format)
            this.format = format;
        if (this.url)
            this.format = util.getURLExtname(this.url);
        else if (this.path)
            this.format = util.getPathExtname(this.path);
        this.style = style;
        this.weight = _.isNumber(weight) ? parseInt(String(weight)) : weight;
        this.retryFetchs = _.defaultTo(retryFetchs, 2);
        this.ignoreCache = _.defaultTo(ignoreCache, false);
    }

    // 资源加载
    public async load(): Promise<void> {
        if (this.loadPromise)
            return this.loadPromise;
        this.loadPromise = (async (): Promise<void> => {
            await fs.ensureDir(this.tmpDirPath);
            if (this.path) {
                const filePath = this.path;
                if (!await fs.pathExists(filePath))
                    throw new Error(`Font source ${filePath} not exists`);
                if (!(await fs.stat(filePath)).isFile())
                    throw new Error(`Font source ${filePath} must be file`);
                const {dir, base} = path.parse(filePath);
                const dirPath = dir.replace(/:/g, "").replace(/\\/g, "/").toLowerCase();
                const destPath = path.join(this.tmpDirPath, dirPath, base);
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(filePath, destPath);
                this.innerURL = path.join("local_font/", dirPath, base).replace(/\\/g, "/");
            } else if (this.url)
                this.innerURL = this.url;

        })();
        return this.loadPromise;
    }

    // 转换为字体声明
    public toFontFace(): string {
        assert(this.innerURL, "Font not loaded");
        return `@font-face{font-family:"${this.family}";${this.style ? `font-style:${this.style};` : ""}${this.weight ? `font-weight:${this.weight};` : ""}src:url("${this.innerURL}") format("${this.format}")}`;
    }

}
