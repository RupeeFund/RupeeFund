import type { z } from "zod";
import type { faqEntry, page, person, post } from "./schema.ts";

export const para = (text: string) => [
  {
    _type: "block" as const,
    style: "normal" as const,
    markDefs: [],
    children: [{ _type: "span" as const, text, marks: [] }],
  },
];

export const validPost = (): z.input<typeof post> => ({
  slug: "hello",
  title: "Hello",
  excerpt: "First post.",
  image: { src: "/media/01ABC.png", alt: "A red box", width: 8, height: 6 },
  body: para("Body."),
  publishedAt: "2026-10-02T17:40:48.365Z",
});

export const validFaq = (): z.input<typeof faqEntry> => ({
  slug: "voting",
  question: "How does voting work?",
  answer: para("You vote."),
  order: 1,
  home: true,
  sources: [{ title: "FOSS United grants", url: "https://fossunited.org/grants" }],
});

export const validPerson = (): z.input<typeof person> => ({
  slug: "mrugesh",
  name: "Mrugesh Mohapatra",
  bio: "Bio.",
  profileUrl: "https://fossunited.org/u/mrugesh",
  username: "mrugesh",
  photoUrl: "https://github.com/raisedadead.png?size=128",
  order: 1,
});

export const validPage = (): z.input<typeof page> => ({
  slug: "terms",
  title: "Terms",
  kind: "legal",
  effectiveDate: "25 September 2026",
  body: para("Policy."),
});
