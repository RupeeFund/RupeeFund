# Architecture

## 1. What the system does

The system shows public pages and collects a mailing list. It takes no payment and holds no vote.

Section 5 lists what the system stores for each person. It stores no payment instrument.

## 2. The parts

| Part     | Technology                   | Function                                  |
| -------- | ---------------------------- | ----------------------------------------- |
| Site     | Astro                        | Makes static HTML at build time           |
| Worker   | Hono on Cloudflare Workers   | Answers `/api/health` and `/api/waitlist` |
| Database | Cloudflare D1                | Keeps the `waitlist` table                |
| Scripts  | TypeScript in `src/scripts/` | Adds behaviour to the static pages        |

Only a request to `/api/*` reaches the Worker. Cloudflare serves every other path from the static files.

## 3. The one environment

The one environment is `live` at `rupeefund.org`. Section 7 names its resources. There is no second environment and no preview URL. A second address for `rupeefund-web` would keep the production bindings and write to the true mailing list, so the configuration refuses one. You prove a change on your own machine, against a local database.

## 4. How a person joins the list

`POST /api/waitlist` is the only address the public can write to. The Worker refuses a request in this order:

1. The `Origin` header is not the site.
1. The rate limiter refuses, or fails.
1. The body is larger than 8192 bytes.
1. The hidden field has a value. The Worker answers with success and writes nothing.
1. The name, the email address, or the amount is not valid.
1. For a JSON request, Turnstile refuses the token, or fails.

Then the Worker inserts the row. If the email address already has a row, the insert does nothing.

The `Content-Type` header selects the path:

| Header                              | Client                   | Answer after success                |
| ----------------------------------- | ------------------------ | ----------------------------------- |
| `application/json`                  | The browser script       | Status 200 and `{"ok":true}`        |
| `application/x-www-form-urlencoded` | A browser with no script | Status 303 to `/waitlist-confirmed` |

**Known limitation.** Turnstile needs JavaScript, so the form path has no Turnstile check. The `Origin` check, the hidden field, and the rate limiter still apply. The worst outcome is unwanted rows in a list that a person exports by hand.

## 5. The database

`migrations/` holds every migration. The live database keeps its own ledger, so `wrangler d1 migrations apply` runs only the files it has not seen. `docs/deploy.md` section 4 gives the rules for a new migration.

The `waitlist` table:

| Column                                              | Function                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `email`                                             | Unique, lower case                                                                        |
| `name`                                              | The name the person gave                                                                  |
| `consent_at`                                        | The time of consent. Required. It cannot be added later.                                  |
| `source`                                            | The form the person used                                                                  |
| `amount`, `months`                                  | The intended contribution and its duration. Empty for rows before 0002.                   |
| `question`                                          | A free-text question for the team                                                         |
| `updates_opt_in`                                    | 1 when the person ticked the monthly updates box, else 0                                  |
| `is_foss_user`, `is_foss_contributor`, `is_student` | 1 for each box the person ticked, else 0. Empty for rows before 0004, which nobody asked. |
| `exported_at`                                       | The time of the export. Empty means the exporter has not sent the row.                    |
| `unsubscribed_at`                                   | The time of a removal request                                                             |
| `created_at`, `updated_at`                          | The time of the signup, and the time of the last change                                   |

A second signup with the same email address changes nothing. The first row stands, and the person sees the normal confirmation. The form cannot prove who owns an address, so it never rewrites a row and never reveals that one exists. To change an answer or to return after a removal, a person writes to the team, and an operator edits the row by hand.

## 6. The export

`pnpm list:export --remote` writes a CSV of the rows that have no `exported_at` and no `unsubscribed_at`, then stamps `exported_at`. Each row goes out one time. A row that changes after its export does not go out again. Refer to `docs/deploy.md` section 8.

## 7. Names

Every Cloudflare resource of the project follows these rules. A fork deploys to its own account, so the `rupeefund-` prefix keeps its names clear of the names a contributor already has.

| Resource                  | Rule                                                   | Now                              |
| ------------------------- | ------------------------------------------------------ | -------------------------------- |
| Worker                    | `rupeefund-<surface>`                                  | `rupeefund-web`                  |
| D1 database               | `rupeefund-<data>`, named for the data, not the Worker | `rupeefund-waitlist`             |
| Custom domain             | `<surface>.rupeefund.org`, with `web` at the apex      | `rupeefund.org`                  |
| Turnstile widget          | the hostname it serves                                 | `rupeefund.org`                  |
| Rate limit `namespace_id` | a number that no other limiter used                    | `7301`                           |
| Binding                   | the role inside its Worker, in `UPPER_SNAKE`           | `DB`, `SIGNUP_LIMITER`, `ASSETS` |

There is no environment suffix. There is one environment.

## 8. Security headers

`public/_headers` sets the security headers on every page. The content security policy permits inline scripts because Bot Fight Mode on the zone injects one. It permits `static.cloudflareinsights.com` because Web Analytics on the zone injects its beacon. `tests/site/csp.test.ts` fails when a page loads a host the policy does not name.

## 9. Brand files

`RupeeFund/brand` is the only source of the brand colours and the brand files. `pnpm brand:sync` reads `exports/` on the `main` branch of `RupeeFund/brand` from `raw.githubusercontent.com`, and writes:

- `src/brand/colors.css`, the `--color-*` theme that `src/index.css` imports;
- `src/brand/colors.json`, which `Base.astro` reads for `theme-color`;
- `theme_color` and `background_color` in `public/site.webmanifest`;
- the icons, `logo.svg` and `logo-dark.svg` in `public/`.

The committed files are the only brand input to the build. The build does not fetch from the brand repository. Do not edit these files by hand.

The `Brand sync` workflow runs `pnpm brand:sync` each day. When the files differ from the brand repository, it runs the gate, opens or updates the pull request from `chore/brand-sync`, and fails. The workflow needs the repository setting “Allow GitHub Actions to create and approve pull requests”. To take a brand update, review and merge that pull request. CI does not run on it, so read the gate result in its description. To sync at once, run the workflow from the Actions tab.

To sync from a local brand checkout before it reaches `main`, set `BRAND_DIR` to the checkout and run `pnpm brand:sync`. The script then reads `exports/` in that checkout.
