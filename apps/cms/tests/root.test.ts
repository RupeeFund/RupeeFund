import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";
import { GET } from "../src/pages/index.ts";

const context = {
  redirect: (path: string, status?: number) =>
    new Response(null, { status, headers: { location: path } }),
} as unknown as APIContext;

describe("the cms root", () => {
  it("sends a visitor to the admin", async () => {
    const res = await GET(context);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/_emdash/admin");
  });
});
