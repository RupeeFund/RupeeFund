import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const faq = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/faq" }),
  schema: z.object({
    question: z.string(),
    order: z.number().int(),
    home: z.boolean().default(false),
    sources: z.array(z.object({ title: z.string(), url: z.url() })).default([]),
  }),
});

export const collections = { faq };
