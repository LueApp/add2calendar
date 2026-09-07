import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "web-dist");
const manifest = JSON.parse(await readFile(join(root, "extension", "manifest.json"), "utf8"));
const archiveName = `pdc-calendar-${manifest.version}.zip`;

await rm(output, { recursive: true, force: true });
await cp(join(root, "site"), output, { recursive: true });
await mkdir(join(output, "downloads"), { recursive: true });
await cp(join(root, "dist", archiveName), join(output, "downloads", archiveName));
await cp(join(root, "docs", "images", "batch-preview.png"), join(output, "assets", "batch-preview.png"));

console.log(`Website built at ${output}`);
