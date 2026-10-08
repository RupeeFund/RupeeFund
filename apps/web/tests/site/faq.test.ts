import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";
import { FAQ } from "../fixtures/content.ts";

const entries = FAQ.toSorted((a, b) => a.order - b.order);

const questions = (html: string): string[] =>
  [...html.matchAll(/<summary[^>]*>\s*<span>([^<]*)<\/span>/g)].map(([, q]) => q);

const FIGURE = /[₹$]\s?\d|\d\s?(crore|lakh|million)\b/i;

describe("the questions", () => {
  it("lists every question on /faq, in order", () => {
    expect(questions(read("faq.html"))).toEqual(entries.map((e) => e.question));
  });

  it("lists only the home questions on the home page, with a link to the rest", () => {
    const home = read("index.html");
    expect(questions(home)).toEqual(entries.filter((e) => e.home).map((e) => e.question));
    const ghost = /<p class="faq-ghost">([\s\S]*?)<\/p>/.exec(home)?.[1] ?? "";
    expect(ghost).toMatch(/^\s*<a [^>]*href="\/faq"[^>]*>\s*See all questions\s*<\/a>\s*$/);
  });

  it("gives each question its own place in the order", () => {
    expect(new Set(entries.map((e) => e.order)).size).toBe(entries.length);
  });

  it("cites a source for each answer that states a figure", () => {
    const figured = read("faq.html")
      .split("<details")
      .slice(1)
      .filter((answer) => FIGURE.test(answer.split("faq-sources")[0].replace(/<[^>]*>/g, " ")));
    const uncited = figured.filter((a) => !/faq-sources[\s\S]*<a [^>]*href="https:/.test(a));
    expect([figured.length > 0, uncited]).toEqual([true, []]);
  });
});
