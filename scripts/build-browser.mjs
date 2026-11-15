import path from "path";
import {fileURLToPath} from "url";
import {build} from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
    entryPoints: [path.join(rootDir, "src/browser/index.ts")],
    outfile: path.join(rootDir, "dist/browser/injected.js"),
    bundle: true,
    format: "iife",
    target: "chrome119",
    platform: "browser",
    sourcemap: false,
    minify: false,
    logLevel: "info"
});