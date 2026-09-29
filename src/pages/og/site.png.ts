import type { APIRoute } from "astro";
import { createElement } from "react";
import { Logo } from "../../components/og/logo.tsx";
import { renderPng } from "../../components/og/render.ts";
import { INITIATIVE, TAGLINE } from "../../lib/seo.ts";
import svg from "../../../public/logo.svg?raw";

const LOGO_WIDTH = 540;

function lockupNumber(source: string, pattern: RegExp): number {
  const value = Number(source.match(pattern)?.[1]);
  if (!Number.isFinite(value)) throw new Error(`public/logo.svg lacks ${pattern}`);
  return value;
}

export const GET: APIRoute = async () => {
  const width = lockupNumber(svg, /viewBox="0 0 ([\d.]+) /);
  const height = lockupNumber(svg, /viewBox="0 0 [\d.]+ ([\d.]+)"/);
  const block = lockupNumber(svg, /id="block" width="([\d.]+)"/);
  const png = await renderPng(
    createElement(Logo, {
      logo: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      logoWidth: LOGO_WIDTH,
      logoHeight: (LOGO_WIDTH * height) / width,
      clearSpace: (LOGO_WIDTH * block) / width,
      tagline: TAGLINE,
      caption: INITIATIVE,
    }),
  );
  return new Response(png, { headers: { "Content-Type": "image/png" } });
};
