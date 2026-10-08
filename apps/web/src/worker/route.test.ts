import { describe, expect, it } from "vitest";
import { route } from "./route.ts";

const env = {};
const ctx = {};

function answer(name: string) {
  const seen: string[] = [];
  const fetch = async (request: Request) => {
    seen.push(new URL(request.url).pathname);
    return new Response(name);
  };
  return Object.assign(fetch, { seen });
}

describe("the Worker entry", () => {
  it("sends each /api/ path to the API", async () => {
    const res = await route(answer("api"), answer("site"))(
      new Request("https://rupeefund.org/api/health"),
      env,
      ctx,
    );
    expect(await res.text()).toBe("api");
  });

  it("sends every other path to the site", async () => {
    const site = answer("site");
    const fetch = route(answer("api"), site);
    const paths = ["/", "/_emdash/admin", "/api", "/apiary", "/blog/api/x"];
    for (const path of paths) {
      await fetch(new Request(`https://rupeefund.org${path}`), env, ctx);
    }
    expect(site.seen).toEqual(paths);
  });
});
