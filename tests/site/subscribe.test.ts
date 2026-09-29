// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { OUT } from "./dist.ts";

let html = "";
let bundle = "";
beforeAll(() => {
  html = readFileSync(`${OUT}/subscribe.html`, "utf8");
  bundle = [...inlineModules(), ...externalModules()].join("\n");
});

// Astro inlines a small enough island and emits a file for a larger one. The
// waitlist script sits near that threshold, so read both rather than assume.
function inlineModules(): string[] {
  return [...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function externalModules(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...html.matchAll(/\/_astro\/[^"']+\.js/g)].map((m) => resolve(OUT, `.${m[0]}`));
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const source = readFileSync(path, "utf8");
    out.push(source);
    for (const m of source.matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g)) {
      queue.push(resolve(dirname(path), m[1]));
    }
  }
  return out;
}

function amountGroup(): string {
  const start = html.indexOf('<legend class="field-label">Monthly amount');
  return html.slice(start, html.indexOf("</fieldset>", start));
}

describe("Subscribe page (/subscribe)", () => {
  it("renders the waitlist form with name and email", () => {
    expect(html).toContain('id="waitlist-form"');
    expect(html).toContain('id="waitlist-name"');
    expect(html).toContain('id="waitlist-email"');
  });

  it("offers three fixed amounts and an other option, all as radios", () => {
    const radios = [...html.matchAll(/<input[^>]*name="amount"[^>]*>/g)].map((m) => m[0]);
    expect(radios).toHaveLength(4);
    for (const radio of radios) expect(radio).toContain('type="radio"');
    for (const value of ["15", "128", "512", "other"]) {
      expect(radios.some((r) => r.includes(`value="${value}"`))).toBe(true);
    }
  });

  it("marks the amount required, so the browser asks before it posts", () => {
    const radios = [...html.matchAll(/<input[^>]*name="amount"[^>]*>/g)].map((m) => m[0]);
    for (const radio of radios) expect(radio).toContain("required");
  });

  it("asks the amount without JavaScript, so the no-script post carries one", () => {
    expect(bundle).not.toContain("amount-other-choice");
    expect(html).toContain('name="amount_other"');
  });

  it("renders the months and question fields inside the same form", () => {
    expect(html).toContain('id="waitlist-months"');
    expect(html).toContain('id="waitlist-question"');
  });

  it("renders the updates checkbox unticked, so a signup opts in only by choice", () => {
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*name="updates"[^>]*value="1"/);
    expect(html).not.toMatch(/<input[^>]*name="updates"[^>]*checked/);
  });

  it("promises no longer that the launch email is the only email, on either outcome page", () => {
    const confirmed = readFileSync(`${OUT}/waitlist-confirmed.html`, "utf8");
    for (const page of [html, confirmed]) {
      expect(page.toLowerCase()).not.toContain("nothing else");
    }
  });

  it("keeps the other amount inside the amount group, not as a question of its own", () => {
    const group = amountGroup();
    expect(group).toContain('name="amount_other"');
    expect(group).toContain('value="other"');
  });

  it("asks the audience roles as optional checkboxes, in the order the issue names", () => {
    const boxes = [...html.matchAll(/<input[^>]*name="is_[a-z_]+"[^>]*>/g)].map((m) => m[0]);
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box).toContain('type="checkbox"');
      expect(box).toContain('value="1"');
      expect(box).not.toContain("required");
      expect(box).not.toContain("checked");
    }
    expect(boxes.map((b) => /name="(is_[a-z_]+)"/.exec(b)?.[1])).toEqual([
      "is_foss_user",
      "is_foss_contributor",
      "is_student",
    ]);
  });

  it("keeps the roles out of the amount group, so each question stands alone", () => {
    expect(amountGroup()).not.toContain('name="is_');
  });

  it("labels the role group and every box, so the question reads without the field names", () => {
    expect(html).toContain('<legend class="field-label">I am a <span class="field-optional">');
    for (const label of ["FOSS user", "FOSS contributor", "Student"]) {
      expect(html).toContain(`<span>${label}</span>`);
    }
  });

  it("marks a field optional exactly when it is not required, as the brand forms rule asks", () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
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
    expect(html).toMatch(/id="waitlist-amount-other"[^>]*maxlength="20"/);
    expect(html).toMatch(/id="waitlist-months"[^>]*maxlength="20"/);
    expect(html).toMatch(/id="waitlist-question"[^>]*maxlength="100"/);
  });

  it("renders no payment form and asks for no PAN or address", () => {
    expect(html).not.toContain('id="autopay-form"');
    expect(html).not.toContain('id="autopay-pan"');
    expect(html).not.toContain('id="autopay-address"');
  });

  it("loads no payment provider script", () => {
    expect(html).not.toContain("razorpay");
  });

  it("wires the waitlist submit path into the shipped island", () => {
    expect(html).toContain('<script type="module"');
    expect(bundle).toContain("/api/waitlist");
  });

  it("has exactly one h1", () => {
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("sets the subscribe title", () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });
});
