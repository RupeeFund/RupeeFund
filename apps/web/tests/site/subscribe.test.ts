// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { OUT } from "./dist.ts";

let html = "";
let doc: Document;
beforeAll(() => {
  html = readFileSync(`${OUT}/subscribe.html`, "utf8");
  doc = new DOMParser().parseFromString(html, "text/html");
});

const inputs = (selector: string): HTMLInputElement[] => [
  ...doc.querySelectorAll<HTMLInputElement>(selector),
];

describe("Subscribe page (/subscribe)", () => {
  it("offers three fixed amounts and an other option, all as radios", () => {
    expect(inputs('input[name="amount"]').map((r) => [r.type, r.value])).toEqual([
      ["radio", "15"],
      ["radio", "128"],
      ["radio", "512"],
      ["radio", "other"],
    ]);
  });

  it("renders the updates checkbox unticked, so a signup opts in only by choice", () => {
    const [updates] = inputs('input[name="updates"]');
    expect([updates?.type, updates?.value, updates?.defaultChecked]).toEqual([
      "checkbox",
      "1",
      false,
    ]);
  });

  it("promises no longer that the launch email is the only email, on either outcome page", () => {
    const confirmed = readFileSync(`${OUT}/waitlist-confirmed.html`, "utf8");
    for (const page of [html, confirmed]) {
      expect(page.toLowerCase()).not.toContain("nothing else");
    }
  });

  it("keeps the other amount in the amount group and the roles out of it", () => {
    const group = doc.querySelector('input[name="amount"]')?.closest("fieldset");
    expect(group?.querySelector('input[name="amount_other"]')).not.toBeNull();
    expect(group?.querySelector('input[name^="is_"]')).toBeNull();
  });

  it("asks the roles as optional, unticked boxes, in the order the issue names", () => {
    const boxes = inputs('input[name^="is_"]');
    expect(boxes.map((b) => [b.name, b.type, b.value, b.required, b.defaultChecked])).toEqual([
      ["is_foss_user", "checkbox", "1", false, false],
      ["is_foss_contributor", "checkbox", "1", false, false],
      ["is_student", "checkbox", "1", false, false],
    ]);
    expect(boxes.map((b) => b.closest("label")?.textContent?.trim())).toEqual([
      "FOSS user",
      "FOSS contributor",
      "Student",
    ]);
  });

  it("marks a field optional exactly when it is not required, as the brand forms rule asks", () => {
    const marks = [...doc.querySelectorAll(".field-label")].map((label) => {
      const control =
        label.tagName === "LEGEND"
          ? label.parentElement
          : doc.getElementById(label.getAttribute("for") ?? "");
      const text = label.textContent ?? "";
      return {
        text,
        required: Boolean(control?.matches("[required]") || control?.querySelector("[required]")),
        optional: text.includes("(optional)"),
      };
    });
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.filter((m) => m.text.includes("*"))).toEqual([]);
    expect(marks.filter((m) => m.optional === m.required)).toEqual([]);
  });

  it("caps the free-text answers at the lengths the columns hold", () => {
    const cap = (id: string): number => (doc.getElementById(id) as HTMLInputElement).maxLength;
    expect([
      cap("waitlist-amount-other"),
      cap("waitlist-months"),
      cap("waitlist-question"),
    ]).toEqual([20, 20, 100]);
  });

  it("takes no payment: no payment form, no PAN or address, no payment provider script", () => {
    for (const id of ["autopay-form", "autopay-pan", "autopay-address"]) {
      expect(doc.getElementById(id)).toBeNull();
    }
    expect(html).not.toContain("razorpay");
  });
});
