import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDirectory = new URL("../dist/", import.meta.url).pathname;

for (const relativePath of readdirSync(distDirectory, {
  encoding: "utf8",
  recursive: true,
})) {
  if (!relativePath.endsWith(".d.ts")) {
    continue;
  }

  const path = join(distDirectory, relativePath);
  const source = readFileSync(path, "utf8");
  const rewritten = source.replaceAll(
    /(from\s+["']|export\s+\*\s+from\s+["'])(\.\.?\/[^"']+)\.ts(["'])/g,
    "$1$2.js$3",
  );

  if (rewritten !== source) {
    writeFileSync(path, rewritten);
  }
}
