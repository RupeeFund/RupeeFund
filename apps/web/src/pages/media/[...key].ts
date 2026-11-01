import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { mediaFile, mediaWidth } from "../../content/media.ts";
import { MEDIA_FILE } from "../../content/schema.ts";

const CACHE = "public, max-age=300";

const notFound = () => new Response("Not found", { status: 404 });

async function resized(key: string, width: number): Promise<Response | null> {
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  const result = await env.IMAGES.input(object.body)
    .transform({ width, fit: "scale-down" })
    .output({ format: "image/webp" });
  return mediaFile(key, result.image(), CACHE, "image/webp");
}

export const GET: APIRoute = async ({ params, url }) => {
  const key = params.key ?? "";
  if (!MEDIA_FILE.test(key)) return notFound();
  const asked = url.searchParams.get("w");
  const width = mediaWidth(asked);
  if (asked !== null && width === null) return notFound();
  if (width !== null) {
    const answer = await resized(key, width).catch(() => null);
    if (answer) return answer;
  }
  const object = await env.MEDIA.get(key);
  return (object && mediaFile(key, object.body, CACHE)) ?? notFound();
};
