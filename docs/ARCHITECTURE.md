# Architecture

## 1. What the system does

The system shows public pages and collects a mailing list. It takes no payment and holds no vote. A content manager, EmDash, holds the words of the pages (section 11).

## 2. The parts

| Part            | Technology                                   | Function                                                                 |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Site Worker     | Astro, EmDash and Hono on Cloudflare Workers | Renders each page on request, runs the content manager, answers `/api/*` |
| Admin Worker    | Hono on Cloudflare Workers                   | Shows the team the list (section 10)                                     |
| Waitlist data   | Cloudflare D1                                | Keeps the `waitlist` table                                               |
| Content data    | Cloudflare D1                                | Keeps the entries, revisions, people and sessions of the content manager |
| Media           | Cloudflare R2                                | Keeps the images that editors upload                                     |
| Browser scripts | TypeScript in `src/scripts/`                 | Adds behaviour to the pages in the browser                               |

A path here starts at the repository root. `src/` means `apps/web/src/`.

- `src/worker.ts` is the entry of the site Worker. A request that matches a static file gets the file, and the Worker does not run.
- Only the site Worker adds rows to the waitlist database. The admin Worker writes only `exported_at` (section 10.8).
- The home page reads the supporter figures through `src/lib/supporters.ts` and `packages/db/src/pledges.ts`.

To add an endpoint, write a handler in `src/worker/routes/`. Connect it in `src/worker/api.ts` above the `/api/*` catch-all. Use a path under `/api/`, because only that path reaches Hono.

Each command under `scripts` in `package.json` runs in the pnpm shell emulator. It accepts a `NAME=value` prefix, `&&`, `||`, `|`, a redirect and `$(...)`. Do not use `if`, `for` or `case`: they fail without a clear error.

## 3. Addresses and hosts

- `rupeefund.org/` and each page: Astro renders the published content (section 11.1).
- `rupeefund.org/api/*`: Hono, for the signup and the health check (section 4).
- `rupeefund.org/_emdash/*`: EmDash, the content manager and its API (section 11).
- `rupeefund.org/admin`: `apps/web/public/_redirects` sends the person to `/_emdash/admin`.
- `rupeefund.org/media/<key>`: the images of the published content (section 11.2).
- `admin.rupeefund.org`: the admin Worker, behind Cloudflare Access (section 10).

Keep these addresses free for later work: `rupeefund.org/platform/*` for the voting platform, `dashboard.rupeefund.org` for the next version of `admin.rupeefund.org`, and `rupeefund.org/stats` for public totals. The home page shows the first totals (section 2). The voting platform uses the sign-in of the content manager.

The one environment is `live`. Each address of the site Worker writes to the live list and the live content, so the configuration refuses a `workers.dev` address and a preview URL. Nothing refuses a second custom domain, so do not add one. Prove a change on your own machine (`docs/DEPLOY.md` section 2).

## 4. How a person joins the list

`POST /api/waitlist` is the only address the public can write to. `apps/web/src/worker/routes/waitlist.ts` gives its checks in order.

Each row needs a Turnstile token, and Turnstile needs JavaScript. A browser with no script sees a notice with an email address in place of the form. The team adds each person who writes to it by hand.

## 5. The database

- `docs/DEPLOY.md` section 4 gives the rules for a migration. A migration that adds or changes a column must change `packages/db/src/schema.ts` too. `packages/db/tests/schema.test.ts` fails when one changes without the other.
- An empty answer column means the form did not ask that question at signup.
- A second signup with the same email address changes nothing, and the person sees the normal confirmation. The form cannot prove who owns an address, so it never rewrites a row and never reveals that one exists. To change an answer or to return after a removal, a person writes to the team, and an operator edits the row by hand.
- Keep the waitlist database first in `d1_databases` of `apps/web/wrangler.jsonc`. The admin Worker test compares its database with the first one there.
- EmDash makes and changes the tables of the content database itself (section 11.8).

## 6. The export

The **Export** button and `pnpm list:export --remote` run one atomic statement from `packages/db/src/export.ts`. It stamps and returns each row one time, so a row that changes after its export does not go out again. Refer to section 8 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md).

## 7. Names

Every Cloudflare resource of this repository follows these rules.

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

`src/outer.ts` runs first on each request that reaches Astro. It refuses the unused EmDash routes (section 11.2), then sets the headers from `src/lib/edge.ts`. In production, EmDash sets its own policy under `/_emdash/`, which refuses a frame and permits inline scripts and `https:` images.

The policy of the site permits inline scripts, because the build emits inline module scripts and Bot Fight Mode on the zone injects one. It permits `static.cloudflareinsights.com` for the Web Analytics beacon of the zone.

`apps/web/public/_headers` sets the same headers on the static files. `apps/web/tests/site/csp.test.ts` fails when the two policies differ, and when a page loads a host that the policy does not name. `src/worker/api.ts` sets the headers of the `/api/*` answers itself. The admin Worker sets its own headers (section 10.5).

## 9. Brand files

`RupeeFund/brand` is the only source of the brand colours and files. `pnpm brand:sync` copies the files that `apps/web/scripts/brand-sync.mts` lists from `exports/` on its `main` branch. The script refuses an SVG with active content, because the site serves each SVG from its own origin. The build reads only the committed files. Do not edit them by hand.

- `.github/workflows/brand-sync.yml` runs the sync each day and opens a pull request for a change. It needs the repository setting “Allow GitHub Actions to create and approve pull requests”.
- CI does not run on its pull request. Read the check result in the description before you merge it.
- To sync at once, run the workflow from the Actions tab.
- To sync from a local brand checkout, set `BRAND_DIR` to it and run `pnpm brand:sync`.

## 10. The admin panel

The panel shows the team the waitlist. Its one write is the export stamp (section 10.8).

**Keep the two Workers apart.** Do not add the panel to the site Worker. An Access policy covers a whole Worker, so on the site Worker it asks every visitor to sign in before the signup form shows.

### 10.1 Who gets in

- One Cloudflare Access policy covers the whole `rupeefund-admin` Worker. Access checks every request before the Worker runs. Access covers each address that the Worker answers on.
- `requireAccess` in `apps/admin/src/access.ts` reads the identity from `ctx.access`, which is undefined when Access did not authenticate the request. **Refuse on undefined.** The guard also refuses an `aud` that is not `ACCESS_AUD`, so a pass from another Access application does not open the panel. The Worker checks no token itself.
- Only `wrangler dev` reads the `access` block in `apps/admin/wrangler.jsonc`. A deployment ignores it. `access.dev.aud` must equal `ACCESS_AUD`, or the local panel refuses you.
- The admin Worker binds no static files. Cloudflare puts a Worker with static files behind an internal router, which does not pass `ctx.access` to the Worker.

### 10.2 The addresses

`apps/admin/src/index.ts` maps each address to its handler. Refresh reads only `/api/summary`. Every address except `/api/export` is a `GET` and changes nothing.

### 10.3 How the panel hides an address

- A list endpoint sends a masked address, such as `••••@•••••.com`. SQLite builds it (`apps/admin/src/sql.ts`), so the full address never leaves the database on the list path.
- Only `/api/reveal/:id` and `/api/export` send a full address, and each logs the reader. A reveal needs the `x-rupeefund-admin: 1` header, so a link on another site cannot log a reveal in the name of a reader.
- An answer that carries an address, a name or a question sets `Cache-Control: private, no-store`. Only `/api/summary` permits a cache.
- Migration `0006` set `updates_opt_in = 1` on each row from before 2026-09-12. That person did not tick the box.
- The log keeps 7 days on the Workers Paid plan. Treat it as an operations record, not as a permanent one.

### 10.4 The row budget

D1 bills each scanned row past the monthly allowance, and the site, the content manager and the panel share that allowance. So the panel must stay cheap. For a table of N rows, one pass reads N rows, one `GROUP BY` reads 2N, a page reads its own rows, and a reveal reads 1. One load of the dashboard reads about 5N rows.

**Put no filter on a list endpoint except the `id` cursor, unless an index covers it.** `WHERE id < ?` searches the primary key, so a page reads only its own rows. A filter on a column with no index scans the table, and so does a `LIKE` that matches few rows. Put each slice in the cached `GROUP BY` queries of `/api/summary`. The one exception is `/api/questions`: migration `0005` adds the partial index `idx_waitlist_question` for it.

`apps/admin/src/repo.test.ts` reads `EXPLAIN QUERY PLAN` for each query. It fails in these conditions:

- The page or the reveal does not search the primary key.
- The questions query does not use `idx_waitlist_question`.
- The summary does not cost exactly three table passes and two groupings.

### 10.5 The security headers

`apps/admin/src/headers.ts` holds the policy, which is tighter than the policy of the site. The script keeps `'unsafe-inline'`, because the shell carries one inline script and Bot Fight Mode injects a script on the zone.

### 10.6 The styles

The panel follows the brand guidelines on light surfaces. `apps/admin/src/admin.css` imports `@rupeefund/ui/styles.css`, the styles of the site. [DESIGN.md](DESIGN.md) gives the rules for the admin styles.

### 10.7 JavaScript

The panel needs JavaScript. A page holds no data. The script reads each row from an API address that sends `Cache-Control: private, no-store`. A server-rendered page with rows puts personal data in the HTML, and a browser can keep that HTML in its history and its cache. Write every value through `textContent`. `apps/admin/src/pages.test.ts` fails when a page holds row data, uses a markup sink, or shows the sidebar toggle before the script runs.

### 10.8 The export

`POST /api/export` is the one write. `apps/admin/src/routes.ts` gives the checks that it makes before it stamps a row. A form on another site cannot set the `x-rupeefund-admin: 1` header, and the Worker sends no CORS header, so a script on another site cannot send it.

The Worker logs `export` with the reader, the stamp time `at` and the count, before it builds the file. It logs `export_denied` for each refusal. It drops the cached `/api/summary` in its own data centre. Another data centre can serve the old count for up to 60 seconds. `apps/admin/src/section-records.ts` tells the reader when an export fails.

If you lose a download after the stamp, read `at` from the log. Then follow section 8 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md).

## 11. The content manager

`apps/web/astro.config.mjs` sets up EmDash. Its admin is at `rupeefund.org/_emdash/admin`. It holds the words of the pages (`docs/EDITING.md`), except these:

- A page that is an app, such as `/subscribe`, stays in code.
- The home page is in `src/content/home.mdx`, and the people page in `src/content/people.mdx`. The community team stays in the content manager. `docs/DESIGN.md` names the components of their layout.
- The links of the header and the footer are in `src/components/site/constants.ts`.

### 11.1 How a page gets its content

The site has no content build. On each request, `src/content/load.ts` reads the published entries, and `src/content/entries.ts` checks each one against `src/content/schema.ts`.

`src/lib/cache.ts` sets how long and what the Cloudflare edge keeps. The supporter figures are at most 1 hour old. `apps/web/tests/site/cache.test.ts` checks what the edge and a browser keep. A browser keeps no page.

`src/middleware.ts` reads the whole page before it sends it, so a page that fails while it renders answers 500 (`src/pages/500.astro`). A failed read of the database also shows that page, except the read of the supporter figures.

- A publish, unpublish, delete or restore purges every kept page. EmDash does not check the purge, and a byline change purges nothing, so old words can stay until the limits end. To purge again, publish again. A deploy empties the cache.
- The edge serves a kept page without the Worker, so `src/outer.ts` does not run. Thus each kept page must be the same for each visitor.
- With the cache on, Cloudflare bills each request for a static file as a Worker request.

### 11.2 The public addresses

- `/media/<key>` and `/_emdash/api/media/file/<key>` send a file without a sign-in only when published content uses it. Else they need a signed-in, active person, and answer 404 to the others (`src/middleware.ts`). `/_image` always needs a signed-in person. `src/content/media.ts` lists the image types that `/media/<key>` sends. The check of section 11.1 refuses each other type, so an SVG with a script cannot reach a page.
- `src/outer.ts` answers 404 to each EmDash route that the site does not use, and `src/lib/edge.ts` lists them. Under `astro dev` the setup routes stay open, for the local sign-in of `docs/CONTRIBUTING.md`.
- `src/outer.ts` answers 401 to a call to `/_emdash/api/*` with no GitHub sign-in, before EmDash starts. So a visitor cannot use the search, the comments or the other sign-in methods of EmDash, and cannot make EmDash write to the database. An API token opens only the routes where EmDash checks the token. `TOKEN_UNCHECKED` in `src/lib/edge.ts` lists the public routes of EmDash. Check that list at each EmDash update. Two routes stay open to all: `/_emdash/api/media/file/` and **Log out**.
- Two WAF rules on the zone block common scanner paths and limit the requests of each address, before they start the Worker (section 11.6 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md)).

### 11.3 Who gets in

People sign in with GitHub through `src/outer.ts` and `packages/auth`. `packages/auth/src/github.ts` maps each team of the `RupeeFund` organization to a role. A person in no team does not get in, and EmDash makes no account. `docs/EDITING.md` section 1 gives the sign-in rules.

- The callback sets a signed cookie for the session (`IDENTITY_SECONDS` in `packages/auth/src/routes.ts`). On each request, `src/auth/emdash.ts` gives EmDash the person in that cookie, and EmDash sets the role from it. So a team change takes effect at the next sign-in (section 11.2 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md)).
- The sessions stay in the content database (`src/auth/session-store.ts`), because EmDash writes the session on each request and KV takes one write per second to a key.

### 11.4 The rules on content

Two parts hold the rules. When you change one, read the other. `docs/EDITING.md` section 2 gives the rules for each role.

- The hooks in `src/plugin/hooks.ts`, which `src/plugin.ts` registers. The hooks refuse each schedule, so an entry goes live only when a person publishes it.
- `src/middleware.ts`, with the routes in `src/lib/guard.ts`. It refuses a person below Admin each write to the FAQ, the community team and the MCP server of EmDash, and each write to a legal page that the hooks do not see. This includes the delete, because the delete hook does not name the person. The delete, restore and copy of the MCP server run no hook that names the person. It refuses the delete of a legal page from each person. It refuses each change to the model from a browser session. Only an API token changes the model (section 11.6).

A cron trigger (`triggers` in `apps/web/wrangler.jsonc`) runs `scheduled()` in `src/worker.ts` once a day at 00:00 UTC. EmDash cleans up only in a run that starts at minute 0, so keep the cron at minute 0. A late run skips the clean-up until the next day. `src/worker/maintenance.ts` logs whether the clean-up ran or was skipped. The clean-up deletes the older revisions of an entry for good (`docs/EDITING.md` section 3). The clean-up also removes expired sign-in challenges and tokens, unfinished uploads (D1 and R2), stale media-usage rows and old R2 transfer files. It keeps the newest 10,000 rows of the 404 log. A scheduled backup runs at the same time, if an admin turns it on. One run each day is enough, because the site refuses schedules.

### 11.5 Preview

The **Preview** button opens the entry at its address with a `_preview` token. `toolbar: false` turns off the EmDash edit toolbar, so a signed-in person cannot change a page by accident.

EmDash shows the drafts to a signed-in person whose browser has the edit cookie `emdash-edit-mode`. So `src/outer.ts` sends each `GET` with that cookie back to the same address, and removes the cookie.

### 11.6 The content model

The layout stays in code. To change a field, change these together:

- `apps/web/seed/seed.json`, the model of a new database
- the live database, with an API token (`docs/DEPLOY.md` section 3)
- `src/content/schema.ts` and the map in `src/content/entries.ts`
- the component in `src/components/site/`, or `src/components/people/` for the community team

The seed applies only to a new database, such as the local one that `pnpm db:reset` makes.

### 11.7 The blog

`src/content/schema.ts` gives the fields of a post and the blocks that a body can hold, and `src/content/html.ts` renders them. `src/plugin.ts` adds the callout, the quote and the call to action to the editor. `docs/EDITING.md` section 8 lists what the check of section 11.1 refuses.

### 11.8 EmDash updates

EmDash changes its own database on the first request after a deploy of a new version, with no step to approve it. So Renovate does not merge an EmDash update by itself (`renovate.json`). Section 11.3 of the [staff runbook](https://github.com/RupeeFund/ops/blob/main/docs/RUNBOOK.md) gives the steps for an update.
