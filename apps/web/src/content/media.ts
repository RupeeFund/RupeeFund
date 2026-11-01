import { MEDIA_FILE } from "./schema.ts";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

export const MEDIA_WIDTHS = [160, 320, 640, 960] as const;

export function mediaWidth(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const width = Number(value);
  return (MEDIA_WIDTHS as readonly number[]).includes(width) ? width : null;
}

export function mediaSrcset(src: string, width: number | undefined): string | undefined {
  if (width === undefined) return undefined;
  const smaller = MEDIA_WIDTHS.filter((one) => one < width).map((one) => `${src}?w=${one} ${one}w`);
  return smaller.length > 0 ? [...smaller, `${src} ${width}w`].join(", ") : undefined;
}

export function mediaFile(
  key: string,
  body: BodyInit,
  cacheControl: string,
  type?: string,
): Response | null {
  if (!MEDIA_FILE.test(key)) return null;
  const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return new Response(body, {
    headers: {
      "content-type": type ?? TYPES[extension]!,
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "cache-control": cacheControl,
    },
  });
}
