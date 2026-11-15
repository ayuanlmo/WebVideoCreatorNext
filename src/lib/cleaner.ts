import fs from "fs-extra";

export default {

    // 清理浏览器缓存
    async cleanBrowserCache(): Promise<void> {
        await fs.emptyDir("tmp/browser");
    },

    // 清理预处理器缓存
    async cleanPreprocessCache(): Promise<void> {
        await fs.emptyDir("tmp/preprocessor");
    },

    // 清理合成器缓存
    async cleanSynthesizeCache(): Promise<void> {
        await fs.emptyDir("tmp/synthesizer");
    },

    // 清理本地字体缓存
    async cleanLocalFontCache(): Promise<void> {
        await fs.emptyDir("tmp/local_font");
    }

};
