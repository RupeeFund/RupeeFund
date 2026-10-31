# Deployment

A maintainer deploys the site. This document gives the rules that each change follows, so that it deploys safely. The deploy steps are in the private [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md).

## 1. The branch model

| Branch | Site                                      | Trigger   |
| ------ | ----------------------------------------- | --------- |
| `main` | none                                      | never     |
| `live` | `rupeefund.org` and `admin.rupeefund.org` | a promote |

Pull requests go to `main`. A merge deploys nothing. A maintainer promotes: `live` moves forward to a commit on `main`. Then Cloudflare Workers Builds builds and deploys each Worker whose files changed. `live` is always a prefix of `main`, so a promote takes a commit and each commit before it.

The build is the only gate of a deploy. `pnpm check` runs first. The build of each Worker also checks that the live database applied each migration (section 4). When a step fails, nothing deploys, and the earlier version stays live. CI on `main` and the browser tests are signals. They do not stop a deploy.

## 2. How to prove a change

You prove every change on your own machine. No test reaches the live database.

Run the gate in `docs/CONTRIBUTING.md`. `pnpm dev` and the gate use the always-pass Turnstile test pair, so the form completes with no real widget. Read the local rows:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --local --persist-to ../../.wrangler/state --command "SELECT email, consent_at FROM waitlist"
```

## 3. How to change a content field

The site shows only the fields that its code reads (`docs/ARCHITECTURE.md` section 11.6). Change the field in `apps/web/seed/seed.json` and in the code. A maintainer changes the live field with an API token (section 11.5 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md)).

Keep this order, so that each version of the code finds the fields that it reads:

- **To add a field.** Add it, and fill it in each entry. Then promote the code that reads it.
- **To remove a field.** Promote the code that stops reading it. Then remove it.

## 4. The migrations

The deployment applies no migration. A maintainer applies each new migration to the live database before the promote (section 4 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md)). The build refuses a commit with a migration that the live database has not applied.

**Make each migration additive.** During a promote two Worker versions read the one live database. Add a column with a default or with NULL permitted. A change that removes a column needs two promotes: one that stops all reads of the column, and a later one that drops it.

**`0005_signup_data.sql` is the one exception.** It rebuilds the `waitlist` table.

Never edit a migration that has run. Never reuse a file name. Wrangler matches a migration by file name only. A changed file that has run does nothing. A reused file name runs nothing and reports no error. `packages/db/tests/replay.test.ts` refuses the retired names.

## 5. The page addresses

A firewall rule on the zone blocks each path that starts with `/wp-` or ends with `.php`. Do not give a page such a path.

## 6. Secrets and variables

`TURNSTILE_ACTION` has two homes. The Turnstile widget uses the constant in `apps/web/src/lib/turnstile.ts`. The Worker checks the variable in `apps/web/wrangler.jsonc`. The two must match. `pnpm run build` fails when they differ.

`pnpm dev` and `pnpm preview` carry the always-pass Turnstile test values and `PUBLIC_ALLOW_TEST_SITEKEY=true` themselves. Do not put a Turnstile value in `.env`. A deployed build with the test sitekey refuses every signup, so `pnpm run build` exits 1 when it finds one.

`pnpm preview` also needs the client secret of the GitHub App. Only a maintainer holds it. Other contributors use `pnpm dev`, which signs in without GitHub.

Do not put a Cloudflare account ID in `wrangler.jsonc`.

## 7. How to open the fund

The site says that the fund takes no payment yet. On the day the fund takes money, change each place below. Then a maintainer promotes (section 1).

In the code:

- `apps/web/src/pages/subscribe.astro`: the intro (**Nothing to pay today**) and the consent line (**By signing up, you agree**).
- `apps/web/src/pages/waitlist-confirmed.astro`: **No payment yet**.
- `apps/web/src/components/site/SignupCard.astro`: the heading **Hear when the fund opens** and **Nothing to pay today**.
- `apps/web/src/lib/seo.ts`: the two descriptions of `/refunds` (**This site takes no payments yet**).
- `apps/web/src/components/home/Supporters.astro` and `apps/web/src/components/site/SignupCard.astro`: the pledge figures (**pledged for each season**, **Join … others who have pledged**). They count the pledges on the list, not money.

In the content manager (`docs/EDITING.md`), then the same words in `apps/web/seed/seed.json` and `apps/web/src/content/entries.fixture.json`:

- **Pages** › `privacy`: the paragraph with **We take no payment. We hold no payment details.**
- **Pages** › `terms`: the sections **Before the fund opens** and **Before contributions open**.
- **Pages** › `refunds`: the section **Before the fund opens**, and **follow the rules that we publish before contributions open**. Publish the refund contact, the claim period and the steps to cancel a recurring payment.
- **FAQ** › `who-runs`: **When contributions open**.
- **FAQ** › `start-date`: **There is nothing to pay now** and **as soon as contributions open**.
- **FAQ** › `your-data`: **We do not need any payment details today**.

In the docs: `docs/ARCHITECTURE.md` (**It takes no payment**) and `AGENTS.md`.

Some tests check the words of today. Change them with the words:

- `apps/web/src/components/site/render.test.ts`: **Hear when the fund opens**.
- `apps/web/tests/site/subscribe.test.ts`: **takes no payment**.
- `apps/web/tests/site/csp.test.ts`: **names no payment origin**.
