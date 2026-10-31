# Deployment

A maintainer deploys the site. The deploy steps are in the private [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md).

## 1. The branch model

| Branch | Site                                      | Trigger   |
| ------ | ----------------------------------------- | --------- |
| `main` | none                                      | never     |
| `live` | `rupeefund.org` and `admin.rupeefund.org` | a promote |

- A merge to `main` deploys nothing. A promote moves `live` forward to a commit on `main`. `live` is always a prefix of `main`, so a promote takes that commit and each one before it.
- Cloudflare Workers Builds then deploys each Worker whose files changed.
- The build is the only gate. It runs `pnpm check`, then the migration check (section 4). When a step fails, nothing deploys.
- CI on `main` and the browser tests do not stop a deploy.

## 2. How to prove a change

Prove each change on your own machine, with the gate in `docs/CONTRIBUTING.md`. No test reaches the live database. To read the local rows:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --local --persist-to ../../.wrangler/state --command "SELECT email, consent_at FROM waitlist"
```

## 3. How to change a content field

Change the field in `apps/web/seed/seed.json` and in the code. A maintainer changes the live field with an API token (section 11.5 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md)). The site shows only the fields that its code reads (`docs/ARCHITECTURE.md` section 11.6). Keep this order, so that each version of the code finds the fields that it reads:

- **Add:** add the field and fill it in each entry. Then promote the code that reads it.
- **Remove:** promote the code that no longer reads it. Then remove the field.

## 4. The migrations

The deployment applies no migration. A maintainer applies each new one to the live database before the promote (section 4 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md)). The build refuses a commit with a migration that the live database has not applied.

- **Make each migration additive.** During a promote, two Worker versions read the one live database. Add a column with a default or with NULL permitted. To remove a column, use two promotes: one stops all reads of it, a later one drops it.
- **`0005_signup_data.sql` is the one exception.** It rebuilds the `waitlist` table.
- **Never edit a migration that has run. Never reuse a file name.** Wrangler matches by file name only: a changed file that has run does nothing, and a reused name runs nothing and reports no error. `packages/db/tests/replay.test.ts` refuses the retired names.

## 5. The page addresses

A firewall rule on the zone blocks each path that starts with `/wp-` or ends with `.php`. Do not give a page such a path.

## 6. Secrets and variables

- `TURNSTILE_ACTION` in `apps/web/src/lib/turnstile.ts` (the widget) must match `apps/web/wrangler.jsonc` (the Worker). `pnpm run build` fails when they differ.
- `pnpm dev` and `pnpm preview` set the Turnstile test values themselves. Do not put a Turnstile value in `.env`. A deployed build with the test sitekey refuses every signup, so `pnpm run build` exits 1 on it.
- `pnpm preview` needs the client secret of the GitHub App. Only a maintainer holds it. Others use `pnpm dev`.
- Do not put a Cloudflare account ID in `wrangler.jsonc`.

## 7. How to open the fund

On the day the fund takes money, change each word that says that the fund takes no payment or is not open. Then a maintainer promotes.

- The code: `apps/web/src/pages/subscribe.astro`, `apps/web/src/pages/waitlist-confirmed.astro`, `apps/web/src/components/site/SignupCard.astro`, `apps/web/src/components/home/Supporters.astro` and the two `/refunds` descriptions in `apps/web/src/lib/seo.ts`. Also change the pledge words (**pledged for each season**, **Join … others who have pledged**) in `Supporters.astro` and `SignupCard.astro`. They count pledges, not money.
- The tests that check these words: `apps/web/src/components/site/render.test.ts`, `apps/web/tests/site/subscribe.test.ts` and `apps/web/tests/site/csp.test.ts`.
- The docs: `docs/ARCHITECTURE.md` (**It takes no payment**) and `AGENTS.md`.
- The content manager (`docs/EDITING.md`), then the same words in `apps/web/seed/seed.json` and `apps/web/src/content/entries.fixture.json`: **Pages** › `privacy`, `terms` and `refunds`, and **FAQ** › `who-runs`, `start-date` and `your-data`. In `refunds`, publish the refund contact, the claim period and the steps to cancel a recurring payment.
