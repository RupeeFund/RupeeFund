import { beforeEach, describe, expect, it } from "vitest";
import { closeMenuOnExit } from "./menu.ts";

function setup(): { menu: HTMLDetailsElement; summary: HTMLElement; link: HTMLAnchorElement } {
  document.body.innerHTML = `
    <details id="menu" open>
      <summary>Menu</summary>
      <nav><a id="inside" href="/people">People</a></nav>
    </details>
    <a id="outside" href="/">Next</a>`;
  const menu = document.getElementById("menu") as HTMLDetailsElement;
  closeMenuOnExit(menu);
  return {
    menu,
    summary: menu.querySelector("summary") as HTMLElement,
    link: document.getElementById("inside") as HTMLAnchorElement,
  };
}

describe("closeMenuOnExit", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("closes the menu on Escape and returns focus to its button", () => {
    const { menu, summary, link } = setup();
    link.focus();

    link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it("closes the menu when focus leaves it, so the panel covers no focused control", () => {
    const { menu, link } = setup();
    link.focus();

    (document.getElementById("outside") as HTMLAnchorElement).focus();

    expect(menu.open).toBe(false);
  });

  it("keeps the menu open while focus moves inside it", () => {
    const { menu, summary, link } = setup();
    summary.focus();

    link.focus();

    expect(menu.open).toBe(true);
  });
});
