import { existsSync, readFileSync, readdirSync } from "node:fs";
import { RENDERED, type Answer } from "./routes.ts";

export const OUT = "dist-preview/client";

export const read = (file: string): string =>
  readFileSync(
    existsSync(`${RENDERED}/${file}`) ? `${RENDERED}/${file}` : `${OUT}/${file}`,
    "utf8",
  );

export const headerOf = (file: string): string => {
  const html = read(file);
  return html.slice(html.indexOf("<header"), html.indexOf("</header>"));
};

export const PAGES: readonly string[] = readdirSync(RENDERED).filter((f) => f.endsWith(".html"));

export const answers = (): Record<string, Answer> => JSON.parse(read("answers.json"));

export const styles = (): string =>
  readdirSync(`${OUT}/_astro`)
    .filter((f) => f.endsWith(".css"))
    .map((f) => read(`_astro/${f}`))
    .join("\n");
