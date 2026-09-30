import { describe, expect, it } from "vitest";
import { CONFIRMED_PATH, PROBLEM_PATH, handleWaitlist, type WaitlistDeps } from "./waitlist.ts";
import { makeLimiter, makeLogger, makeRepo, makeVerifier } from "../testkit.ts";

function deps(over: Partial<WaitlistDeps> = {}): WaitlistDeps {
  return {
    repo: makeRepo(),
    now: () => 1000,
    limiter: makeLimiter(),
    verifyToken: makeVerifier(),
    log: () => {},
    ...over,
  };
}

function jsonReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://rupeefund.org/api/waitlist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

function formReq(fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  return new Request("https://rupeefund.org/api/waitlist", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}

const VALID = { name: "Asha", email: "asha@example.com", amount: "128", turnstileToken: "tok" };
const FORM = { name: "Asha", email: "asha@example.com", amount: "128" };

describe("handleWaitlist over fetch (JavaScript enabled)", () => {
  it("stores a valid signup and reports success", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(jsonReq(VALID), deps({ repo }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.waitlist.map((w) => w.email)).toEqual(["asha@example.com"]);
  });

  it("normalises the address before storing it", async () => {
    const repo = makeRepo();
    await handleWaitlist(jsonReq({ ...VALID, email: "Asha@Example.COM" }), deps({ repo }));
    expect(repo.waitlist[0]?.email).toBe("asha@example.com");
  });

  it("rejects a failed bot check with no write", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      jsonReq(VALID),
      deps({ repo, verifyToken: makeVerifier({ pass: false }) }),
    );
    expect(res.status).toBe(403);
    expect(repo.waitlist).toEqual([]);
  });

  it("rejects rather than admits when the bot check itself is unavailable", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      jsonReq(VALID),
      deps({ repo, verifyToken: makeVerifier({ throws: true }) }),
    );
    expect(res.status).toBe(403);
    expect(repo.waitlist).toEqual([]);
  });

  it("rejects when no bot-check token was sent at all", async () => {
    const repo = makeRepo();
    const verifyToken = makeVerifier({ pass: false });
    const res = await handleWaitlist(jsonReq(FORM), deps({ repo, verifyToken }));
    expect(res.status).toBe(403);
    expect(verifyToken.calls[0]?.token).toBe("");
  });

  it("rejects over the rate limit with no write", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      jsonReq(VALID),
      deps({ repo, limiter: makeLimiter({ allow: false }) }),
    );
    expect(res.status).toBe(429);
    expect(repo.waitlist).toEqual([]);
  });

  it("rejects rather than admits when the rate limiter itself is unavailable", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      jsonReq(VALID),
      deps({ repo, limiter: makeLimiter({ throws: true }) }),
    );
    expect(res.status).toBe(429);
    expect(repo.waitlist).toEqual([]);
  });

  it("keys the rate limit on the caller's address", async () => {
    const limiter = makeLimiter();
    await handleWaitlist(jsonReq(VALID, { "cf-connecting-ip": "9.9.9.9" }), deps({ limiter }));
    expect(limiter.keys).toEqual(["9.9.9.9"]);
  });

  it("checks the rate limit before spending a bot-check request", async () => {
    const verifyToken = makeVerifier();
    await handleWaitlist(
      jsonReq(VALID),
      deps({ limiter: makeLimiter({ allow: false }), verifyToken }),
    );
    expect(verifyToken.calls).toEqual([]);
  });

  it("rejects a body larger than the endpoint accepts", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(jsonReq(VALID, { "content-length": "9999" }), deps({ repo }));
    expect(res.status).toBe(413);
    expect(repo.waitlist).toEqual([]);
  });

  it("accepts the longest token, name and address allowed", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      jsonReq({
        name: "\u0906".repeat(100),
        email: `${"a".repeat(240)}@example.com`,
        amount: "other",
        amount_other: "9".repeat(15),
        turnstileToken: "x".repeat(2048),
      }),
      deps({ repo }),
    );
    expect(res.status).toBe(200);
    expect(repo.waitlist).toHaveLength(1);
  });

  it("rejects an oversized body even when no Content-Length is declared", async () => {
    const repo = makeRepo();
    const huge = JSON.stringify({ ...VALID, name: "x".repeat(50_000) });
    const streamed = new Request("https://rupeefund.org/api/waitlist", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(huge));
          controller.close();
        },
      }),
      headers: { "content-type": "application/json" },
      duplex: "half",
    } as RequestInit);

    const res = await handleWaitlist(streamed, deps({ repo }));

    expect(res.status).toBe(413);
    expect(repo.waitlist).toEqual([]);
  });

  it("passes the caller's address to the bot check, not a placeholder", async () => {
    const verifyToken = makeVerifier();
    await handleWaitlist(jsonReq(VALID, { "cf-connecting-ip": "9.9.9.9" }), deps({ verifyToken }));
    expect(verifyToken.calls[0]?.remoteIp).toBe("9.9.9.9");
  });

  it("tells the bot check the address is unknown rather than inventing one", async () => {
    const verifyToken = makeVerifier();
    await handleWaitlist(jsonReq(VALID), deps({ verifyToken }));
    expect(verifyToken.calls[0]?.remoteIp).toBe(null);
  });

  it("rejects a cross-origin submission", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      jsonReq(VALID, { origin: "https://evil.example" }),
      deps({ repo }),
    );
    expect(res.status).toBe(403);
    expect(repo.waitlist).toEqual([]);
  });

  it("rejects malformed JSON", async () => {
    const bad = new Request("https://rupeefund.org/api/waitlist", {
      method: "POST",
      body: "{nope",
      headers: { "content-type": "application/json" },
    });
    expect((await handleWaitlist(bad, deps())).status).toBe(400);
  });

  const { amount: _drop, ...noAmount } = VALID;

  it.each([
    ["an invalid address", { ...VALID, email: "nope" }],
    ["a name longer than the column is meant to hold", { ...VALID, name: "x".repeat(101) }],
    ["a signup that names no amount", noAmount],
  ])("rejects %s with no write", async (_, body) => {
    const repo = makeRepo();
    const res = await handleWaitlist(jsonReq(body), deps({ repo }));
    expect(res.status).toBe(400);
    expect(repo.waitlist).toEqual([]);
  });

  it("reports a storage failure instead of claiming success", async () => {
    const repo = makeRepo();
    repo.addToWaitlist = async () => {
      throw new Error("D1 unavailable");
    };
    const res = await handleWaitlist(jsonReq(VALID), deps({ repo }));
    expect(res.status).toBe(500);
  });

  it("logs a storage failure so a silent outage is visible", async () => {
    const repo = makeRepo();
    repo.addToWaitlist = async () => {
      throw new Error("D1 unavailable");
    };
    const logger = makeLogger();
    await handleWaitlist(jsonReq(VALID), deps({ repo, log: logger.log }));
    expect(logger.entries[0]?.event).toBe("waitlist_write_failed");
  });

  it("never logs the submitted address", async () => {
    const repo = makeRepo();
    repo.addToWaitlist = async () => {
      throw new Error("D1 unavailable");
    };
    const logger = makeLogger();
    await handleWaitlist(jsonReq(VALID), deps({ repo, log: logger.log }));
    expect(JSON.stringify(logger.entries)).not.toContain("asha@example.com");
  });
});

describe("handleWaitlist over a plain form post (JavaScript disabled)", () => {
  it("stores the signup and redirects to a confirmation page", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(formReq(FORM), deps({ repo }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(CONFIRMED_PATH);
    expect(repo.waitlist.map((w) => w.email)).toEqual(["asha@example.com"]);
  });

  it("does not demand a bot-check token it has no way to obtain", async () => {
    const verifyToken = makeVerifier({ pass: false });
    const res = await handleWaitlist(formReq(FORM), deps({ verifyToken }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(CONFIRMED_PATH);
    expect(verifyToken.calls).toEqual([]);
  });

  it("still enforces the rate limit, redirecting rather than returning JSON", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      formReq(FORM),
      deps({ repo, limiter: makeLimiter({ allow: false }) }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${PROBLEM_PATH}?reason=rate_limited`);
    expect(repo.waitlist).toEqual([]);
  });

  it("sends an invalid address to the problem page, not the confirmation page", async () => {
    const res = await handleWaitlist(formReq({ ...FORM, email: "nope" }), deps());
    expect(res.headers.get("location")).toBe(`${PROBLEM_PATH}?reason=invalid_input`);
  });

  it("rejects a cross-origin form post", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(
      formReq(FORM, { origin: "https://evil.example" }),
      deps({ repo }),
    );
    expect(res.headers.get("location")).toBe(`${PROBLEM_PATH}?reason=origin`);
    expect(repo.waitlist).toEqual([]);
  });

  it("accepts a same-origin form post that carries an Origin header", async () => {
    const res = await handleWaitlist(formReq(FORM, { origin: "https://rupeefund.org" }), deps());
    expect(res.headers.get("location")).toBe(CONFIRMED_PATH);
  });
});

describe("the honeypot absorbs bots without telling them", () => {
  it("looks exactly like success over fetch while writing nothing", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(jsonReq({ ...VALID, company: "Acme Corp" }), deps({ repo }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.waitlist).toEqual([]);
  });

  it("looks exactly like success over a form post while writing nothing", async () => {
    const repo = makeRepo();
    const res = await handleWaitlist(formReq({ ...FORM, company: "Acme" }), deps({ repo }));
    expect(res.headers.get("location")).toBe(CONFIRMED_PATH);
    expect(repo.waitlist).toEqual([]);
  });

  it("ignores an empty honeypot, which every real browser sends", async () => {
    const repo = makeRepo();
    await handleWaitlist(jsonReq({ ...VALID, company: "" }), deps({ repo }));
    expect(repo.waitlist).toHaveLength(1);
  });
});

describe("consent and provenance are recorded on every stored signup", () => {
  it("stamps the moment consent was given", async () => {
    const repo = makeRepo();
    await handleWaitlist(jsonReq(VALID), deps({ repo, now: () => 4242 }));
    expect(repo.waitlist[0]?.consent_at).toBe(4242);
  });

  it("records a recognised source and rejects anything else in favour of the default", async () => {
    const repo = makeRepo();
    await handleWaitlist(jsonReq({ ...VALID, source: "footer" }), deps({ repo }));
    await handleWaitlist(
      jsonReq({ ...VALID, email: "b@example.com", source: "../../etc/passwd" }),
      deps({ repo }),
    );
    expect(repo.waitlist.map((w) => w.source)).toEqual(["footer", "subscribe"]);
  });

  it("answers success when the same address posts again", async () => {
    const repo = makeRepo();
    await handleWaitlist(jsonReq(VALID), deps({ repo }));
    const res = await handleWaitlist(jsonReq(VALID), deps({ repo }));
    expect(res.status).toBe(200);
  });

  it("stores every answer the fetch body carries", async () => {
    const repo = makeRepo();
    const body = {
      ...VALID,
      amount: "other",
      amount_other: "250",
      months: "12+",
      question: "Why?",
      updates: "1",
      is_user: "1",
      is_student: "1",
      backs_growing: "1",
    };
    await handleWaitlist(jsonReq(body), deps({ repo }));
    expect(repo.waitlist[0]).toMatchObject({
      amount: 250,
      months: "12+",
      question: "Why?",
      updates_opt_in: 1,
      is_user: 1,
      is_creator: 0,
      is_professional: 0,
      is_student: 1,
      backs_nascent: 0,
      backs_growing: 1,
      backs_larger: 0,
    });
  });

  it("stores every answer a plain form post carries, and an unticked box as 0", async () => {
    const repo = makeRepo();
    const fields = {
      ...FORM,
      amount: "other",
      amount_other: "42",
      months: "6",
      question: "Hi",
      is_creator: "1",
    };
    await handleWaitlist(formReq(fields), deps({ repo }));
    expect(repo.waitlist[0]).toMatchObject({
      amount: 42,
      months: "6",
      question: "Hi",
      updates_opt_in: 0,
      is_user: 0,
      is_creator: 1,
      is_professional: 0,
      is_student: 0,
    });
  });
});
