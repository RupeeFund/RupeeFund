import type { APIRoute } from "astro";
import { publicDeps } from "../../content-store.ts";
import { mediaResponse } from "../../public-routes.ts";

export const prerender = false;

export const GET: APIRoute = ({ params, request }) =>
  mediaResponse(params.key ?? "", request, publicDeps());
