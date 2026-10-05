# Architecture

## 1. What the system does

The system shows public pages and collects a mailing list. It takes no payment and holds no vote. A content manager holds the words of the pages. Refer to section 11.

`packages/db/src/schema.ts` gives what the system stores for each person. It stores no payment instrument.

## 2. The parts

| Part          | Technology                   | Function                                      |
| ------------- | ---------------------------- | --------------------------------------------- |
| Site          | Astro                        | Makes static HTML at build time               |
| Public Worker | Hono on Cloudflare Workers   | Answers `/api/health` and `/api/waitlist`     |
| Admin Worker  | Hono on Cloudflare Workers   | Shows the team the list. Refer to section 10. |
| Database      | Cloudflare D1                | Keeps the `waitlist` table                    |
| CMS Worker    | EmDash on Cloudflare Workers | Holds the content. Refer to section 11.       |
| Scripts       | TypeScript in `src/scripts/` | Adds behaviour to the static pages            |

On `rupeefund.org`, only a request to `/api/*` reaches the public Worker. Cloudflare serves every other path from the static files.

On `admin.rupeefund.org`, the admin Worker answers every path. Both Workers use one database. Only the public Worker adds rows. The admin Worker writes only the export stamp, `exported_at`.

AGENTS.md maps the packages.

A path in this document starts at the repository root. `src/` means `apps/web/src/`.

To add an endpoint, write a handler in `src/worker/routes/`. Connect it in `src/worker/index.ts` above the `/api/*` catch-all. Use a path under `/api/`, because no other path reaches the Worker.

Each command under `scripts` in `package.json` runs in the pnpm shell emulator, so it runs the same on Windows. It accepts a `NAME=value` prefix, `&&`, `||`, `|`, a redirect and `$(...)`. Do not use `if`, `for` or `case`: they fail without a clear error.

## 3. The one environment

The one environment is `live`, at `rupeefund.org`, `admin.rupeefund.org` and `cms.rupeefund.org`. Section 7 names its resources. Three Workers are not three environments. There is no preview URL.

A second address for `rupeefund-web` keeps the live bindings and writes to the live list. So the configuration refuses a `workers.dev` address and a preview URL. The configuration does not stop a second custom domain. That rule is a decision, not a check. Prove a change on your own machine, against a local database.

## 4. How a person joins the list

`POST /api/waitlist` is the only address the public can write to. `apps/web/src/worker/routes/waitlist.ts` gives the order of the checks. Two of them are intentional: a request with no `Origin` header passes, and a filled hidden field gets a success answer and writes nothing. If the email address already has a row, the insert does nothing.

Each row needs a Turnstile token, and Turnstile needs JavaScript. A browser with no script sees a notice in place of the form. The notice gives an email address. When a person writes to it, the team adds the person by hand.

## 5. The database

`packages/db/migrations/` holds every migration. The live database keeps its own ledger, so `wrangler d1 migrations apply` runs only the files it has not seen. `docs/DEPLOY.md` section 4 gives the rules for a new migration.

`packages/db/src/schema.ts` holds the type of each table row and the values the form accepts. The site, the admin panel and the export import them from there. A migration that adds or changes a column must change that file too. `packages/db/tests/schema.test.ts` holds the two together. Its typecheck fails when the type changes alone, and its run fails when a migration changes alone.

`packages/db/migrations/` and `schema.ts` give each column. An empty answer column means the form did not ask that question when the person signed up. The migration that added the column tells when.

A second signup with the same email address changes nothing. The first row stands, and the person sees the normal confirmation. The form cannot prove who owns an address, so it never rewrites a row and never reveals that one exists. To change an answer or to return after a removal, a person writes to the team, and an operator edits the row by hand.

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

`apps/web/public/_headers` sets the security headers on every page. The content security policy permits inline scripts for two reasons. The build emits inline module scripts. Bot Fight Mode on the zone injects one inline script. The policy also permits `static.cloudflareinsights.com` because Web Analytics on the zone injects its beacon. `apps/web/tests/site/csp.test.ts` fails when a page loads a host the policy does not name.

`apps/web/public/_headers` applies to `rupeefund.org` only. The admin Worker sets its own headers. Refer to section 10.5.

`run_worker_first` in `apps/web/wrangler.jsonc` sends `/api/*` to the Worker, so `_headers` does not apply to those answers. `apps/web/src/worker/index.ts` sets the headers of those answers itself.

## 9. Brand files

`RupeeFund/brand` is the only source of the brand colours and the brand files. `pnpm brand:sync` reads `exports/` on the `main` branch of `RupeeFund/brand` and writes the files that `apps/web/scripts/brand-sync.mts` lists. The site serves each SVG from its own origin, so the script refuses an SVG with active content.

The committed files are the only brand input to the build. The build does not fetch from the brand repository. Do not edit these files by hand.

The `Brand sync` workflow runs `pnpm brand:sync` each day. When the files differ from the brand repository, it runs `pnpm format:check`, `pnpm check` and `pnpm run build`, opens or updates the pull request from `chore/brand-sync`, and fails. The workflow needs the repository setting “Allow GitHub Actions to create and approve pull requests”. To take a brand update, review and merge that pull request. CI does not run on it, so read the check result in its description. To sync at once, run the workflow from the Actions tab.

To sync from a local brand checkout before it reaches `main`, set `BRAND_DIR` to the checkout and run `pnpm brand:sync`. The script then reads `exports/` in that checkout.

## 10. The admin panel

The panel shows the team the waitlist. It writes one thing: the export stamp, `exported_at`. Refer to section 10.8.

**Keep the two Workers apart.** Do not add an admin route to `rupeefund-web`. A Cloudflare Access policy covers a whole Worker. If a policy covers `rupeefund-web`, it asks every visitor to sign in before the signup form shows. Also, an admin deployment cannot break the form. The same rule keeps EmDash out of `rupeefund-web`.

### 10.1 Who gets in

One Cloudflare Access policy covers the whole `rupeefund-admin` Worker. Access checks every request before the Worker runs, and it covers each address the Worker answers on.

`requireAccess` in `apps/admin/src/access.ts` reads the identity from `ctx.access`. `ctx.access` is undefined when Access did not authenticate the request. **Refuse on undefined.** The guard also refuses a `ctx.access` whose `aud` is not `ACCESS_AUD`. So a pass from another Access application does not open the panel. The Worker holds no token code, no key set, and no secret. The platform does that work.

On your machine, the `access` block in `apps/admin/wrangler.jsonc` makes wrangler supply a mock `ctx.access`, so the local panel signs you in as `operator@example.com`. Its `aud` is the same as `ACCESS_AUD`, so the local panel passes the same check. Only `wrangler dev` reads that block. A deployment ignores it.

The admin Worker binds no static files on purpose. Cloudflare serves a Worker that has static files behind an internal router, and that router does not pass `ctx.access` to the Worker. The Worker builds every page itself, so the router never exists.

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

The log keeps 3 days on the Workers Free plan. Treat it as an operations record, not as a permanent one.

### 10.4 The row budget

D1 counts the rows a query scans, and the daily free allowance is for the whole account. The public signup shares it. An exhausted allowance makes the signup fail, so the panel must stay cheap.

For a table of N rows, one pass reads N rows, one `GROUP BY` reads 2N, a page reads its own rows, and a reveal reads 1. One load of the dashboard reads about 5N rows.

**Put no filter on a list endpoint except the `id` cursor, unless an index covers it.** `WHERE id < ?` searches the primary key, so a page reads only its own rows, at any depth. A filter on a column with no index scans the table. A `LIKE` that matches few rows also scans it. Put each slice in the cached `GROUP BY` queries of `/api/summary`.

`/api/questions` is the one exception, because an index covers it. Migration `0005` adds the partial index `idx_waitlist_question` on `id`, over the rows where `question` is not empty.

`apps/admin/src/repo.test.ts` reads `EXPLAIN QUERY PLAN` for each query. It fails in these conditions:

- The page or the reveal does not search the primary key.
- The questions query does not use `idx_waitlist_question`.
- The summary does not cost exactly three table passes and two groupings.

### 10.5 The security headers

`apps/admin/src/headers.ts` holds the policy. The Worker wraps every answer it makes, so a refusal carries the same headers as a page.

The policy is tighter than `apps/web/public/_headers`. It starts at `default-src 'none'`, names no external host, and permits no form and no frame. It keeps `'unsafe-inline'` for the script, because the shell carries one inline script and because Bot Fight Mode injects a script on the zone. The style comes from `/assets/` alone, so `style-src` is `'self'`.

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

EmDash runs in `rupeefund-cms` at `cms.rupeefund.org`. It holds the blog, the FAQ, the home page, the people page and the policies. The site stays static. A page that is an app, such as `/subscribe`, stays in code.

### 11.1 How the content reaches the site

The build of `rupeefund-web` reads `https://cms.rupeefund.org/published.json`. `apps/web/src/build/content.ts` holds the address. `packages/content/src/schema.ts` gives the shape of the document. The build reads the document one time and uses it for the pages and the images. The build exits 1 when the address does not answer in 30 seconds, answers with an error, or sends a document that breaks the schema. The last good deployment then stays live. Turborepo never caches the site build, because the document is not a file in the repository.

The build copies each image of the document into `dist/media/`. So the content security policy names no new host.

`CMS_CONTENT_FILE` and `CMS_CONTENT_URL` replace the address on your machine and in CI. The deploy guard refuses both in Workers Builds.

### 11.2 The public addresses

Only two addresses of `rupeefund-cms` are public:

- `/published.json` sends the published entries and nothing else.
- `/media/<key>` sends a file only when published content uses it.

`PUBLIC_LIMITER` limits both. When the build gets a `429`, it waits for the time in `Retry-After`, up to one minute, and tries again. It tries five times. Each answer that the Worker code makes carries `x-robots-tag: noindex`. The static files in `apps/cms/public/` do not.

The media addresses send only PNG, JPEG, GIF, WebP and AVIF files, with a sandbox policy. The schema refuses every other image type, so an SVG with a script cannot reach either site.

### 11.3 Who gets in

EmDash signs people in with passkeys. A person joins only through an invite from an admin. The content manager sends no email, so the admin sends the invite link by hand. Self-signup stays off. A new person gets the Author role (30) by default. An editor has role 40, and an admin has role 50.

Until the first admin exists, any person can run the setup. A temporary Access application closes the setup until then (`docs/DEPLOY.md` section 11.2).

The files that EmDash stores are private. `apps/cms/src/middleware.ts` answers 404 to `/_emdash/api/media/file/*` and `/_image` without a signed-in person. The public site gets its files from `/media/<key>`.

### 11.4 What a publish does

`apps/cms/src/plugin.ts` adds two rules:

- Only an admin edits, publishes, schedules or unpublishes a policy. So the scheduler publishes only the text of an admin.
- Nobody deletes a policy, because each build needs all four. To change a policy, edit it.
- A publish, an unpublish, a delete or a restore posts to `DEPLOY_HOOK_URL`, the Deploy Hook of `rupeefund-web`. The site then builds again. Requests that arrive before a build starts make one build.

### 11.5 The draft preview

The **Preview** button opens `/preview/<collection>/<id>?_preview=<token>`. The page renders the draft with the components of `packages/site`, the same components that the site uses. Without a valid token for that entry, the page answers 404. An editor in the EmDash edit mode is the exception: EmDash shows that person each draft. The images of a preview come from `/preview/media/<key>`, which needs a signed-in person.

### 11.6 The content model

Each collection has typed fields. The layout stays in code, so an editor changes the words and not the structure. To change a field, change these together:

- `apps/cms/seed/seed.json`, the model
- `apps/cms/src/published.ts`, the map to the document
- `packages/content/src/schema.ts`, the document
- the component in `packages/site/src/`

The `* * * * *` cron runs the scheduled publish. It reads D1 each minute. These reads use the shared allowance of section 10.4.

### 11.7 The blog

A post has a kind, an optional season and its authors. The authors are the EmDash bylines. `packages/content/src/html.ts` gives the blocks that a post can show. The build refuses an embed, raw HTML, a gallery and a reference. `apps/cms/src/published.ts` names the block in the error. The error goes to the log of `rupeefund-cms` as `published_invalid`. `/published.json` answers 500 with no detail, so the build log does not show the reason.

### 11.8 EmDash updates

EmDash changes its own database on the first request after a deploy of a new version. There is no step to approve it. So Renovate does not merge an EmDash update by itself (`renovate.json`). `docs/DEPLOY.md` section 11.6 gives the steps for an update.
