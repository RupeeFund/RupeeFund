# AGENTS.md

This is the website of The Rupee Fund, rupeefund.org. It collects a mailing list for a fund that FOSS United volunteers run. It takes no payment and holds no vote.

- **Stack:** a pnpm workspace that Turborepo runs. `apps/web` holds the site: Astro pages with Tailwind, and a Cloudflare Worker (Hono) that serves `/api/*`. `apps/admin` holds the admin panel, a second Worker. `apps/cms` holds the EmDash content manager, a third Worker. `packages/content` holds the content schema and the Portable Text renderer, `packages/site` the page components that the site and the draft preview share, `packages/db` the D1 schema, and `packages/ui` the shared styles and the brand files. The root `scripts/` holds the dev wrapper that the apps use.
- **Look:** the brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) (source: `RupeeFund/brand`) own every brand rule. Build them. To add or change a brand rule, change the guidelines. `docs/DESIGN.md` holds the components and details that only this repository uses.
- **Rules:** read `docs/README.md` at the start of each task. It routes each kind of change to the doc that owns it. Read that doc too. Before each commit, read `docs/CONTRIBUTING.md` again. Run its gate. Work from what you read now, not from an earlier read.

Write a new rule in the doc that owns it. Keep this file a map.
