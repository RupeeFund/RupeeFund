import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";
import { FIXTURE } from "./fixture.ts";

describe("the policy pages", () => {
  for (const policy of FIXTURE.policies) {
    it(`renders ${policy.slug} from the cms with its title and effective date`, () => {
      const html = read(`${policy.slug}.html`);
      expect(html).toContain(`<h1 class="page-title text-ink mb-4">${policy.title}</h1>`);
      expect(html).toContain(`Effective date: ${policy.effectiveDate}.</p>`);
    });
  }
});
