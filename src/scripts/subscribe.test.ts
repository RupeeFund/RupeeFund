import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorForStatus, linkOtherAmount, submitWaitlist } from "./subscribe.ts";

function okJson(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const navigate = vi.fn<(path: string) => void>();

describe("submitWaitlist", () => {
  beforeEach(() => {
    navigate.mockReset();
    document.body.innerHTML = `
      <form id="waitlist-form">
        <input name="name" value="Ada" />
        <input name="email" value="ada@example.com" />
        <input type="radio" name="amount" value="15" />
        <input type="radio" name="amount" value="128" checked />
        <input type="radio" name="amount" value="other" />
        <input name="amount_other" value="" />
        <input name="months" value="12+" />
        <input name="question" value="Who audits this?" />
        <input type="checkbox" name="updates" value="1" />
        <input type="checkbox" name="is_foss_user" value="1" />
        <input type="checkbox" name="is_foss_contributor" value="1" />
        <input type="checkbox" name="is_student" value="1" />
        <input name="cf-turnstile-response" value="tok" />
        <button id="waitlist-submit">Sign up</button>
        <p id="waitlist-error"></p>
      </form>`;
  });

  it("opens the confirmation page on ok, so the result is in view", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    expect(navigate).toHaveBeenCalledWith("/waitlist-confirmed");
  });

  it("stays on the form when the server rejects the request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: false }, 400));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("sends the bot-check token the widget produced", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.turnstileToken).toBe("tok");
  });

  it("sends the contribution answers the subscriber gave", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      amount: "128",
      amount_other: "",
      months: "12+",
      question: "Who audits this?",
    });
  });

  it("sends an empty updates value when the box is unticked", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.updates).toBe("");
  });

  it("sends the updates value when the box is ticked", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[name="updates"]') as HTMLInputElement).checked = true;

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.updates).toBe("1");
  });

  it("sends an empty role value for every box the subscriber left unticked", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ is_foss_user: "", is_foss_contributor: "", is_student: "" });
  });

  it("sends the role values the subscriber ticked, and only those", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[name="is_foss_user"]') as HTMLInputElement).checked = true;
    (form.querySelector('input[name="is_student"]') as HTMLInputElement).checked = true;

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ is_foss_user: "1", is_foss_contributor: "", is_student: "1" });
  });

  it("sends the typed amount beside the other option, so the server can resolve it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[value="other"]') as HTMLInputElement).checked = true;
    (form.querySelector('input[name="amount_other"]') as HTMLInputElement).value = "250";

    await submitWaitlist(form, { fetchImpl, navigate });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ amount: "other", amount_other: "250" });
  });

  it("chooses the other option when the subscriber types an amount, so submit is not blocked", () => {
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const typed = form.querySelector('input[name="amount_other"]') as HTMLInputElement;
    const choice = form.querySelector('input[value="other"]') as HTMLInputElement;
    linkOtherAmount(form);

    typed.value = "250";
    typed.dispatchEvent(new Event("input"));

    expect(choice.checked).toBe(true);
  });

  it("requires a typed amount only while the other option is chosen", () => {
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const typed = form.querySelector('input[name="amount_other"]') as HTMLInputElement;
    const other = form.querySelector('input[value="other"]') as HTMLInputElement;
    const fixed = form.querySelector('input[value="128"]') as HTMLInputElement;
    linkOtherAmount(form);

    other.checked = true;
    other.dispatchEvent(new Event("change", { bubbles: true }));
    const whileOther = typed.required;
    fixed.checked = true;
    fixed.dispatchEvent(new Event("change", { bubbles: true }));

    expect([whileOther, typed.required]).toEqual([true, false]);
  });

  it("leaves the chosen option alone while the typed amount is only whitespace", () => {
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const typed = form.querySelector('input[name="amount_other"]') as HTMLInputElement;
    const choice = form.querySelector('input[value="other"]') as HTMLInputElement;
    linkOtherAmount(form);

    typed.value = "   ";
    typed.dispatchEvent(new Event("input"));

    expect(choice.checked).toBe(false);
    expect((form.querySelector('input[value="128"]') as HTMLInputElement).checked).toBe(true);
  });

  it("waits for a token that the widget supplies late, instead of giving up immediately", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const field = form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
    field.value = "";
    setTimeout(() => {
      field.value = "late-token";
    }, 150);

    await submitWaitlist(form, { fetchImpl, navigate, tokenTimeoutMs: 4000 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).turnstileToken).toBe(
      "late-token",
    );
  });

  it("gives up once its deadline passes rather than polling forever", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement).value = "";

    await submitWaitlist(form, { fetchImpl, navigate, tokenTimeoutMs: 120 });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("re-enables the submit button after a failed attempt", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement).value = "";

    await submitWaitlist(form, { fetchImpl, navigate, tokenTimeoutMs: 0 });

    expect((document.getElementById("waitlist-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("asks Cloudflare for a new token after the server rejects the request", async () => {
    const resets: string[] = [];
    (window as unknown as { turnstile: { reset(c?: string): void } }).turnstile = {
      reset: (c) => resets.push(String(c)),
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    expect(resets).toEqual(["#waitlist-turnstile"]);
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it("does not fail when Cloudflare's script is absent", async () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    expect(document.getElementById("waitlist-error")?.textContent).toMatch(
      /try again in a few minutes/i,
    );
  });

  it("tells the person to check their connection when the request cannot reach the server", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl, navigate });

    expect(document.getElementById("waitlist-error")?.textContent).toMatch(
      /check your connection/i,
    );
  });

  it("says the bot check did not load rather than posting a request that must fail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    form.querySelector('input[name="cf-turnstile-response"]')!.remove();

    await submitWaitlist(form, { fetchImpl, navigate, tokenTimeoutMs: 0 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(document.getElementById("waitlist-error")?.textContent).toMatch(/bot check/i);
  });
});

describe("errorForStatus", () => {
  it("names every field the server checks when it rejects the input", () => {
    expect(errorForStatus(400)).toMatch(/name, email address and amount/i);
  });

  it("asks the person to wait when they are rate limited", () => {
    expect(errorForStatus(429)).toMatch(/wait a minute/i);
  });

  it("asks the person to reload when the bot check fails", () => {
    expect(errorForStatus(403)).toMatch(/reload the page/i);
  });

  it("does not blame the input when the server fails", () => {
    expect(errorForStatus(500)).not.toMatch(/email address/i);
  });
});
