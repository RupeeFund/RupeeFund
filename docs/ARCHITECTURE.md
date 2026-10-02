# Architecture

## 1. What the system does

The system shows public pages and collects a mailing list. It takes no payment and holds no vote.

Section 5 lists what the system stores for each person. It stores no payment instrument.

## 2. The parts

| Part          | Technology                   | Function                                  |
| ------------- | ---------------------------- | ----------------------------------------- |
| Site          | Astro                        | Makes static HTML at build time           |
| Public Worker | Hono on Cloudflare Workers   | Answers `/api/health` and `/api/waitlist` |
| Admin Worker  | Hono on Cloudflare Workers   | Shows the team the list. Refer to §10.    |
| Database      | Cloudflare D1                | Keeps the `waitlist` table                |
| Scripts       | TypeScript in `src/scripts/` | Adds behaviour to the static pages        |

On `rupeefund.org`, only a request to `/api/*` reaches the public Worker. Cloudflare serves every other path from the static files.

On `admin.rupeefund.org`, the admin Worker answers every path. Both Workers read one database. Only the public Worker writes to it.

The repository is a pnpm workspace. Turborepo runs each task in each package.

| Package            | Path          | Holds                                                   |
| ------------------ | ------------- | ------------------------------------------------------- |
| `@rupeefund/web`   | `apps/web`    | The site and the public Worker                          |
| `@rupeefund/admin` | `apps/admin`  | The admin Worker                                        |
| `@rupeefund/db`    | `packages/db` | The migrations, the table types and the export code     |
| `@rupeefund/ui`    | `packages/ui` | The brand files and `styles.css`, which both apps build |

A path in this document starts at the repository root. `src/` means `apps/web/src/`.

To add an endpoint, write a handler in `src/worker/routes/`. Connect it in `src/worker/index.ts` above the `/api/*` catch-all. Use a path under `/api/`, because no other path reaches the Worker.

Each command under `scripts` in `package.json` runs in the pnpm shell emulator (`shellEmulator` in `pnpm-workspace.yaml`). The emulator accepts a `NAME=value` prefix, `&&`, `||`, `|`, a redirect and `$(...)`. It does not run `if`, `for` or `case`. `if` and `for` print `command not found`, and the rest of the command runs. `case` exits with status 1 and prints nothing.

## 3. The one environment

The one environment is `live`, at `rupeefund.org` and `admin.rupeefund.org`. Section 7 names its resources. Two Workers is not two environments. There is no second environment and no preview URL. A second address for `rupeefund-web` keeps the production bindings and writes to the true mailing list, so the configuration refuses a `workers.dev` address and a preview URL. Nothing in the configuration stops a second custom domain. That rule is a decision, not a check. You prove a change on your own machine, against a local database.

## 4. How a person joins the list

`POST /api/waitlist` is the only address the public can write to. The Worker refuses a request in this order:

1. The `Origin` header is not the site. A request with no `Origin` header passes.
1. The rate limiter refuses, or fails.
1. The body is larger than 8192 bytes.
1. For a JSON request, the body is not a JSON object.
1. The hidden field has a value. The Worker answers with success and writes nothing.
1. The name, the email address, the amount, the duration, or the question is not valid.
1. For a JSON request, Turnstile refuses the token, or fails.

The Worker answers a refused JSON request with a 4xx status and `{"error":"<code>"}`. It answers a refused form request with status 303 to `/waitlist-problem?reason=<code>`.

Then the Worker inserts the row. If the email address already has a row, the insert does nothing.

The `Content-Type` header selects the path:

| Header                              | Client                   | Answer after success                |
| ----------------------------------- | ------------------------ | ----------------------------------- |
| `application/json`                  | The browser script       | Status 200 and `{"ok":true}`        |
| `application/x-www-form-urlencoded` | A browser with no script | Status 303 to `/waitlist-confirmed` |

**Known limitation.** Turnstile needs JavaScript, so the form path has no Turnstile check. The `Origin` check, the hidden field, and the rate limiter still apply. The worst outcome is unwanted rows in a list that a person exports by hand.

## 5. The database

`packages/db/migrations/` holds every migration. The live database keeps its own ledger, so `wrangler d1 migrations apply` runs only the files it has not seen. `docs/DEPLOY.md` section 4 gives the rules for a new migration.

`packages/db/src/schema.ts` holds the type of each table row and the values the form accepts. The site, the admin panel and the export import them from there. A migration that adds or changes a column must change that file too. `packages/db/tests/schema.test.ts` holds the two together. Its typecheck fails when the type changes alone, and its run fails when a migration changes alone.

The `waitlist` table:

| Column                                                   | Function                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                     | The row number. It counts up. The export reads rows in this order.                                                                                              |
| `email`                                                  | Unique, lower case                                                                                                                                              |
| `name`                                                   | The name the person gave                                                                                                                                        |
| `consent_at`                                             | The time of consent. Required. It cannot be added later.                                                                                                        |
| `source`                                                 | The form the person used                                                                                                                                        |
| `amount`                                                 | The intended rupees each month, a whole number of 1 or more. Empty for rows before 0002, and for an old answer that 0005 could not read as a number.            |
| `months`                                                 | The intended number of months, as the person typed it. Empty for rows before 0002.                                                                              |
| `question`                                               | A free-text question for the team                                                                                                                               |
| `updates_opt_in`                                         | 1 when the person ticked the monthly updates box, else 0. Empty for rows from before the box went live on 2026-09-12, which nobody asked.                       |
| `is_user`, `is_creator`, `is_professional`, `is_student` | The roles from the form: 1 for each box the person ticked, else 0. Empty where the form did not ask: every role before 0004, and `is_professional` before 0005. |
| `backs_nascent`, `backs_growing`, `backs_larger`         | The projects the person wants to fund: nascent, small to mid-sized, larger. 1 for each box the person ticked, else 0. Empty where the form did not ask.         |
| `exported_at`                                            | The time of the export. Empty means the exporter has not sent the row.                                                                                          |
| `unsubscribed_at`                                        | The time of a removal request                                                                                                                                   |
| `created_at`, `updated_at`                               | The time of the signup, and the time of the last change                                                                                                         |

Each 0/1 column and `amount` carry a `CHECK`. The table refuses any other value, also from a hand edit.

A second signup with the same email address changes nothing. The first row stands, and the person sees the normal confirmation. The form cannot prove who owns an address, so it never rewrites a row and never reveals that one exists. To change an answer or to return after a removal, a person writes to the team, and an operator edits the row by hand.

## 6. The export

The **Export** button on the dashboard and `pnpm list:export --remote` do the same thing. One `UPDATE … RETURNING` statement stamps `exported_at` on up to 500 rows that have no `exported_at` and no `unsubscribed_at`, and returns them as a CSV. The statement is atomic, so two exports never send the same row. `packages/db/src/export.ts` holds the statement and the CSV code for both. Each row goes out one time. A row that changes after its export does not go out again. Refer to `docs/DEPLOY.md` section 8.

## 7. Names

Every Cloudflare resource of this repository follows these rules. A fork deploys to its own account, so the `rupeefund-` prefix keeps its names clear of the names a contributor already has.

| Resource                  | Rule                                                   | Now                                    |
| ------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Worker                    | `rupeefund-<surface>`                                  | `rupeefund-web`, `rupeefund-admin`     |
| D1 database               | `rupeefund-<data>`, named for the data, not the Worker | `rupeefund-waitlist`                   |
| Custom domain             | `<surface>.rupeefund.org`, with `web` at the apex      | `rupeefund.org`, `admin.rupeefund.org` |
| Turnstile widget          | the hostname it serves                                 | `rupeefund.org`                        |
| Rate limit `namespace_id` | a number that no other limiter used                    | `7301`                                 |
| Binding                   | the role inside its Worker, in `UPPER_SNAKE`           | `DB`, `SIGNUP_LIMITER`, `ASSETS`       |

There is no environment suffix. There is one environment.

## 8. Security headers

`apps/web/public/_headers` sets the security headers on every page. The content security policy permits inline scripts for two reasons. The build emits inline module scripts. Bot Fight Mode on the zone injects one inline script. The policy also permits `static.cloudflareinsights.com` because Web Analytics on the zone injects its beacon. `apps/web/tests/site/csp.test.ts` fails when a page loads a host the policy does not name.

`apps/web/public/_headers` applies to `rupeefund.org` only. The admin Worker sets its own headers. Refer to §10.5.

`run_worker_first` in `apps/web/wrangler.jsonc` sends `/api/*` to the Worker, so `_headers` does not apply to those answers. `apps/web/src/worker/index.ts` sets the security headers on each `/api/*` answer. Its policy starts at `default-src 'none'`, because an answer is JSON or a redirect, and loads nothing.

## 9. Brand files

`RupeeFund/brand` is the only source of the brand colours and the brand files. `pnpm brand:sync` reads `exports/` on the `main` branch of `RupeeFund/brand` from `raw.githubusercontent.com`, and writes:

- `packages/ui/src/colors.css`, the `--color-*` theme that `packages/ui/src/styles.css` imports.
- `packages/ui/src/colors.json`, which `Base.astro` reads for `theme-color`.
- `logo.svg`, `logo-dark.svg` and `favicon.svg` in `packages/ui/src/`, and a copy of each in `apps/web/public/`, so their public addresses stay.
- `theme_color` and `background_color` in `apps/web/public/site.webmanifest`.
- the raster icons in `apps/web/public/`.

The committed files are the only brand input to the build. The build does not fetch from the brand repository. Do not edit these files by hand.

The `Brand sync` workflow runs `pnpm brand:sync` each day. When the files differ from the brand repository, it runs the gate, opens or updates the pull request from `chore/brand-sync`, and fails. The workflow needs the repository setting “Allow GitHub Actions to create and approve pull requests”. To take a brand update, review and merge that pull request. CI does not run on it, so read the gate result in its description. To sync at once, run the workflow from the Actions tab.

To sync from a local brand checkout before it reaches `main`, set `BRAND_DIR` to the checkout and run `pnpm brand:sync`. The script then reads `exports/` in that checkout.

## 10. The admin panel

The panel shows the team the waitlist. It writes one thing: the export stamp, `exported_at`. Refer to §10.8.

**Keep the two Workers apart.** Do not add an admin route to `rupeefund-web`. A Cloudflare Access policy covers a whole Worker, so one policy on `rupeefund-web` would ask every visitor to sign in before the signup form. Separation also limits the blast radius: an admin deployment cannot break the form.

### 10.1 Who gets in

One Cloudflare Access policy covers the whole `rupeefund-admin` Worker. Access checks every request before the Worker runs, and it covers each address the Worker answers on.

`requireAccess` in `apps/admin/src/access.ts` reads the identity from `ctx.access`. `ctx.access` is undefined when Access did not authenticate the request. **Refuse on undefined.** The Worker holds no token code, no key set, and no secret. The platform does that work.

On your machine, the `access` block in `apps/admin/wrangler.jsonc` makes wrangler supply a mock `ctx.access`, so the local panel signs you in as `operator@example.com`. Only `wrangler dev` reads that block. A deployment ignores it.

The admin Worker binds no static files on purpose. Cloudflare serves a Worker that has static files behind an internal router, and that router does not pass `ctx.access` to the Worker. The Worker builds every page itself, so the router never exists.

### 10.2 The addresses

`apps/admin/src/index.ts` maps each address to its handler in `apps/admin/src/routes.ts`.

| Address           | Answer                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| `/`               | The waitlist dashboard: numbers, records and questions. It holds no data.          |
| `/api/summary`    | The counts. No personal data. The cache keeps them for `SUMMARY_MAX_AGE`, 60 s.    |
| `/api/waitlist`   | One page of `PAGE_SIZE`, 50 rows, newest first. `?before=<id>` gets the next page. |
| `/api/questions`  | One page of questions, newest first.                                               |
| `/api/reveal/:id` | One email address. The Worker logs who asked, and for which row.                   |
| `/api/export`     | `POST`. The export as a CSV file. Refer to §10.8.                                  |
| `/assets/*`       | The stylesheet, the Inter font files and the favicon.                              |

Every address except `/api/export` is a `GET` and changes nothing.

The dashboard reads `/api/summary`, one page of `/api/waitlist` and one page of `/api/questions`. Refresh and auto refresh read `/api/summary` again, and nothing else. A page load costs one Worker request for the page and one for each file and API read, against the daily 100,000. The cache covers `/api/summary` alone, so every page load reads one page of rows and one page of questions.

A sidebar lists the dashboards. Each item is a link to an address that the Worker serves. The sidebar starts narrow, with icons only. Its toggle widens it to show the names. On a narrow screen the wide sidebar covers the page, and Escape or a move of focus out of it makes it narrow again.

### 10.3 How the panel hides an address

A list endpoint sends a masked address, `••••@•••••.com`. It keeps a country top-level domain or a common generic one, such as `.com` or `.dev`, and a known second level such as `.co.in`. It hides any other top-level domain, because a brand domain such as `.sbi` names the organisation. It shows no letter of the name, no length, and no organisation. SQLite builds that string, so the full address never leaves the database on the list path. Only `/api/reveal/:id` and `/api/export` send a full address, and each logs the reader.

The list carries a flag for a question, never the question text. The name is not masked, because the team needs it to tell two rows apart.

`/api/questions` is the one address that sends the question text. It sends a masked address and the export and unsubscribe stamps, so its table shows the same status as the records. An eye in a row of either table reveals that one address through `/api/reveal/:id`, which logs the reader. The Worker answers a reveal only if the request carries the `x-rupeefund-admin: 1` header. The dashboard script sends it, and a link on another site cannot, so another site cannot log a reveal in the name of a reader. The dashboard writes every value through `textContent`, so a question that carries markup shows as the characters the person typed.

The list carries every other column of the table: the roles, the reasons, the amount, the term, the updates choice and the dates. `/api/summary` counts the roles and the reasons. A row from before the form asked about a box holds `NULL` for that box. The dashboard shows it as "Not recorded", and it adds to no count.

`/api/summary` counts only the active rows, the rows that have not unsubscribed, because the figures measure interest. Two counts are the exception: all rows and the rows with a question, because the two tables list every row. It also sends the sum and the median of the monthly amounts, the number of people who answered the roles and the reasons, the signups and the unsubscribes of the last 30 days, and the time of the count. A person who ticked no box still answered. A row from before the form asked holds `NULL` in every box of that question, and did not answer. The dashboard projects the date of 1000 active signups from the net growth of those 30 days.

A response that carries an address, a name, or a question sets `Cache-Control: private, no-store`. Only `/api/summary` permits a cache, because it carries counts alone.

The log keeps 3 days on the Workers Free plan. Treat it as an operations record, not as a permanent one.

### 10.4 The row budget

D1 counts the rows a query scans, and the daily free allowance is for the whole account. The public signup shares it. An exhausted allowance makes the signup fail, so the panel must stay cheap.

Measured on a table of 1004 rows:

| Query                         | Rows read   |
| ----------------------------- | ----------- |
| Every count, in one pass      | 1004, or N  |
| One `GROUP BY`                | 2008, or 2N |
| One page of 50 rows           | 50          |
| One reveal                    | 1           |
| A filter that matches nothing | 1004, or N  |

One load of the dashboard reads about 5N rows.

**Put no filter on a list endpoint except the `id` cursor, unless an index covers it.** `WHERE id < ?` is a search on the primary key, so a page costs its rows at any depth. A filter on an unindexed column scans the table, and a `LIKE` that matches few rows still scans it. Every slice belongs to the cached `GROUP BY` queries in `/api/summary`. This one rule keeps the signup alive.

`/api/questions` is the one exception, and it earns the exception with an index. Migration `0005` adds the partial index `idx_waitlist_question` on `id`, over the rows where `question` is not empty. The query plan reads `SEARCH waitlist USING INDEX idx_waitlist_question (id<?)`. Without the index the same query still answers, but it walks the primary key and discards every row that asked nothing.

`apps/admin/src/repo.test.ts` reads `EXPLAIN QUERY PLAN` for each query and fails when the page or the reveal does not search the primary key, when the questions query does not use `idx_waitlist_question`, or when the summary costs other than three table passes and two groupings.

### 10.5 The security headers

`apps/admin/src/headers.ts` holds the policy. The Worker wraps every answer it makes, so a refusal carries the same headers as a page.

The policy is tighter than `apps/web/public/_headers`. It starts at `default-src 'none'`, names no external host, and permits no form and no frame. It keeps `'unsafe-inline'` for the script, because the shell carries one inline script and because Bot Fight Mode injects a script on the zone. The style comes from `/assets/` alone, so `style-src` is `'self'`.

The panel makes no cross-origin request, so `connect-src 'self'` is the whole network policy.

### 10.6 The styles

The panel follows the brand guidelines on light surfaces. `apps/admin/src/admin.css` imports `@rupeefund/ui/styles.css`, the file that styles the site. [DESIGN.md](DESIGN.md) tells what the admin styles add, and gives the rules for the look.

`pnpm run build` in `apps/admin` compiles that file with Tailwind. `apps/admin/scripts/assets.mjs` then writes `apps/admin/.generated/assets.ts`, which holds the stylesheet, the Inter files and the favicon under names that change with their content. The Worker serves them from `/assets/`. Git ignores that folder. Turborepo runs the build before `typecheck` and `test`. `pnpm dev:admin` does the same work itself, then again after each edit.

### 10.7 JavaScript

The panel needs JavaScript. The site does not, and the rule for the site stays. Each page holds no data, so a page cannot leak a row. The script reads each row from an API address that sends `Cache-Control: private, no-store`. A server-rendered page with rows would put personal data in the HTML, which a browser can keep in its history and its cache.

The page frame and the sidebar links work without JavaScript. The sidebar toggle, the figures and the rows do not. The script shows the toggle, so a page without JavaScript shows no control that does nothing.

### 10.8 The export

`POST /api/export` is the one write. It refuses the request, and stamps nothing, unless all three are true:

- The `Origin` header is the panel's own origin.
- The `x-rupeefund-admin: 1` header is present. A form on another site cannot set it, and the Worker sends no CORS header, so a script on another site cannot send it.
- The Access identity carries an email address.

The Worker logs `export` with the reader, the stamp time `at` and the count, before it builds the file. It logs `export_denied` for each refusal. It then drops the cached `/api/summary` in its own data centre. Another data centre can serve the old count for up to 60 seconds. An empty batch answers `204`.

The dashboard reads the count again, past the browser cache, and asks for a confirmation that states it. The file carries full addresses. If the file fails to save after the stamp, the page says so and names the batch time `at`.

If you lose a download after the stamp, read `at` from the log. Then follow `docs/DEPLOY.md` section 8.
