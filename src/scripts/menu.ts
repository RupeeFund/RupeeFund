export function closeMenuOnExit(menu: HTMLDetailsElement): void {
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !menu.open) return;
    menu.open = false;
    menu.querySelector("summary")?.focus();
  });
  menu.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && menu.contains(next)) return;
    menu.open = false;
  });
}

export function initMenus(): void {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>("details[data-menu]")) {
    closeMenuOnExit(menu);
  }
}
