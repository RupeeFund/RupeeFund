const PATHS: Readonly<Record<string, string>> = {
  signups: "M5 20V10M12 20V4M19 20v-7",
  records: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  people: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7",
  chevron: "M6 9l6 6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  eye:
    "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12" +
    "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5",
  dot: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8",
  minus: "M6 12h12",
  check: "M5 12.5l5 5 9-9",
  question: "M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.6M12 17h.01",
  refresh: "M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

const ICON_NAMES = Object.keys(PATHS);

export function icon(name: string): string {
  return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-${name}"/></svg>`;
}

export function sprite(): string {
  const symbols = ICON_NAMES.map(
    (name) =>
      `<symbol id="i-${name}" viewBox="0 0 24 24">` +
      `<path d="${PATHS[name]}" vector-effect="non-scaling-stroke"/></symbol>`,
  );
  return `<svg class="sprite" id="sprite" aria-hidden="true" focusable="false">${symbols.join(
    "",
  )}</svg>`;
}
