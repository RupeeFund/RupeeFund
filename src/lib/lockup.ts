function xRange(subpath: string): { min: number; max: number } {
  const xs: number[] = [];
  let command = "";
  let index = 0;
  for (const [, letter, number] of subpath.matchAll(/([A-Za-z])|(-?[\d.]+)/g)) {
    if (letter) {
      if (letter !== letter.toUpperCase() || letter === "A") {
        throw new Error(`unsupported path command ${letter}`);
      }
      command = letter;
      index = 0;
      continue;
    }
    if (command === "H" || (command !== "V" && index % 2 === 0)) xs.push(Number(number));
    index++;
  }
  if (xs.some(Number.isNaN)) throw new Error(`unreadable number in ${subpath}`);
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

export function splitLetters(d: string): string[] {
  const subpaths = d
    .split(/(?=M)/)
    .map((subpath) => ({ d: subpath, ...xRange(subpath) }))
    .sort((a, b) => b.max - b.min - (a.max - a.min));
  const letters: { d: string; min: number; max: number }[] = [];
  for (const subpath of subpaths) {
    const outer = letters.find((l) => subpath.min >= l.min && subpath.max <= l.max);
    if (outer) outer.d += subpath.d;
    else letters.push({ ...subpath });
  }
  return letters.sort((a, b) => a.min - b.min).map((l) => l.d);
}

export function heroLockup(svg: string): string {
  const wordmark = /<path id="wordmark"([^>]*?) d="([^"]*)"\/>/;
  if (!wordmark.test(svg)) throw new Error("logo.svg has no wordmark path");
  return svg
    .replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, "")
    .replace(wordmark, (_, attributes: string, d: string) => {
      const letters = splitLetters(d).map((letter, i) => `<path style="--i: ${i}" d="${letter}"/>`);
      return `<g id="wordmark"${attributes}>${letters.join("")}</g>`;
    });
}
