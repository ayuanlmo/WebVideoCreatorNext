import os from "os";
import path from "path";
import assert from "assert";
import fs from "fs-extra";
import _ from "lodash";
import {Browser, BrowserPlatform, computeExecutablePath, install, resolveBuildId} from "@puppeteer/browsers";

import logger from "./logger";
import globalConfig from "./global-config";

// 默认浏览器安装路径
const browserInstallPath = ".bin";
// 默认浏览器名称
// 使用chrome-headless-shell：HeadlessExperimental.beginFrame仅在旧无头（shell）中可用，
// puppeteer>=22的headless:true指向新无头，会破坏默认捕获路径
const browserName = Browser.CHROMEHEADLESSSHELL;
// 默认浏览器版本号，不能低于119.0.6018.0，否则无法使用VideoDecoder解码H264
// 请参考：https://github.com/GoogleChromeLabs/chrome-for-testing/issues/18
// 经WSL实证：chrome-headless-shell 157.0.8103.78（stable）仍完整支持HeadlessExperimental.beginFrame+screenshotData，
// 126/131/157均可用；更高版本（如159）升级前请通过集成测试验证捕获路径，必要时用browserVersion/browserExecutablePath覆盖。
// 注意：--single-process与GPU合成组合在现代headless-shell下会崩溃，Browser已移除该参数。
const browserVersion = "157.0.8103.78";

// 浏览器安装选项
export interface IInstallBrowserOptions {
    name?: string; // 安装浏览器名称
    version?: string; // 安装浏览器版本
}

// 浏览器安装结果
export interface IInstallBrowserResult {
    executablePath: string; // 浏览器可执行文件路径
}

// 安装浏览器
export default async function installBrowser(installPath: string = browserInstallPath, options: IInstallBrowserOptions = {}): Promise<IInstallBrowserResult> {

    assert(_.isString(installPath), "install path must be string");
    assert(_.isObject(options), "options must be Object");
    const {name = browserName, version = (globalConfig.browserVersion || browserVersion)} = options;
    assert(_.isString(name), "browser name must be string");
    assert(_.isString(version), "version must be string");

    let platform: string = os.platform();
    const arch = os.arch();

    // 根据不同平台架构选择浏览器平台
    if (platform == "win32") {
        if (arch == "x64")
            platform = BrowserPlatform.WIN64;
        else
            platform = BrowserPlatform.WIN32;
    } else if (platform == "darwin") {
        !globalConfig.compatibleRenderingMode && logger.warn("The headless browser of the Mac system may not be able to use the headless experimental API properly. Please enable compatible rendering mode: wvc.config({ compatibleRenderingMode: true }), which will result in a decrease in rendering efficiency.");
        if (arch == "arm64")
            platform = BrowserPlatform.MAC_ARM;
        else
            platform = BrowserPlatform.MAC;
    } else
        platform = BrowserPlatform.LINUX;

    // 获取buildId
    const buildId = await resolveBuildId(name as Browser, platform as BrowserPlatform, version);
    installPath = path.resolve(installPath);
    const downloadOptions = {
        cacheDir: installPath,
        browser: name as Browser,
        platform: platform as BrowserPlatform,
        buildId
    };

    // 补全可执行文件路径
    const executablePath = computeExecutablePath(downloadOptions);
    // 如果不存在可执行文件则进行下载安装
    if (!await fs.pathExists(executablePath)) {
        logger.info(`Installing ${name} ${buildId} into ${installPath}`);
        try {
            await install(downloadOptions);
        } catch {
            // 上次安装中断会留下残缺目录并触发 IncompleteInstallationError，清理后重试一次
            await fs.remove(path.dirname(path.dirname(executablePath)));
            await install(downloadOptions);
        }
        logger.info("Installation completed");
    }

    return {
        executablePath
    };

}
