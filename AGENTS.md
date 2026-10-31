# AGENTS.md

This is the website of The Rupee Fund, rupeefund.org. It collects a mailing list for a fund that FOSS United volunteers run. It takes no payment and holds no vote.

- **Stack:** `apps/web`: the site Worker. `apps/admin`: the admin Worker. `packages/db`: the D1 schema. `packages/auth`: the GitHub sign-in. `packages/ui`: the shared styles and the brand files. `scripts/`: the dev wrapper. More in `docs/ARCHITECTURE.md` section 2.
- **Look:** build the [brand guidelines](https://brand.rupeefund.org). Change a brand rule there. `docs/DESIGN.md` holds what only this repository uses.
- **Rules:** for each task, read `docs/README.md` and the doc that it names. Before each commit, read `docs/CONTRIBUTING.md` again and run its gate. Work from this read, not an earlier one.

Write a new rule in the doc that owns it. Keep this file a map.
