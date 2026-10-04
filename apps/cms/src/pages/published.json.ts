import type { APIRoute } from "astro";
import { publicDeps } from "../content-store.ts";
import { publishedResponse } from "../public-routes.ts";

export const prerender = false;

export const GET: APIRoute = ({ request }) => publishedResponse(request, publicDeps());
