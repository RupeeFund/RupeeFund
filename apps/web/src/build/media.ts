import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mediaKeys } from "../content/media.ts";
import type { LoadedContent } from "./content.ts";
import { fetchPatiently, type Wait } from "./fetch.ts";

async function readMedia(url: URL, fetcher: typeof fetch, wait?: Wait): Promise<Uint8Array> {
  if (url.protocol === "file:") return readFile(url);
  const res = await fetchPatiently(url, {}, fetcher, wait);
  if (!res.ok) throw new Error(`The media file ${url.href} answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function copyMedia(
  loaded: LoadedContent,
  outDir: string,
  fetcher: typeof fetch = fetch,
  wait?: Wait,
): Promise<string[]> {
  const keys = mediaKeys(loaded.content);
  await mkdir(join(outDir, "media"), { recursive: true });
  for (const key of keys) {
    const file = await readMedia(loaded.mediaUrl(key), fetcher, wait);
    await writeFile(join(outDir, "media", key), file);
  }
  return keys;
}
