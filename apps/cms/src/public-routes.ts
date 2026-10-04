import { mediaKeys } from "@rupeefund/content/media";
import { MEDIA_FILE } from "@rupeefund/content/schema";
import { buildDocument, ContentError, type Collections } from "./published.ts";

export interface PublicDeps {
  limiter: { limit(options: { key: string }): Promise<{ success: boolean }> };
  load: () => Promise<Collections>;
  readMedia: (key: string) => Promise<Response | null>;
}

export const plain = (status: number, message: string): Response =>
  new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

async function allowed(request: Request, deps: PublicDeps): Promise<boolean> {
  const key = request.headers.get("cf-connecting-ip") ?? "unknown";
  return (await deps.limiter.limit({ key })).success;
}

async function publishedDocument(deps: PublicDeps) {
  try {
    return buildDocument(await deps.load());
  } catch (error) {
    if (error instanceof ContentError) return error;
    console.error(JSON.stringify({ event: "published_load_failed", error: String(error) }));
    return null;
  }
}

export async function publishedResponse(request: Request, deps: PublicDeps): Promise<Response> {
  if (!(await allowed(request, deps))) return plain(429, "Too many requests");
  const document = await publishedDocument(deps);
  if (document === null) return plain(503, "The content store did not answer");
  if (document instanceof ContentError) return plain(500, document.message);
  return new Response(JSON.stringify(document), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function mediaResponse(
  key: string,
  request: Request,
  deps: PublicDeps,
): Promise<Response> {
  if (!(await allowed(request, deps))) return plain(429, "Too many requests");
  if (!MEDIA_FILE.test(key)) return plain(404, "Not found");
  const document = await publishedDocument(deps);
  if (document === null) return plain(503, "The content store did not answer");
  if (document instanceof ContentError || !mediaKeys(document).includes(key)) {
    return plain(404, "Not found");
  }
  return (await deps.readMedia(key)) ?? plain(404, "Not found");
}
