import type { APIRoute } from "astro";
import { readMedia } from "../../../content-store.ts";

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user || !params.key) return new Response(null, { status: 404 });
  return (await readMedia(params.key, "private, no-store")) ?? new Response(null, { status: 404 });
};
