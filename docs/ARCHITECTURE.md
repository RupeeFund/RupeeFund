# Architecture

## 1. What the system does

The system shows public pages and collects a mailing list. It takes no payment and holds no vote. A content manager, EmDash, holds the words of the pages. Refer to section 11.

`packages/db/src/schema.ts` gives what the system stores for each person. It stores no payment instrument.

## 2. The parts

| Part            | Technology                                   | Function                                                                             |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Site Worker     | Astro, EmDash and Hono on Cloudflare Workers | Renders each page on request, runs the content manager, answers `/api/*`             |
| Admin Worker    | Hono on Cloudflare Workers                   | Shows the team the list. Refer to section 10.                                        |
| Waitlist data   | Cloudflare D1                                | Keeps the `waitlist` table                                                           |
| Content data    | Cloudflare D1                                | Keeps the entries, the revisions, the people and the sessions of the content manager |
| Media           | Cloudflare R2                                | Keeps the images that editors upload                                                 |
| Browser scripts | TypeScript in `src/scripts/`                 | Adds behaviour to the pages in the browser                                           |

`apps/web/wrangler.jsonc` names the resources of the site Worker, and `apps/admin/wrangler.jsonc` the resources of the admin Worker.

`src/worker.ts` is the entry of the site Worker. It sends each request under `/api/` to the Hono app in `src/worker/api.ts`, and each other request to Astro. EmDash runs inside Astro. It serves `/_emdash/*` and gives the pages their content. A request that matches a static file gets the file, and the Worker does not run.

Both Workers use the waitlist database. Only the site Worker adds rows. The admin Worker writes only the export stamp, `exported_at`.

AGENTS.md maps the packages.

A path in this document starts at the repository root. `src/` means `apps/web/src/`.

To add an endpoint, write a handler in `src/worker/routes/`. Connect it in `src/worker/api.ts` above the `/api/*` catch-all. Use a path under `/api/`, because only that path reaches Hono.

Each command under `scripts` in `package.json` runs in the pnpm shell emulator, so it runs the same on Windows. It accepts a `NAME=value` prefix, `&&`, `||`, `|`, a redirect and `$(...)`. Do not use `if`, `for` or `case`: they fail without a clear error.

## 3. Addresses and hosts

| Address                        | What answers                 | Function                                                   |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------- |
| `rupeefund.org/` and each page | Site Worker, Astro           | Renders the page from the published content (section 11.1) |
| `rupeefund.org/api/*`          | Site Worker, Hono            | The signup and the health check (section 4)                |
| `rupeefund.org/_emdash/*`      | Site Worker, EmDash          | The content manager and its API (section 11)               |
| `rupeefund.org/admin`          | `apps/web/public/_redirects` | Sends the person to `/_emdash/admin`                       |
| `rupeefund.org/media/<key>`    | Site Worker                  | The images of the published content (section 11.2)         |
| `admin.rupeefund.org`          | Admin Worker                 | The admin panel, behind Cloudflare Access (section 10)     |

The next table holds the addresses for later work. No part serves them yet. Keep them free for that work.

| Address                    | Later part      | Where it fits                                                                                              |
| -------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `rupeefund.org/platform/*` | Voting platform | A route group in this app, or its own Worker on the same host. It uses the sign-in of the content manager. |
| `dashboard.rupeefund.org`  | Data dashboard  | The next version of `admin.rupeefund.org`                                                                  |
| `rupeefund.org/stats`      | Public figures  | Public pages that read totals only                                                                         |

The one environment is `live`. Two Workers are not two environments. There is no preview URL.

A second address for the site Worker keeps the live bindings and writes to the live list and the live content. So the configuration refuses a `workers.dev` address and a preview URL. The configuration does not stop a second custom domain, so do not add one. Prove a change on your own machine, against a local database.

## 4. How a person joins the list

`POST /api/waitlist` is the only address the public can write to. `apps/web/src/worker/routes/waitlist.ts` gives the order of the checks. A request with no `Origin` header passes. A filled hidden field gets a success answer and writes nothing.

Each row needs a Turnstile token, and Turnstile needs JavaScript. A browser with no script sees a notice in place of the form. The notice gives an email address. When a person writes to it, the team adds the person by hand.

## 5. The database

`packages/db/migrations/` holds every migration of the waitlist database. The live database keeps its own ledger, so `wrangler d1 migrations apply` runs only the files it has not seen. `docs/DEPLOY.md` section 4 gives the rules for a new migration.

`packages/db/src/schema.ts` holds the type of each table row and the values the form accepts. The site, the admin panel and the export import them from there. A migration that adds or changes a column must change that file too. `packages/db/tests/schema.test.ts` holds the two together. Its typecheck fails when the type changes alone, and its run fails when a migration changes alone.

`packages/db/migrations/` and `schema.ts` give each column. An empty answer column means the form did not ask that question when the person signed up. The migration that added the column tells when.

A second signup with the same email address changes nothing. The first row stands, and the person sees the normal confirmation. The form cannot prove who owns an address, so it never rewrites a row and never reveals that one exists. To change an answer or to return after a removal, a person writes to the team, and an operator edits the row by hand.

Keep the waitlist database first in `d1_databases` of `apps/web/wrangler.jsonc`. The admin Worker test compares its database with the first one there.

The content database belongs to EmDash. EmDash makes and changes its tables itself (section 11.8).

## 6. The export

The **Export** button on the dashboard and `pnpm list:export --remote` do the same thing. One `UPDATE … RETURNING` statement stamps `exported_at` on up to 500 rows. It selects rows that have no `exported_at` and no `unsubscribed_at`, and returns them as a CSV. The statement is atomic, so two exports never send the same row. `packages/db/src/export.ts` holds the statement and the CSV code for both. Each row goes out one time. A row that changes after its export does not go out again. Refer to `docs/DEPLOY.md` section 8.

## 7. Names

Every Cloudflare resource of this repository follows these rules. A fork deploys to its own account, so the `rupeefund-` prefix keeps its names clear of the names a contributor already has.

| Resource                  | Rule                                                   |
| ------------------------- | ------------------------------------------------------ |
| Worker                    | `rupeefund-<surface>`                                  |
| D1 database               | `rupeefund-<data>`, named for the data, not the Worker |
| R2 bucket                 | `rupeefund-<data>`                                     |
| Custom domain             | `<surface>.rupeefund.org`, with `web` at the apex      |
| Turnstile widget          | the hostname it serves                                 |
| Rate limit `namespace_id` | a number that no other limiter used                    |
| Binding                   | the role inside its Worker, in `UPPER_SNAKE`           |

## 8. Security headers

`src/outer.ts` runs first on each request that reaches Astro. It answers 404 to each EmDash route that the site does not use. Then it sets the security headers on the answer. `src/lib/edge.ts` holds the list of routes and the headers.

- A page of the site gets the content security policy of the site and refuses a frame.
- An answer under `/_emdash/` does not get the policy of the site. It gets `x-robots-tag: noindex, nofollow`, so search engines do not list the content manager.

The policy permits inline scripts for two reasons. The build emits inline module scripts. Bot Fight Mode on the zone injects one inline script. The policy also permits `static.cloudflareinsights.com` because Web Analytics on the zone injects its beacon.

A static file goes out before the Worker runs, so `apps/web/public/_headers` sets the same headers on the static files. `apps/web/tests/site/csp.test.ts` fails when the two policies differ, and when a page loads a host that the policy does not name.

`src/worker/api.ts` sets the headers of the `/api/*` answers itself.

These headers apply to `rupeefund.org` only. The admin Worker sets its own headers. Refer to section 10.5.

## 9. Brand files

`RupeeFund/brand` is the only source of the brand colours and the brand files. `pnpm brand:sync` reads `exports/` on the `main` branch of `RupeeFund/brand` and writes the files that `apps/web/scripts/brand-sync.mts` lists. The site serves each SVG from its own origin, so the script refuses an SVG with active content.

The committed files are the only brand input to the build. The build does not fetch from the brand repository. Do not edit these files by hand.

The `Brand sync` workflow runs `pnpm brand:sync` each day. When the files differ from the brand repository, it runs `pnpm format:check`, `pnpm check` and `pnpm run build`, opens or updates the pull request from `chore/brand-sync`, and fails. The workflow needs the repository setting “Allow GitHub Actions to create and approve pull requests”. To take a brand update, review and merge that pull request. CI does not run on it, so read the check result in its description. To sync at once, run the workflow from the Actions tab.

To sync from a local brand checkout before it reaches `main`, set `BRAND_DIR` to the checkout and run `pnpm brand:sync`. The script then reads `exports/` in that checkout.

## 10. The admin panel

The panel shows the team the waitlist. It writes one thing: the export stamp, `exported_at`. Refer to section 10.8.

**Keep the two Workers apart.** Do not add the panel to the site Worker. A Cloudflare Access policy covers a whole Worker. If a policy covers the site Worker, it asks every visitor to sign in before the signup form shows. Also, an admin deployment cannot break the form.

### 10.1 Who gets in

One Cloudflare Access policy covers the whole `rupeefund-admin` Worker. Access checks every request before the Worker runs, and it covers each address the Worker answers on.

`requireAccess` in `apps/admin/src/access.ts` reads the identity from `ctx.access`. `ctx.access` is undefined when Access did not authenticate the request. **Refuse on undefined.** The guard also refuses a `ctx.access` whose `aud` is not `ACCESS_AUD`. So a pass from another Access application does not open the panel. The Worker holds no token code, no key set, and no secret. The platform does that work.

On your machine, the `access` block in `apps/admin/wrangler.jsonc` makes wrangler supply a mock `ctx.access`, so the local panel signs you in as `operator@example.com`. Its `aud` is the same as `ACCESS_AUD`, so the local panel passes the same check. Only `wrangler dev` reads that block. A deployment ignores it.

The admin Worker binds no static files. Cloudflare serves a Worker that has static files behind an internal router, and that router does not pass `ctx.access` to the Worker. The Worker builds every page itself, so the router never exists.

### 10.2 The addresses

`apps/admin/src/index.ts` maps each address to its handler in `apps/admin/src/routes.ts`.

Every address except `/api/export` is a `GET` and changes nothing.

The dashboard reads `/api/summary`, one page of `/api/waitlist` and one page of `/api/questions`. Refresh and auto refresh read `/api/summary` again, and nothing else. The cache covers `/api/summary` alone, so every page load reads one page of rows and one page of questions.

### 10.3 How the panel hides an address

A list endpoint sends a masked address, `••••@•••••.com`. It keeps a country top-level domain or a common generic one, such as `.com` or `.dev`, and a known second level such as `.co.in`. It hides any other top-level domain, because a brand domain such as `.sbi` names the organisation. It shows no letter of the name, no length, and no organisation. SQLite builds that string, so the full address never leaves the database on the list path. Only `/api/reveal/:id` and `/api/export` send a full address, and each logs the reader.

The list carries a flag for a question, never the question text. The list does not mask the name, because the team needs it to tell two rows apart.

`/api/questions` is the one address that sends the question text. It sends a masked address and the export and unsubscribe stamps, so its table shows the same status as the records. An eye in a row of either table reveals that one address through `/api/reveal/:id`, which logs the reader. The Worker answers a reveal only if the request carries the `x-rupeefund-admin: 1` header. The dashboard script sends it. A link on another site cannot send it. So another site cannot log a reveal in the name of a reader. The dashboard writes every value through `textContent`, so a question that carries markup shows as the characters the person typed.

The list carries every other column of the table: the roles, the reasons, the amount, the months, the updates choice and the dates. `/api/summary` counts the roles and the reasons. A row from before the form asked about a box holds `NULL` for that box. The dashboard shows it as "Not recorded", and it adds to no count.

`/api/summary` counts only the active rows, the rows of people who did not unsubscribe, because the figures measure interest. Two counts are the exception: all rows and the rows with a question, because the two tables list every row.

`/api/summary` also sends these values:

- the sum and the median of the monthly amounts
- the number of people who answered the roles and the reasons
- the signups and the unsubscribes of the last 30 days
- the time of the count

A person who ticked no box answered. A row with `NULL` in every box of a question did not answer. The dashboard projects the date of 1000 active signups from the net growth of those 30 days.

A response that carries an address, a name, or a question sets `Cache-Control: private, no-store`. Only `/api/summary` permits a cache, because it carries counts alone.

The log keeps 7 days on the Workers Paid plan. Treat it as an operations record, not as a permanent one.

### 10.4 The row budget

D1 counts the rows a query scans. The account pays for each row past the monthly allowance, and the site, the content manager and the panel share that allowance. So the panel must stay cheap.

For a table of N rows, one pass reads N rows, one `GROUP BY` reads 2N, a page reads its own rows, and a reveal reads 1. One load of the dashboard reads about 5N rows.

**Put no filter on a list endpoint except the `id` cursor, unless an index covers it.** `WHERE id < ?` searches the primary key, so a page reads only its own rows, at any depth. A filter on a column with no index scans the table. A `LIKE` that matches few rows also scans it. Put each slice in the cached `GROUP BY` queries of `/api/summary`.

`/api/questions` is the one exception, because an index covers it. Migration `0005` adds the partial index `idx_waitlist_question` on `id`, over the rows where `question` is not empty.

`apps/admin/src/repo.test.ts` reads `EXPLAIN QUERY PLAN` for each query. It fails in these conditions:

- The page or the reveal does not search the primary key.
- The questions query does not use `idx_waitlist_question`.
- The summary does not cost exactly three table passes and two groupings.

### 10.5 The security headers

`apps/admin/src/headers.ts` holds the policy. The Worker wraps every answer it makes, so a refusal carries the same headers as a page.

The policy is tighter than the policy of the site. It starts at `default-src 'none'`, names no external host, and permits no form and no frame. It keeps `'unsafe-inline'` for the script, because the shell carries one inline script and because Bot Fight Mode injects a script on the zone. The style comes from `/assets/` alone, so `style-src` is `'self'`.

The panel makes no cross-origin request, so `connect-src 'self'` is the whole network policy.

### 10.6 The styles

The panel follows the brand guidelines on light surfaces. `apps/admin/src/admin.css` imports `@rupeefund/ui/styles.css`, the file that styles the site. [DESIGN.md](DESIGN.md) tells what the admin styles add, and gives the rules for the look.

### 10.7 JavaScript

The panel needs JavaScript. The site does not, except the signup form on `/subscribe` (section 4). Each page holds no data, so a page cannot leak a row. The script reads each row from an API address that sends `Cache-Control: private, no-store`. A server-rendered page with rows puts personal data in the HTML, and a browser can keep that HTML in its history and its cache.

The page frame and the sidebar links work without JavaScript. The sidebar toggle, the figures and the rows do not. The script shows the toggle, so a page without JavaScript shows no control that does nothing.

### 10.8 The export

`POST /api/export` is the one write. It refuses the request, and stamps nothing, unless all three are true:

- The `Origin` header is the panel's own origin.
- The `x-rupeefund-admin: 1` header is present. A form on another site cannot set it, and the Worker sends no CORS header, so a script on another site cannot send it.
- The Access identity carries an email address.

The Worker logs `export` with the reader, the stamp time `at` and the count, before it builds the file. It logs `export_denied` for each refusal. It then drops the cached `/api/summary` in its own data centre. Another data centre can serve the old count for up to 60 seconds. An empty batch answers `204`.

The dashboard reads the count again, past the browser cache. It shows the count in a confirmation dialog. The file carries full addresses. If the file fails to save after the stamp, the page says so and names the batch time `at`.

If you lose a download after the stamp, read `at` from the log. Then follow `docs/DEPLOY.md` section 8.

## 11. The content manager

EmDash runs inside the site Worker. Its admin is at `rupeefund.org/_emdash/admin`. It holds the words of the pages (`docs/EDITING.md`). A page that is an app, such as `/subscribe`, stays in code.

`apps/web/astro.config.mjs` sets up EmDash: the content database, the media bucket, the look of the admin, the outer middleware (section 8) and the site plugin `src/plugin.ts` (section 11.4).

### 11.1 How a page gets its content

Each page reads the published entries when a request comes. `src/content/load.ts` reads them through EmDash. `src/content/entries.ts` checks each entry against `src/content/schema.ts` and gives it to the components in `src/components/site/`. The site has no content build and no content cache, so the next page load shows a publish.

An entry that fails the check does not show. A list leaves it out, and the page of that entry answers 404. The log of the site Worker then gets `The site leaves out an entry:`, with the entry and the problem.

A landing page or a people page that fails the check, or a read of the database that fails, shows `src/pages/500.astro`. A menu that fails to load shows empty.

### 11.2 The public addresses

- `/media/<key>` and `/_emdash/api/media/file/<key>` send a file without a sign-in only when published content uses it. Else they need a signed-in, active person, and answer 404 to the others. `src/middleware.ts` makes the check. `/_image` always needs a signed-in person.
- `/media/<key>` sends only a PNG, JPEG, GIF, WebP or AVIF file. The check of section 11.1 refuses each other image type, so an SVG with a script cannot reach a page.
- The site owns `/robots.txt` and `/sitemap.xml`. `src/outer.ts` answers 404 to the sitemaps of EmDash.
- `src/outer.ts` answers 404 to each EmDash route that the site does not use, for example the setup wizard, the OAuth server and the import. A signed-in admin gets the first page of the setup wizard and its two calls. Under `astro dev` the setup routes stay open, for the local sign-in of `docs/CONTRIBUTING.md`.
- `src/outer.ts` answers 401 to a call to `/_emdash/api/*` with no GitHub sign-in, before EmDash starts. So a visitor cannot use the search, the comments or the other sign-in methods of EmDash, and cannot make EmDash write to the database.
- An API token opens only the routes where EmDash checks the token. The list in `src/lib/edge.ts` follows the public routes of EmDash.
- Two EmDash routes stay open to all: the published files under `/_emdash/api/media/file/` and **Log out**.
- A request for a page under `/_emdash/admin` with no sign-in goes to `/auth/login`. The EmDash login page goes to `/`. Each other call with no sign-in gets 401.
- Two WAF rules on the zone block common scanner paths and limit the requests of each address, before they start the Worker (`docs/DEPLOY.md` section 11.6).

### 11.3 Who gets in

People sign in with GitHub. `src/outer.ts` serves `/auth/login` and `/auth/callback` with the code in `packages/auth`. The callback reads the teams of the person in the `RupeeFund` organization:

| GitHub team   | Role        |
| ------------- | ----------- |
| `cms-admins`  | Admin (50)  |
| `cms-editors` | Editor (40) |
| `cms-authors` | Author (30) |

A person in two teams gets the higher role. A person in no team, or with no verified primary email, does not get in, and EmDash makes no account.

The callback sets a signed cookie for 8 hours. On each request, `src/auth/emdash.ts` gives EmDash the person in that cookie, and EmDash sets the role from it. So a team change takes effect at the next sign-in (`docs/DEPLOY.md` section 11.2).

The sessions stay in the content database (`src/auth/session-store.ts`), because EmDash writes the session on each request and KV takes one write per second to a key. `src/outer.ts` ends the session when the signed cookie is missing or not valid. **Log out** in the content manager clears both.

### 11.4 The rules on content

Two parts hold the rules. When you change one, read the other.

`src/plugin.ts` registers the hooks in `src/plugin/hooks.ts`:

- The landing page has one entry. Only an admin edits, publishes or unpublishes it.
- Only an admin edits, publishes or unpublishes a legal page: a page with the kind `legal`.
- Nobody deletes a legal page. To remove one, an admin changes its kind to `page` first.
- The content manager refuses each schedule. An entry goes live only when a person publishes it.

`src/middleware.ts` refuses a write by a person below Admin to the landing page and the legal pages, through each route that the hooks do not see. `src/lib/guard.ts` lists those routes: a status change with no data, a copy, a revision restore, a change to their images and a change to their terms. The middleware also refuses each change to the model from a browser session: the collections, the fields, the relations, the byline fields and the taxonomies. Only an API token changes the model (section 11.6).

A cron trigger (`triggers` in `apps/web/wrangler.jsonc`) runs `scheduled()` in `src/worker.ts` once a day at 00:00 UTC. It runs the EmDash maintenance. EmDash cleans up only in a run that starts at minute 0, so keep the cron at minute 0. A run that starts late skips the clean-up until the next day. The clean-up:

- removes expired sign-in challenges and tokens
- removes uploads that did not finish, from D1 and R2
- keeps the newest 10,000 rows of the 404 log
- keeps the newest 50 revisions of an entry and deletes the older revisions for good
- removes stale media-usage rows and old transfer files in R2

A scheduled backup in the EmDash settings also runs then, if an admin turns it on. One run each day is enough, because the site refuses schedules.

### 11.5 Preview

The **Preview** button of a post or a page opens the entry at its address with a `_preview` token. EmDash then shows that draft. `docs/TODO.md` holds the plan for the other collections.

`toolbar: false` turns off the EmDash edit toolbar. The site shows no **Edit** button, so a signed-in person cannot change a page by accident. An editor changes the content only in the content manager.

EmDash shows the drafts to a signed-in person whose browser has the edit cookie `emdash-edit-mode`. So `src/outer.ts` sends each `GET` with that cookie back to the same address, and removes the cookie.

### 11.6 The content model

Each collection has typed fields. The layout stays in code, so an editor changes the words and not the structure. To change a field, change these together:

- `apps/web/seed/seed.json`, the model of a new database
- the live database, with an API token (`docs/DEPLOY.md` section 11.5)
- `src/content/schema.ts` and the map in `src/content/entries.ts`
- the component in `src/components/site/`

The seed applies only to a new database, such as the local one that `pnpm db:reset` makes.

### 11.7 The blog

A post has a category, an optional season, its authors and a body. The category is a term of the `category` taxonomy. The authors are the EmDash bylines. A post with no category shows Blog.

`src/content/schema.ts` gives the blocks that a body can hold, and `src/content/html.ts` renders them. `src/plugin.ts` adds three blocks to the editor: the callout, the quote and the call to action. `docs/EDITING.md` section 8 lists what the check of section 11.1 refuses.

### 11.8 EmDash updates

EmDash changes its own database on the first request after a deploy of a new version. There is no step to approve it. So Renovate does not merge an EmDash update by itself (`renovate.json`). `docs/DEPLOY.md` section 11.3 gives the steps for an update.
