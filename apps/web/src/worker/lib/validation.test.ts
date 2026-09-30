import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_MONTHS_LENGTH,
  MAX_NAME_LENGTH,
  MAX_QUESTION_LENGTH,
  ROLE_FIELDS,
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
        amount: "128",
        months: "",
        question: "",
        updates_opt_in: 0,
        is_foss_user: 0,
        is_foss_contributor: 0,
        is_student: 0,
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

  it("falls back to the default source when the value is not on the allowlist", () => {
    const result = validateWaitlist({ ...base, source: "somewhere-else" });
    expect(result).toMatchObject({ ok: true, value: { source: "subscribe" } });
  });

  it("keeps a source that is on the allowlist", () => {
    const result = validateWaitlist({ ...base, source: "FOOTER" });
    expect(result).toMatchObject({ ok: true, value: { source: "footer" } });
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
    expect(result).toMatchObject({ ok: true, value: { amount: "250" } });
  });

  it("rejects other with nothing typed beside it", () => {
    const result = validateWaitlist({ ...base, amount: "other", amount_other: "  " });
    expect(result).toEqual({ ok: false, errors: ["amount"] });
  });

  it("ignores a typed amount when a fixed option is chosen", () => {
    const result = validateWaitlist({ ...base, amount: "512", amount_other: "9999" });
    expect(result).toMatchObject({ ok: true, value: { amount: "512" } });
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
  for (const field of ROLE_FIELDS) {
    it(`stores 1 only for the ${field} box, so a crafted body cannot claim a role`, () => {
      const crafted = { is_foss_user: "yes", is_foss_contributor: "yes", is_student: "yes" };
      expect(validateWaitlist({ ...base, ...crafted, [field]: "1" })).toMatchObject({
        ok: true,
        value: { is_foss_user: 0, is_foss_contributor: 0, is_student: 0, [field]: 1 },
      });
    });
  }

  it("accepts a signup that ticks every box, because the roles overlap", () => {
    const body = { ...base, is_foss_user: "1", is_foss_contributor: "1", is_student: "1" };
    expect(validateWaitlist(body)).toMatchObject({
      ok: true,
      value: { is_foss_user: 1, is_foss_contributor: 1, is_student: 1 },
    });
  });
});
