import { readFileSync, readdirSync } from "node:fs";
import { DUMMY_SITEKEYS } from "./turnstile-dummy-keys.mjs";

const DIST = "dist";

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}

const files = filesIn(DIST);

if (files.length === 0) {
  console.error(`refusing to deploy: ${DIST} is empty, so the build produced nothing to check.`);
  process.exit(1);
}

const carriers = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const key of DUMMY_SITEKEYS) {
    if (text.includes(key)) carriers.push(`${file} carries ${key}`);
  }
}

if (carriers.length > 0) {
  console.error(
    `refusing to deploy: ${DIST} baked in a Cloudflare dummy TEST sitekey, so the Worker would reject every signup. Found in:\n${carriers.map((c) => `  - ${c}`).join("\n")}`,
  );
  process.exit(1);
}
