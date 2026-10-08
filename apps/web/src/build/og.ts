import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createElement } from "react";
import { Logo } from "../components/og/logo.tsx";
import { renderPng } from "../components/og/render.ts";
import { INITIATIVE, TAGLINE } from "../lib/seo.ts";

const LOGO_WIDTH = 540;

function lockupNumber(source: string, pattern: RegExp): number {
  const value = Number(source.match(pattern)?.[1]);
  if (!Number.isFinite(value)) throw new Error(`@rupeefund/ui/logo.svg lacks ${pattern}`);
  return value;
}

export async function renderSiteCard(): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await readFile(
    createRequire(import.meta.url).resolve("@rupeefund/ui/logo.svg"),
    "utf8",
  );
  const width = lockupNumber(svg, /viewBox="0 0 ([\d.]+) /);
  const height = lockupNumber(svg, /viewBox="0 0 [\d.]+ ([\d.]+)"/);
  const block = lockupNumber(svg, /id="block" width="([\d.]+)"/);
  return renderPng(
    createElement(Logo, {
      logo: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      logoWidth: LOGO_WIDTH,
      logoHeight: (LOGO_WIDTH * height) / width,
      clearSpace: (LOGO_WIDTH * block) / width,
      tagline: TAGLINE,
      caption: INITIATIVE,
    }),
  );
}

export async function writeSiteCard(outDir: string): Promise<void> {
  await mkdir(join(outDir, "og"), { recursive: true });
  await writeFile(join(outDir, "og", "site.png"), await renderSiteCard());
}
