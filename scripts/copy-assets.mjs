import path from "path";
import {fileURLToPath} from "url";
import fs from "fs-extra";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await fs.copy(path.join(rootDir, "src/assets"), path.join(rootDir, "dist/assets"), {overwrite: true});