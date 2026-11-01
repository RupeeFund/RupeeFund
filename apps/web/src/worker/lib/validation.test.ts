import { REASON_FIELDS, ROLE_FIELDS } from "@rupeefund/db/schema";
import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_MONTHS_LENGTH,
  MAX_NAME_LENGTH,
  MAX_QUESTION_LENGTH,
  validateWaitlist,
} from "./validation.ts";

const base = { name: "Asha", email: "Asha@Example.com", source: "subscribe", amount: "128" };

describe("validateWaitlist", () => {
  it("accepts a well-formed entry and lowercases the address", () => {
    const result = validateWaitlist(base);
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Asha",
        email: "asha@example.com",
        source: "subscribe",
        amount: 128,
        months: "",
        question: "",
        updates_opt_in: 0,
        is_user: 0,
        is_creator: 0,
        is_professional: 0,
        is_student: 0,
        backs_nascent: 0,
        backs_growing: 0,
        backs_larger: 0,
      },
    });
  });

  it("rejects a body that is not an object", () => {
    expect(validateWaitlist("nope")).toEqual({ ok: false, errors: ["body"] });
  });

  it("rejects a malformed address", () => {
    const result = validateWaitlist({ ...base, email: "nope" });
    expect(result).toEqual({ ok: false, errors: ["email"] });
  });

  it("rejects an empty name", () => {
    const result = validateWaitlist({ ...base, name: "   " });
    expect(result).toEqual({ ok: false, errors: ["name"] });
  });

  it("rejects a name past the column budget", () => {
    const result = validateWaitlist({ ...base, name: "a".repeat(MAX_NAME_LENGTH + 1) });
    expect(result).toEqual({ ok: false, errors: ["name"] });
  });

  it("rejects an address past the column budget", () => {
    const long = `${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`;
    const result = validateWaitlist({ ...base, email: long });
    expect(result).toEqual({ ok: false, errors: ["email"] });
  });

  it("writes the one form as the source, whatever the body says", () => {
    const result = validateWaitlist({ ...base, source: "footer" });
    expect(result).toMatchObject({ ok: true, value: { source: "subscribe" } });
  });

  it("stores one spelling for an address typed composed or decomposed", () => {
    const composed = validateWaitlist({ ...base, email: "José@example.com" });
    const decomposed = validateWaitlist({ ...base, email: "Jose\u0301@example.com" });
    expect([composed, decomposed]).toMatchObject([
      { ok: true, value: { email: "josé@example.com" } },
      { ok: true, value: { email: "josé@example.com" } },
    ]);
  });

  it("stores one spelling for a domain typed in Unicode or in punycode", () => {
    const unicode = validateWaitlist({ ...base, email: "a@BÜCHER.example" });
    const ascii = validateWaitlist({ ...base, email: "a@xn--bcher-kva.example" });
    expect([unicode, ascii]).toMatchObject([
      { ok: true, value: { email: "a@xn--bcher-kva.example" } },
      { ok: true, value: { email: "a@xn--bcher-kva.example" } },
    ]);
  });

  it("refuses a domain that a URL parser would read as a port, a path or a query", () => {
    const refused = ["a@example.com:80", "a@example.com/x", "a@example.com?x", "a@exa%41mple.com"]
      .map((email) => validateWaitlist({ ...base, email }))
      .filter((result) => !result.ok);
    expect(refused).toHaveLength(4);
  });

  it("refuses an address that carries a control or an invisible format character", () => {
    const refused = ["a\u0000@example.com", "a\u200b@example.com", "a@exa\u202emple.com"]
      .map((email) => validateWaitlist({ ...base, email }))
      .filter((result) => !result.ok);
    expect(refused).toHaveLength(3);
  });

  it("refuses a name with a control character, or only invisible characters", () => {
    expect(
      ["A\u0000sha", "\u200b\u200d", "\u202e"].map((name) => validateWaitlist({ ...base, name })),
    ).toEqual(Array(3).fill({ ok: false, errors: ["name"] }));
  });

  it("keeps a joiner inside a name, because some scripts need it", () => {
    const name = "\u0915\u094d\u200d\u0937";
    expect(validateWaitlist({ ...base, name })).toMatchObject({ ok: true, value: { name } });
  });

  it("reports every failed field at once", () => {
    const result = validateWaitlist({ name: "", email: "nope" });
    expect(result).toEqual({ ok: false, errors: ["name", "email", "amount"] });
  });
});

describe("validateWaitlist reads the contribution answers", () => {
  it("rejects an entry that names no amount, because the team asked for it", () => {
    const { amount: _drop, ...noAmount } = base;
    expect(validateWaitlist(noAmount)).toEqual({ ok: false, errors: ["amount"] });
  });

  it("reads the typed amount when the subscriber chose other", () => {
    const result = validateWaitlist({ ...base, amount: "other", amount_other: " 250 " });
    expect(result).toMatchObject({ ok: true, value: { amount: 250 } });
  });

  it("rejects other with nothing typed beside it", () => {
    const result = validateWaitlist({ ...base, amount: "other", amount_other: "  " });
    expect(result).toEqual({ ok: false, errors: ["amount"] });
  });

  it("ignores a typed amount when a fixed option is chosen", () => {
    const result = validateWaitlist({ ...base, amount: "512", amount_other: "9999" });
    expect(result).toMatchObject({ ok: true, value: { amount: 512 } });
  });

  it("rejects an amount past the column budget", () => {
    const result = validateWaitlist({
      ...base,
      amount: "other",
      amount_other: "9".repeat(MAX_AMOUNT_LENGTH + 1),
    });
    expect(result).toEqual({ ok: false, errors: ["amount"] });
  });

  it("keeps the months answer as free text, so 12+ survives", () => {
    expect(validateWaitlist({ ...base, months: " 12+ " })).toMatchObject({
      ok: true,
      value: { months: "12+" },
    });
  });

  it("rejects a months answer past the column budget", () => {
    const result = validateWaitlist({ ...base, months: "a".repeat(MAX_MONTHS_LENGTH + 1) });
    expect(result).toEqual({ ok: false, errors: ["months"] });
  });

  it("keeps the question the subscriber asks the team", () => {
    expect(validateWaitlist({ ...base, question: " Who audits this? " })).toMatchObject({
      ok: true,
      value: { question: "Who audits this?" },
    });
  });

  it("rejects a question past the column budget", () => {
    const result = validateWaitlist({ ...base, question: "a".repeat(MAX_QUESTION_LENGTH + 1) });
    expect(result).toEqual({ ok: false, errors: ["question"] });
  });
});

describe("validateWaitlist reads the updates checkbox", () => {
  it("stores 1 for the value the checkbox sends", () => {
    expect(validateWaitlist({ ...base, updates: "1" })).toMatchObject({
      ok: true,
      value: { updates_opt_in: 1 },
    });
  });

  it("stores 0 for any other string, so a crafted body cannot opt someone in", () => {
    expect(validateWaitlist({ ...base, updates: "yes" })).toMatchObject({
      ok: true,
      value: { updates_opt_in: 0 },
    });
  });
});

describe("validateWaitlist reads the audience checkboxes", () => {
  const every = (value: string | number) =>
    Object.fromEntries(ROLE_FIELDS.map((field) => [field, value]));

  for (const field of ROLE_FIELDS) {
    it(`stores 1 only for the ${field} box, so a crafted body cannot claim a role`, () => {
      expect(validateWaitlist({ ...base, ...every("yes"), [field]: "1" })).toMatchObject({
        ok: true,
        value: { ...every(0), [field]: 1 },
      });
    });
  }

  it("accepts a signup that ticks every box, because the roles overlap", () => {
    expect(validateWaitlist({ ...base, ...every("1") })).toMatchObject({
      ok: true,
      value: every(1),
    });
  });
});

describe("validateWaitlist reads the reason checkboxes", () => {
  const every = (value: string | number) =>
    Object.fromEntries(REASON_FIELDS.map((field) => [field, value]));

  for (const field of REASON_FIELDS) {
    it(`stores 1 only for the ${field} box, so a crafted body cannot claim a reason`, () => {
      expect(validateWaitlist({ ...base, ...every("yes"), [field]: "1" })).toMatchObject({
        ok: true,
        value: { ...every(0), [field]: 1 },
      });
    });
  }
});

describe("validateWaitlist reads the intended amount as whole rupees", () => {
  for (const [typed, amount] of [
    ["1,000", 1000],
    ["₹ 250", 250],
    ["0042", 42],
  ] as const) {
    it(`keeps an intended amount typed as ${typed} as ${amount}`, () => {
      const result = validateWaitlist({ ...base, amount: "other", amount_other: typed });
      expect(result).toMatchObject({ ok: true, value: { amount } });
    });
  }

  for (const typed of ["1k", "0", "3.14", "-5"]) {
    it(`refuses an intended amount typed as ${typed}`, () => {
      const result = validateWaitlist({ ...base, amount: "other", amount_other: typed });
      expect(result).toEqual({ ok: false, errors: ["amount"] });
    });
  }

  it("refuses an intended amount that is not one of the fixed options", () => {
    expect(validateWaitlist({ ...base, amount: "100" })).toEqual({ ok: false, errors: ["amount"] });
  });
});
