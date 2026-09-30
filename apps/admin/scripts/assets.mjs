import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const FONTS = dirname(require.resolve("@fontsource-variable/inter/wght.css"));
const UI = dirname(require.resolve("@rupeefund/ui/styles.css"));
const SUBSETS = ["latin-ext", "latin"];

function named(stem, ext, bytes) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
  return `/assets/${stem}.${hash}.${ext}`;
}

const files = [];

function add(stem, ext, type, bytes) {
  const path = named(stem, ext, bytes);
  files.push({ path, type, base64: Buffer.from(bytes).toString("base64") });
  return path;
}

const fontCss = readFileSync(join(FONTS, "wght.css"), "utf8");
const faces = SUBSETS.map((subset) => {
  const file = `inter-${subset}-wght-normal.woff2`;
  const face = fontCss.match(new RegExp(`@font-face \\{[^}]*${file}[^}]*\\}`))?.[0];
  if (face === undefined) throw new Error(`@fontsource-variable/inter lacks ${file}`);
  const path = add(
    `inter-${subset}`,
    "woff2",
    "font/woff2",
    readFileSync(join(FONTS, "files", file)),
  );
  return face.replace(`./files/${file}`, path);
});

const css = faces.join("\n") + readFileSync(".generated/admin.css", "utf8");
const svg = "image/svg+xml";

const names = {
  STYLESHEET: add("admin", "css", "text/css; charset=utf-8", css),
  LOGO: add("logo", "svg", svg, readFileSync(join(UI, "logo.svg"))),
  FAVICON: add("favicon", "svg", svg, readFileSync(join(UI, "favicon.svg"))),
};

const lines = [
  "export interface Asset {\n  type: string;\n  base64: string;\n}",
  ...Object.entries(names).map(([name, path]) => `export const ${name} = ${JSON.stringify(path)};`),
  `export const ASSETS: Readonly<Record<string, Asset>> = ${JSON.stringify(
    Object.fromEntries(files.map(({ path, type, base64 }) => [path, { type, base64 }])),
  )};`,
];
writeFileSync(".generated/assets.ts", lines.join("\n") + "\n");
