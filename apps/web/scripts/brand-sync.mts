import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type Colors = Record<string, string>;

interface Tokens {
  color: Record<string, unknown>;
}

const UI = "../../packages/ui/src";

export const SHARED = ["favicon.svg", "logo.svg", "logo-dark.svg"];

const FILES: Record<string, string> = {
  "web/apple-touch-icon.png": "public/apple-touch-icon.png",
  "web/favicon.ico": "public/favicon.ico",
  "web/favicon.svg": `${UI}/favicon.svg`,
  "web/icon-192.png": "public/icon-192.png",
  "web/icon-512.png": "public/icon-512.png",
  "web/icon-maskable-512.png": "public/icon-maskable-512.png",
  "web/logo.svg": `${UI}/logo.svg`,
  "web/logo-dark.svg": `${UI}/logo-dark.svg`,
};

export function colorsFromTokens(tokens: Tokens): Colors {
  const colors: Colors = {};
  for (const [name, token] of Object.entries(tokens.color)) {
    const hex = (token as { $value?: { hex?: string } })?.$value?.hex;
    if (typeof hex === "string") colors[name] = hex.toLowerCase();
  }
  return colors;
}

const SITE_COLORS = [
  "brand",
  "brand-50",
  "brand-200",
  "brand-fg",
  "brand-900",
  "ink",
  "ink-2",
  "ink-3",
  "paper",
  "card",
  "error",
  "border",
] as const;

export function assertSiteColors(colors: Colors): void {
  const missing = SITE_COLORS.filter((name) => !(name in colors));
  if (missing.length > 0) throw new Error(`brand tokens lack ${missing.join(", ")}`);
}

export function themeCss(colors: Colors): string {
  const lines = Object.entries(colors).map(([name, hex]) => `  --color-${name}: ${hex};`);
  return `@theme {\n${lines.join("\n")}\n}\n`;
}

export function withManifestColors(manifest: string, colors: Colors): string {
  let out = manifest;
  for (const [key, token] of [
    ["theme_color", "brand-fg"],
    ["background_color", "paper"],
  ]) {
    const pattern = new RegExp(`("${key}":\\s*)"[^"]*"`);
    if (!pattern.test(out)) throw new Error(`site.webmanifest has no ${key}`);
    out = out.replace(pattern, `$1"${colors[token]}"`);
  }
  return out;
}

type Source = (path: string) => Promise<Buffer>;

const BRAND_SITE = "https://raw.githubusercontent.com/RupeeFund/brand/main/exports";

function fromSite(base: string): Source {
  return async (path) => {
    const res = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${base}/${path}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
}

function fromCheckout(dir: string): Source {
  return async (path) => readFileSync(join(dir, "exports", path));
}

export function brandDir(env: NodeJS.ProcessEnv, cwd: string): string | undefined {
  if (!env.BRAND_DIR) return undefined;
  return resolve(env.INIT_CWD ?? cwd, env.BRAND_DIR);
}

async function main() {
  const dir = brandDir(process.env, process.cwd());
  const fetchFrom = dir ? fromCheckout(dir) : fromSite(BRAND_SITE);
  const colors = colorsFromTokens(JSON.parse((await fetchFrom("tokens.json")).toString()));
  assertSiteColors(colors);
  const manifest = withManifestColors(readFileSync("public/site.webmanifest", "utf8"), colors);
  const files = await Promise.all(
    Object.entries(FILES).map(async ([from, to]) => [to, await fetchFrom(from)] as const),
  );
  writeFileSync(`${UI}/colors.css`, themeCss(colors));
  writeFileSync(`${UI}/colors.json`, `${JSON.stringify(colors, null, 2)}\n`);
  writeFileSync("public/site.webmanifest", manifest);
  for (const [to, body] of files) writeFileSync(to, body);
  for (const name of SHARED) writeFileSync(`public/${name}`, readFileSync(`${UI}/${name}`));
  console.log(`synced ${dir ?? BRAND_SITE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  await main();
