import { describe, expect, it } from "vitest";
import { createTurnstile, parseHostnames } from "./turnstile.ts";

const NO_CHECKS = { hostnames: [], action: "" };

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("createTurnstile", () => {
  it("accepts a token Cloudflare reports as successful", async () => {
    const verify = createTurnstile("secret", NO_CHECKS, respond(200, { success: true }));
    expect(await verify("token", "1.2.3.4")).toBe(true);
  });

  it("rejects a token Cloudflare reports as failed", async () => {
    const verify = createTurnstile(
      "secret",
      NO_CHECKS,
      respond(200, { success: false, "error-codes": ["invalid-input-response"] }),
    );
    expect(await verify("token", "1.2.3.4")).toBe(false);
  });

  it("rejects when siteverify itself is unavailable, rather than letting the write through", async () => {
    const verify = createTurnstile("secret", NO_CHECKS, respond(503, {}));
    expect(await verify("token", null)).toBe(false);
  });

  it("rejects an empty token without spending a request", async () => {
    let called = false;
    const verify = createTurnstile("secret", NO_CHECKS, (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch);
    expect(await verify("", null)).toBe(false);
    expect(called).toBe(false);
  });

  it("treats a success field that is not literally true as a failure", async () => {
    const verify = createTurnstile("secret", NO_CHECKS, respond(200, { success: "true" }));
    expect(await verify("token", null)).toBe(false);
  });

  it("sends the secret, the token and the caller's address to siteverify", async () => {
    let seen: string | null = null;
    const verify = createTurnstile("s3cret", NO_CHECKS, (async (
      _url: string,
      init: RequestInit,
    ) => {
      seen = init.body as string;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch);

    await verify("tok", "9.9.9.9");

    const sent = new URLSearchParams(seen!);
    expect(sent.get("secret")).toBe("s3cret");
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("9.9.9.9");
  });

  it("omits remoteip when the address is unknown", async () => {
    let seen: string | null = null;
    const verify = createTurnstile("s", NO_CHECKS, (async (_url: string, init: RequestInit) => {
      seen = init.body as string;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch);

    await verify("tok", null);

    expect(new URLSearchParams(seen!).has("remoteip")).toBe(false);
  });
});

describe("the action and hostname checks Cloudflare recommends", () => {
  const ok = (extra: Record<string, unknown>) => respond(200, { success: true, ...extra });

  it("accepts a token whose action matches the widget", async () => {
    const verify = createTurnstile(
      "s",
      { hostnames: [], action: "waitlist_signup" },
      ok({ action: "waitlist_signup" }),
    );
    expect(await verify("tok", null)).toBe(true);
  });

  it("refuses a token solved for a different form on the same site", async () => {
    const verify = createTurnstile(
      "s",
      { hostnames: [], action: "waitlist_signup" },
      ok({ action: "login" }),
    );
    expect(await verify("tok", null)).toBe(false);
  });

  it("refuses a token that carries no action when one is expected", async () => {
    const verify = createTurnstile("s", { hostnames: [], action: "waitlist_signup" }, ok({}));
    expect(await verify("tok", null)).toBe(false);
  });

  it("accepts a hostname on the allowlist", async () => {
    const verify = createTurnstile(
      "s",
      { hostnames: ["rupeefund.org"], action: "" },
      ok({ hostname: "rupeefund.org" }),
    );
    expect(await verify("tok", null)).toBe(true);
  });

  it("refuses a token solved on somebody else's site", async () => {
    const verify = createTurnstile(
      "s",
      { hostnames: ["rupeefund.org"], action: "" },
      ok({ hostname: "evil.example" }),
    );
    expect(await verify("tok", null)).toBe(false);
  });

  it("skips both checks when neither is configured, so the test keys work", async () => {
    const verify = createTurnstile("s", NO_CHECKS, ok({ hostname: "example.com" }));
    expect(await verify("tok", null)).toBe(true);
  });

  it("refuses a token longer than Turnstile ever issues", async () => {
    let called = false;
    const verify = createTurnstile("s", NO_CHECKS, (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch);
    expect(await verify("x".repeat(2049), null)).toBe(false);
    expect(called).toBe(false);
  });
});

describe("parseHostnames", () => {
  it("splits a comma separated list and removes the spaces", () => {
    expect(parseHostnames(" a.com , b.com ")).toEqual(["a.com", "b.com"]);
  });

  it("gives an empty list when the variable is absent", () => {
    expect(parseHostnames(undefined)).toEqual([]);
  });
});
