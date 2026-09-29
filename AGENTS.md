# AGENTS.md

This is the website of The Rupee Fund, rupeefund.org. It collects a mailing list for a fund that FOSS United volunteers run. It takes no payment and holds no vote.

- **Stack:** Astro pages with Tailwind in `src/`. A Cloudflare Worker (Hono) in `src/worker/` serves `/api/*`. `migrations/` holds the D1 schema.
- **Map:** `src/pages/` has one file per page, `src/layouts/` the page frames, `src/components/` the shared markup, `src/scripts/` the browser code, `src/brand/` the colour tokens that `pnpm brand:sync` writes, and `src/index.css` every other style. A unit test sits next to its module. `tests/` holds the build, browser, migration and deploy tests.
- **Look:** the brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) (source: `RupeeFund/brand`) own every design rule. Build them. To add or change a design rule, change the guidelines.
- **Rules:** read `docs/CONTRIBUTING.md` at the start of each task and again before each commit. It holds the gate and routes each kind of change to the doc that owns it. Read that doc too. Work from what you read now, not from an earlier read.

Write a new rule in the doc that owns it. Keep this file a map.
