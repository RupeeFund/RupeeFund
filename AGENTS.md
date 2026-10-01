# AGENTS.md

This is the website of The Rupee Fund, rupeefund.org. It collects a mailing list for a fund that FOSS United volunteers run. It takes no payment and holds no vote.

- **Stack:** a pnpm workspace that Turborepo runs. `apps/web` holds the site: Astro pages with Tailwind, and a Cloudflare Worker (Hono) that serves `/api/*`. `apps/admin` holds the admin panel, a second Worker. `packages/db` holds the D1 schema, `packages/ui` the shared styles and the brand files. The root `scripts/` holds the dev wrapper that both apps use.
- **Look:** the brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) (source: `RupeeFund/brand`) own every design rule. Build them. To add or change a design rule, change the guidelines. Read `docs/DESIGN.md` for what this repository adds.
- **Rules:** read `docs/README.md` at the start of each task. It routes each kind of change to the doc that owns it. Read that doc too. Before each commit, read `docs/CONTRIBUTING.md` again. Run its gate. Work from what you read now, not from an earlier read.

Write a new rule in the doc that owns it. Keep this file a map.
