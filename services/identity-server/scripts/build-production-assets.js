"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { minify } = require("terser");

const serviceRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(serviceRoot, "public");
const outputRoot = path.join(serviceRoot, "dist", "public");

async function copyTree(sourceDir, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(sourcePath, outputPath);
      continue;
    }
    if (entry.name.endsWith(".map")) continue;
    if (entry.name.endsWith(".js")) {
      const result = await minify(fs.readFileSync(sourcePath, "utf8"), {
        compress: true,
        mangle: true,
        sourceMap: false,
        format: { comments: false },
      });
      fs.writeFileSync(outputPath, `${result.code || ""}\n`);
      continue;
    }
    fs.copyFileSync(sourcePath, outputPath);
  }
}

async function main() {
  const expectedOutput = path.join(serviceRoot, "dist", "public");
  if (outputRoot !== expectedOutput) throw new Error("Unexpected production output path");
  fs.rmSync(outputRoot, { recursive: true, force: true });
  await copyTree(sourceRoot, outputRoot);
  process.stdout.write(`Production browser assets built at ${outputRoot}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
