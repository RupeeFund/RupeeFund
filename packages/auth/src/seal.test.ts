import { describe, expect, it } from "vitest";
import { open, seal } from "./seal.ts";

const SECRET = "a-secret-of-enough-length-for-tests";
const NOW = 1_800_000_000_000;

describe("seal", () => {
  it("opens what it sealed before the expiry", async () => {
    const token = await seal({ email: "a@example.com", name: "Ādi Ñ" }, SECRET, 60, NOW);
    expect(await open(token, SECRET, NOW + 59_000)).toEqual({
      email: "a@example.com",
      name: "Ādi Ñ",
    });
  });

  it("refuses a token at its expiry", async () => {
    const token = await seal({ role: 50 }, SECRET, 60, NOW);
    expect(await open(token, SECRET, NOW + 60_000)).toBeNull();
  });

  it("refuses a token sealed with another secret", async () => {
    const token = await seal({ role: 50 }, "another-secret-of-enough-length", 60, NOW);
    expect(await open(token, SECRET, NOW)).toBeNull();
  });

  it("refuses a token with a changed body", async () => {
    const token = await seal({ role: 30 }, SECRET, 60, NOW);
    const [, mac] = token.split(".");
    const body = Buffer.from(JSON.stringify({ role: 50, exp: NOW + 60_000 })).toString("base64url");
    expect(await open(`${body}.${mac}`, SECRET, NOW)).toBeNull();
  });

  it.each([undefined, "", "abc", "a.b.c", ".", "%%%.%%%"])(
    "refuses the malformed token %j",
    async (token) => {
      expect(await open(token, SECRET, NOW)).toBeNull();
    },
  );

  it("refuses an empty secret", async () => {
    await expect(seal({ role: 50 }, "", 60, NOW)).rejects.toThrow("secret");
    const token = await seal({ role: 50 }, SECRET, 60, NOW);
    expect(await open(token, "", NOW)).toBeNull();
  });
});
