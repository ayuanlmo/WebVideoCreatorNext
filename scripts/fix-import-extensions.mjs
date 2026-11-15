// 构建后处理：源码按风格约定省略相对导入后缀（import X from "./X"），
// 但 Node ESM 运行时与 NodeNext 类型解析要求显式扩展名，故 tsc 产物统一回补 .js。
// 仅处理以 . 开头的相对说明符，幂等。
import fs from "fs-extra";
import path from "path";
import {fileURLToPath} from "url";

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const SPECIFIER = /(\bfrom\s*|\bimport\(\s*|\bimport\s*)(["'])(\.[^"']*)\2/g;
const KNOWN_EXTS = [".js", ".mjs", ".cjs", ".json", ".ts", ".d.ts", ".css"];

let rewritten = 0;

function fixFile(file) {
    const text = fs.readFileSync(file, "utf8");
    const next = text.replace(SPECIFIER, (full, prefix, quote, base) => {
        if (KNOWN_EXTS.some(ext => base.toLowerCase().endsWith(ext)))
            return full;
        rewritten++;
        return `${prefix}${quote}${base}.js${quote}`;
    });
    if (next !== text)
        fs.writeFileSync(file, next);
}

function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory())
            walk(fp);
        else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts"))
            fixFile(fp);
    }
}

walk(distDir);
console.log(`[fix-import-extensions] rewritten ${rewritten} specifiers in ${distDir}`);
