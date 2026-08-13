"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serviceRoot = path.resolve(__dirname, "..");
const roots = process.argv.slice(2).map((entry) => path.resolve(serviceRoot, entry));
if (!roots.length) roots.push(path.join(serviceRoot, "public"));

const forbiddenPaths = [
  /knowledge-articles-[^/\\]+\.js$/,
  /knowledge-chapters[/\\][^/\\]+\.js$/,
  /(?:^|[/\\])help-content-store\.js$/,
  /(?:^|[/\\])quiz-data-server\.js$/,
  /\.map$/,
];
const forbiddenContent = [
  /sourceMappingURL\s*=/,
  /data-answer\s*=/,
  /quiz\.dataset\.answer/,
  /correctIndex\s*:/,
  /Server-side authored content/,
];

function filesUnder(root) {
  if (!fs.existsSync(root)) throw new Error(`Disclosure scan root does not exist: ${root}`);
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

const violations = [];
for (const root of roots) {
  for (const file of filesUnder(root)) {
    const relative = path.relative(serviceRoot, file);
    if (forbiddenPaths.some((pattern) => pattern.test(relative))) violations.push(`${relative}: forbidden path`);
    if (!/\.(?:js|html|css|json|webmanifest)$/i.test(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of forbiddenContent) {
      if (pattern.test(source)) violations.push(`${relative}: forbidden content ${pattern}`);
    }
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  process.stdout.write(`Browser disclosure scan passed for ${roots.map((root) => path.relative(serviceRoot, root)).join(", ")}\n`);
}
