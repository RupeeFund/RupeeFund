import { readFileSync, readdirSync } from "node:fs";

export const OUT = "dist-preview/client";

export const read = (file: string): string => readFileSync(`${OUT}/${file}`, "utf8");

export const headerOf = (file: string): string => {
  const html = read(file);
  return html.slice(html.indexOf("<header"), html.indexOf("</header>"));
};

export const PAGES: readonly string[] = readdirSync(OUT).filter((f) => f.endsWith(".html"));

export const styles = (): string =>
  readdirSync(`${OUT}/_astro`)
    .filter((f) => f.endsWith(".css"))
    .map((f) => read(`_astro/${f}`))
    .join("\n");
