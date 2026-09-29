import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import type { ReactNode } from "react";
import satori, { type Font } from "satori";
import { OG_HEIGHT, OG_WIDTH } from "../../lib/seo.ts";

const require = createRequire(import.meta.url);

async function inter(weight: 400 | 600): Promise<Font> {
  const file = require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`);
  return { name: "Inter", data: await readFile(file), weight, style: "normal" };
}

export async function renderPng(card: ReactNode): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(card, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await Promise.all([inter(400), inter(600)]),
  });
  return new Uint8Array(new Resvg(svg).render().asPng());
}
