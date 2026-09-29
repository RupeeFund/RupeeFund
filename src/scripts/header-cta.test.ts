import { describe, expect, it } from "vitest";
import { followHeroCta } from "./header-cta.ts";

describe("followHeroCta", () => {
  it("shows only the icon while the hero button is in view, and the label once it leaves", () => {
    document.body.innerHTML = `<a id="cta" data-compact></a><a id="hero"></a>`;
    const cta = document.getElementById("cta") as HTMLElement;
    const hero = document.getElementById("hero") as HTMLElement;
    let report: (visible: boolean) => void = () => {};
    let watched: Element | undefined;

    followHeroCta(cta, hero, (target, onChange) => {
      watched = target;
      report = onChange;
    });
    report(false);
    const afterLeave = cta.hasAttribute("data-compact");
    report(true);

    expect([watched, afterLeave, cta.hasAttribute("data-compact")]).toEqual([hero, false, true]);
  });
});
