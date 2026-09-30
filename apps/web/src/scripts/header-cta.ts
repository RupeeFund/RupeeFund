type Watch = (target: Element, onChange: (visible: boolean) => void) => void;

const inView: Watch = (target, onChange) => {
  const top = document.querySelector("header")?.offsetHeight ?? 0;
  const observer = new IntersectionObserver(([entry]) => onChange(entry?.isIntersecting ?? false), {
    rootMargin: `-${top}px 0px 0px 0px`,
  });
  observer.observe(target);
};

export function followHeroCta(cta: HTMLElement, hero: Element, watch: Watch = inView): void {
  watch(hero, (visible) => cta.toggleAttribute("data-compact", visible));
}

export function initHeaderCta(): void {
  const cta = document.querySelector<HTMLElement>("[data-header-cta]");
  const hero = document.querySelector("[data-hero-cta]");
  if (cta && hero) followHeroCta(cta, hero);
}
