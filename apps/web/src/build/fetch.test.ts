import { describe, expect, it } from "vitest";
import { fetchPatiently } from "./fetch.ts";

const limited = (retryAfter?: string) =>
  new Response("", { status: 429, headers: retryAfter ? { "retry-after": retryAfter } : {} });

function answers(...responses: Response[]) {
  const seen: RequestInit[] = [];
  const fetcher = async (_url: unknown, init?: RequestInit) => {
    seen.push(init ?? {});
    return responses.shift() ?? new Response("ok");
  };
  return { fetcher: fetcher as typeof fetch, seen };
}

describe("a patient fetch", () => {
  it("waits as long as the cms asks, then tries again", async () => {
    const { fetcher } = answers(limited("7"));
    const waits: number[] = [];
    const res = await fetchPatiently("https://cms.example/x", {}, fetcher, async (ms) => {
      waits.push(ms);
    });
    expect([res.status, waits]).toEqual([200, [7_000]]);
  });

  it("waits one minute when the cms gives no time, and never more than one minute", async () => {
    const { fetcher } = answers(limited(), limited("3600"));
    const waits: number[] = [];
    await fetchPatiently("https://cms.example/x", {}, fetcher, async (ms) => {
      waits.push(ms);
    });
    expect(waits).toEqual([60_000, 60_000]);
  });

  it("gives up after five tries, so a build cannot wait forever", async () => {
    const { fetcher } = answers(...Array.from({ length: 9 }, () => limited("1")));
    const res = await fetchPatiently("https://cms.example/x", {}, fetcher, async () => {});
    expect(res.status).toBe(429);
  });

  it("stops a request that hangs", async () => {
    const { fetcher, seen } = answers();
    await fetchPatiently("https://cms.example/x", { headers: { accept: "x" } }, fetcher);
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(seen[0]?.headers).toEqual({ accept: "x" });
  });
});
