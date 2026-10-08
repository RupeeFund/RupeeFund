import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { mediaFile } from "../../content/media.ts";
import { MEDIA_FILE } from "../../content/schema.ts";

const notFound = () => new Response("Not found", { status: 404 });

export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? "";
  if (!MEDIA_FILE.test(key)) return notFound();
  const object = await env.MEDIA.get(key);
  return (object && mediaFile(key, object.body, "public, max-age=300")) ?? notFound();
};
