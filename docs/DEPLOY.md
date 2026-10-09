# Deployment

The account uses the Workers Paid plan.

## 1. The branch model

| Branch | Site                  | Worker            | Trigger               |
| ------ | --------------------- | ----------------- | --------------------- |
| `main` | none                  | none              | never                 |
| `live` | `rupeefund.org`       | `rupeefund-web`   | a promote (section 3) |
| `live` | `admin.rupeefund.org` | `rupeefund-admin` | a promote (section 3) |

`rupeefund-web` serves the site and the content manager. Each Worker has its own Cloudflare Workers Builds project, and each watches `live`. One promote ships both Workers. Each project uses the repository root as the root directory, because pnpm installs the whole workspace from the root lockfile.

| Worker            | Build command                                                                                                                                           | Deploy command                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `rupeefund-web`   | `pnpm check && pnpm turbo run build --filter=@rupeefund/web`                                                                                            | `pnpm --filter @rupeefund/web exec wrangler deploy`   |
| `rupeefund-admin` | `pnpm check && pnpm turbo run build --filter=@rupeefund/admin && pnpm --filter @rupeefund/admin exec node ../../packages/db/scripts/assert-applied.mts` | `pnpm --filter @rupeefund/admin exec wrangler deploy` |

The build is the only gate of a deploy. `pnpm check` runs first, and the build of `rupeefund-web` and `rupeefund-admin` also checks the migrations of the live database (section 4). When a step fails, Workers Builds deploys nothing, and the earlier version stays live. CI on `main` and the browser tests are signals. They do not stop a deploy.

The Workers Builds API token of `rupeefund-web` and `rupeefund-admin` needs the D1 Read permission for the migration check.

Turn off branch builds for all branches except `live` on each project. Keep them off. `docs/ARCHITECTURE.md` section 3 gives the reason.

Pull requests go to `main`. A merge deploys nothing. Do not run `wrangler deploy` by hand. It uploads whatever `apps/web/dist` holds and skips the build guards. You can run `pnpm wrangler rollback` in an incident, because it ships no new code. It also rolls back the content manager, so read section 11.4 first. For the admin Worker, run `pnpm --filter @rupeefund/admin exec wrangler rollback`.

## 2. How to prove a change

You prove every change on your own machine. No test reaches the live database.

Run the gate in `docs/CONTRIBUTING.md`. `pnpm dev` and the gate use the always-pass Turnstile test pair, so the form completes with no real widget. Read the local rows:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --local --persist-to ../../.wrangler/state --command "SELECT email, consent_at FROM waitlist"
```

## 3. How to promote

A promote fast-forwards `live` to a commit on `main`. Workers Builds then builds and deploys each Worker (section 1). Apply each new migration before you promote (section 4).

From a computer:

```sh
git fetch origin
git push origin <sha>:live
```

From the phone, run the `Promote` workflow from the Actions tab on `main`. It fast-forwards `live` to the tip of `main` and does nothing else. A second run on the same commit changes nothing.

Do not force the push. `live` is always a prefix of `main`, so a promote takes a commit and everything before it. Promote often.

To go back, run `pnpm wrangler rollback` and `pnpm --filter @rupeefund/admin exec wrangler rollback`. Then purge the zone cache. If the bad version changed the content database, read section 11.4. Do not delete the Worker. A deleted Worker loses its custom domain and every earlier deployment.

## 4. How to apply a migration

The deployment applies no migration. You apply each one by hand, in this order:

1. Export the live database.
1. Apply the migration to the live database.
1. Promote (section 3).

```sh
pnpm db:migrate --remote
```

The command exports the live database to a new temporary folder first, and prints the file path. On macOS and Linux, only your user can read that folder. It stops when the export fails. Then it applies the new migrations and confirms that none are left. Wrangler asks you to confirm the apply. Delete the export file when you are done, because it holds the list. Without `--remote`, the command migrates the local database.

The build of `rupeefund-web` and `rupeefund-admin` refuses a commit with a migration that the live database has not applied. Workers Builds then deploys nothing. Apply the migration, then retry the build in the Workers Builds dashboard. A second promote of the same commit starts no build.

**Make each migration additive.** During a promote two Worker versions read the one live database. Add a column with a default or with NULL permitted. A change that removes a column needs two promotes: one that stops all reads of the column, and a later one that drops it.

**`0005_signup_data.sql` is the one exception.** It rebuilds the `waitlist` table. It went live on 2026-10-01.

Never edit a migration that has run. Never reuse a file name. Wrangler matches a migration by file name only. A changed file that has run does nothing. A reused file name runs nothing and reports no error. `packages/db/tests/replay.test.ts` refuses the retired names. `wrangler d1 migrations list` proves only that the names agree. To check the schema, query the tables:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## 5. Secrets and variables

`TURNSTILE_ACTION` has two homes. The Turnstile widget uses the constant in `apps/web/src/lib/turnstile.ts`. The Worker checks the variable in `apps/web/wrangler.jsonc`. The two must match. `pnpm run build` fails when they differ.

The Workers Builds settings hold no variable. One Turnstile widget serves the site, and its domain list holds `rupeefund.org` only. To rotate the sitekey, change the constant in `apps/web/src/lib/turnstile.ts` and promote. Set the secret with:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

The sign-in (`docs/ARCHITECTURE.md` section 11.3) needs two more secrets. A deploy fails while one is missing, so set them before the first promote:

```sh
pnpm wrangler secret put GITHUB_CLIENT_SECRET   # from the GitHub App, section 11.2
openssl rand -base64 32 | pnpm wrangler secret put AUTH_SECRET
```

A new `AUTH_SECRET` signs each person out. For `pnpm preview`, put the two in `apps/web/.env`.

A `--remote` command needs the Cloudflare account. Put `CLOUDFLARE_ACCOUNT_ID` in `apps/web/.env`. Wrangler reads that file itself. Without it, wrangler asks which account to use. Do not put the account in `wrangler.jsonc`.

`pnpm dev` and `pnpm preview` carry the always-pass Turnstile test values and `PUBLIC_ALLOW_TEST_SITEKEY=true` themselves. Do not put a Turnstile value in `.env`. If an old `pnpm bootstrap` made `apps/web/.env`, delete its Turnstile lines. Never set that opt-in in the Workers Builds settings. A deployed build with the test sitekey refuses every signup, so `pnpm run build` exits 1 when it finds one.

## 6. How to verify a deployment

Purge the zone cache first. Then:

```sh
pnpm live:check
```

It checks the site, the content manager, the admin Worker and the old content manager address. It prints one `PASS` or `FAIL` line for each check, and exits 1 on a failure. `apps/web/scripts/live-check.mts` lists the checks.

Then complete the form one time, and read the row:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --command "SELECT email, consent_at FROM waitlist"
```

Then sign in to the content manager and open an entry. Sign in to the admin panel with a browser (section 10.3).

## 7. How to remove a person

A removal request comes by email to `rupeefund@fossunited.org`. There is no endpoint. Mark the row:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --command \
  "UPDATE waitlist SET unsubscribed_at = unixepoch() * 1000, updated_at = unixepoch() * 1000
   WHERE email = 'someone@example.com' AND unsubscribed_at IS NULL"
```

The mark is permanent. The exporter skips the row, and a new signup does not change it. Do not delete the row, or the next signup adds it again. To add the person again, clear `unsubscribed_at` by hand.

## 8. How to export the list

The command reads the local database unless you pass `--remote`.

```sh
pnpm list:export --remote --dry-run > list.csv   # prints the CSV, changes nothing
pnpm list:export --remote > list.csv             # prints the CSV, then stamps exported_at
```

`packages/db/src/export.ts` gives the columns of the file. The amount, the months, the question, the roles and the reasons stay in the database.

[ARCHITECTURE.md](ARCHITECTURE.md) section 6 tells which rows go out. A `--remote` run needs wrangler login.

A run exports one batch. When more rows wait, the last line on stderr says `still pending`. Run the command again until that line stops. Send each run to a new file, because `>` replaces the old file.

To export from the admin panel, press **Export**. It saves the file to your device.

To send a batch again after a lost file, find its time `at`. The `export` log line and stderr both show it. Then clear the stamp and export again:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --command \
  "UPDATE waitlist SET exported_at = NULL WHERE exported_at = <at>"
```

Before you clear it, count the rows with that `exported_at`. The number must equal the `count` in the log line. If it does not, two exports share the time. Stop. Ask the team. The next export skips a row if its person unsubscribed after the first export.

## 9. How to move to a different account

The domain uses Cloudflare Registrar. A move to a different Cloudflare account takes only the registration. You make the zone, the Workers, the databases, the media bucket and the Turnstile widget again in the new account.

A Worker custom domain needs an active zone, and the zone becomes active only after the registration moves. So the site is down from the move until the first deploy in the new account. After the move, Cloudflare locks the registration against transfer for 30 days ([Cloudflare documentation](https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/)).

Before the move:

1. Turn off DNSSEC on the old zone. Wait until `dig +short DS rupeefund.org @a0.org.afilias-nst.info` returns nothing.

1. Add `rupeefund.org` as a zone in the new account. Copy the DNS records, the redirect rules, the WAF custom rules, Always Use HTTPS and Bot Fight Mode from the old zone. Do not add an apex record. The custom domain makes it.

1. Tell the editors to stop all edits until the move ends.

1. Export the data from the old account. Do this step before you change a `wrangler.jsonc`, because wrangler finds a database by the ID in that file. D1 does not export a database that has virtual tables, and the search index of each collection is a virtual table. So the loop turns off the search first:

   ```sh
   for c in posts faq pages; do
     curl -fsS -X POST -H "authorization: Bearer $EMDASH_TOKEN" -H "x-emdash-request: 1" \
       -H "content-type: application/json" -d "{\"collection\":\"$c\",\"enabled\":false}" \
       https://rupeefund.org/_emdash/api/search/enable
   done
   CLOUDFLARE_ACCOUNT_ID=<old> pnpm wrangler d1 export rupeefund-waitlist --remote --no-schema --table waitlist --output /tmp/waitlist-rows.sql
   CLOUDFLARE_ACCOUNT_ID=<old> pnpm wrangler d1 export rupeefund-content-db --remote --output /tmp/content.sql
   ```

   `EMDASH_TOKEN` is an API token with the **Admin** scope (section 11.5). The loop names each collection that has `search` in `supports` in `apps/web/seed/seed.json`. Compare the two lists before you run it.

1. Make the waitlist database with `pnpm wrangler d1 create rupeefund-waitlist --location apac`. Copy its `database_id` into the first entry of `d1_databases` in `apps/web/wrangler.jsonc` **and into `apps/admin/wrangler.jsonc`**. Both Workers bind that database. Apply every migration with `pnpm wrangler d1 migrations apply rupeefund-waitlist --remote`.

1. Make the resources of the content manager (section 11.1).

1. Make one Turnstile widget for `rupeefund.org`. Put its sitekey in `apps/web/src/lib/turnstile.ts`. Set its secret with `pnpm wrangler secret put TURNSTILE_SECRET`. Set the sign-in secrets of section 5.

1. Import the data into the new account:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<new> pnpm wrangler d1 execute rupeefund-waitlist --remote --file /tmp/waitlist-rows.sql
   CLOUDFLARE_ACCOUNT_ID=<new> pnpm wrangler d1 execute rupeefund-content-db --remote --file /tmp/content.sql
   ```

   The content export holds the tables and the people of the content manager, so the live site needs no setup wizard.

1. Copy each object of `rupeefund-media` to the new bucket, for example with [rclone](https://developers.cloudflare.com/r2/examples/rclone/).

1. Delete `/tmp/waitlist-rows.sql` and `/tmp/content.sql` after the move. They hold the list and the email addresses of the editors.

The move:

1. Disconnect the two Workers Builds projects in the old account. Connect each in the new account, with the settings in section 1.
1. In the old account, open **Domain Registration**, then the domain, then **Configuration**, and move it to the new account. Accept the move in the new account.
1. When the zone is active, promote. The deploy makes the custom domain.
1. Run the search loop of the export step again, with `true` in place of `false`. The site does not use the search, but the content manager does.
1. Repeat sections 10.1 to 10.3 for the admin Worker.
1. Verify with section 6. Look for rows that the old Worker took after the copy, and copy them.
1. Tell the editors that they can edit again.
1. Turn on DNSSEC in the new zone.

## 10. The admin panel

The panel needs no secret. Cloudflare Access does the login. The Worker needs one variable, `ACCESS_AUD` in `apps/admin/wrangler.jsonc`: the audience tag of its Access application. The Worker refuses every request whose Access pass carries another tag.

### 10.1 The login method

The panel admits the members of the Cloudflare account. They sign in with the Cloudflare identity provider, which Cloudflare adds to each Zero Trust organization. A person who is not a member of the account cannot sign in. `docs/TODO.md` holds the plan to use a GitHub team in its place.

### 10.2 Protect the Worker

Go to **Workers & Pages**. Open `rupeefund-admin`. Open the **Access** tab. Put the Worker behind Access. This covers every address the Worker answers on.

Copy the **Application Audience (AUD) Tag** of the new application into `ACCESS_AUD` and into `access.dev.aud` in `apps/admin/wrangler.jsonc`. When you remove and add the application again, the tag changes. Update both values, or the panel refuses every person.

In the application, set the Cloudflare identity provider as the only login method. Then select the reusable policy `Cloudflare account members`. Set the session duration. A long session stays signed in on a device that nobody watches.

To add or remove a person, add or remove the person as a member of the Cloudflare account. A member can also open the Cloudflare dashboard with the role that you give. A removed person keeps access until the session ends, so also revoke the session in **Zero Trust** > **Team & Resources** > **Users**.

A person takes a seat at the first sign-in and keeps it until you remove the person. When no seat is free, Access refuses the next person. Read the seat count in the Zero Trust overview before you invite the team.

### 10.3 Prove it

```sh
pnpm live:check
```

The two `admin` lines must say `PASS`. A `FAIL` on either line means Access is not in front of the Worker. Stop and fix the policy before you tell the team.

Then sign in with a browser and read the dashboard. A `{"error":"forbidden"}` page after a good sign-in means `ACCESS_AUD` is wrong. Do the browser sign-in after each deploy that changes `apps/admin/wrangler.jsonc`.

### 10.4 If you ever remove Access

The Worker refuses every request (`docs/ARCHITECTURE.md` section 10.1). This is intentional. A panel that stops is safer than a panel that opens to the public.

## 11. The content manager

`docs/ARCHITECTURE.md` section 11 tells how the parts work together. The content manager is at `https://rupeefund.org/_emdash/admin`. `https://rupeefund.org/admin` sends a person there.

### 11.1 Make the resources

The live account has the resources. Make them again only for a move to a new account (section 9). Turn on R2 for the account in the dashboard, under **R2 Object Storage**. Then make the resources:

```sh
pnpm wrangler d1 create rupeefund-content-db --location apac
pnpm wrangler r2 bucket create rupeefund-media --location apac
```

`apac` keeps the data near the readers, as for `rupeefund-waitlist`. In `apps/web/wrangler.jsonc`, put the database ID in the `DB` entry of `d1_databases`. Then merge the change.

A new content database needs the setup wizard. After the deploy, sign in as a member of `cms-admins` at `https://rupeefund.org/_emdash/admin`. EmDash opens the wizard. Keep **Sample content** and click **Continue**. The wizard fills the database from `apps/web/seed/seed.json`.

### 11.2 Add a person

Add the person to one team of the `RupeeFund` GitHub organization: `cms-authors`, `cms-editors` or `cms-admins`. Send them a link to `docs/EDITING.md`. EmDash makes the account at the first sign-in.

To remove a person, remove them from the team. The removal takes effect at the latest after 8 hours. To lock the person out at once, also disable the account in **Users**.

The GitHub App `the-rupee-fund-cms` of the organization runs the sign-in. It needs two permissions, **Members** (read) and **Email addresses** (read), and two callback addresses, `https://rupeefund.org/auth/callback` and `http://localhost:8789/auth/callback`. It must be installed on the `RupeeFund` organization, or it cannot read the teams. Its client ID is `GITHUB_CLIENT_ID` in `apps/web/wrangler.jsonc`. To make a new client secret, open the settings of the app and click **Generate a new client secret**. Then set it (section 5).

### 11.3 Update EmDash

EmDash changes its database on the first request after the deploy. Renovate opens one pull request for all EmDash packages and does not merge it.

1. Read the release notes of each version in the pull request.
1. Merge the pull request. Write down the time.
1. Promote (section 3).
1. Run `pnpm live:check`. Sign in to the content manager and open an entry.

If the site or the content manager fails, go back (section 11.4) to the time you wrote down.

### 11.4 Go back

- **Wrong words on the site.** Restore the earlier revision of the entry in the editor, and publish it. The site shows it at the next page load.

- **An entry that does not show.** The site refused the entry and left it out (`docs/ARCHITECTURE.md` section 11.1). Open `rupeefund-web` in **Workers & Pages**. Go to **Observability**. Search for `The site leaves out an entry`. The line gives the entry and the problem, for example `posts/hello`. Correct the entry. Then publish it again. `docs/EDITING.md` section 5 lists what the site refuses.

- **A broken site or content manager.** Run `pnpm wrangler rollback`. If the bad version changed the content database, also restore the database to the time before the deploy:

  ```sh
  pnpm wrangler d1 time-travel restore rupeefund-content-db --timestamp=<time>
  ```

  Time Travel keeps 30 days on the Workers Paid plan ([Cloudflare documentation](https://developers.cloudflare.com/d1/reference/time-travel/)). The restore removes each edit after that time.

### 11.5 Change a content field

The site shows only the fields that its code reads (`docs/ARCHITECTURE.md` section 11.6). The live content manager refuses a schema change from a browser. Change a live field with an API token:

1. Sign in as an admin. Open `https://rupeefund.org/_emdash/admin/settings/api-tokens`. Make a token with the **Admin** scope. Put it in the environment variable `EMDASH_TOKEN`.

1. Change the field in `apps/web/seed/seed.json`. Then change it on the live site. To add one, send its entry from the seed:

   ```sh
   api=https://rupeefund.org/_emdash/api/schema/collections/<collection>/fields
   curl -fsS -X POST -H "authorization: Bearer $EMDASH_TOKEN" -H "x-emdash-request: 1" \
     -H "content-type: application/json" -d '<field from the seed>' "$api"
   curl -fsS -X DELETE -H "authorization: Bearer $EMDASH_TOKEN" -H "x-emdash-request: 1" \
     "$api/<field>"
   ```

1. Revoke the token on the same page.

Keep this order, so that each version of the code finds the fields that it reads:

- **To add a field.** Add it, and fill it in each entry. Then promote the code that reads it.
- **To remove a field.** Promote the code that stops reading it. Then remove it.

### 11.6 Block the scanners

Each request that no static file answers starts the Worker and uses CPU time. A WAF custom rule on the zone blocks the paths of common scanners first.

1. Go to the zone > **Security** > **WAF** > **Custom rules**.

1. Add the rule `site: block scanner paths`, with the action **Block**, and this expression:

   ```txt
   (http.host eq "rupeefund.org" or starts_with(http.host, "rupeefund.org:")) and (starts_with(http.request.uri.path, "/wp-") or ends_with(http.request.uri.path, ".php"))
   ```

1. Run `pnpm live:check`. The line `site blocks the scanners` must say `PASS`.

The rule blocks each path that starts with `/wp-` or ends with `.php`. Do not give a page such a path.

A rate-limit rule on the zone limits one address to 100 requests in 10 seconds. It does not count the static files under `/_astro/`. The Free plan permits one such rule, with the path as the only field.

1. Go to the zone > **Security** > **WAF** > **Rate limiting rules**.
1. Add the rule `site: limit each IP to 100 Worker requests per 10 seconds`, with the action **Block** for 10 seconds, and this expression:

   ```txt
   (not starts_with(http.request.uri.path, "/_astro/"))
   ```

### 11.7 The old address

The content manager ran in the Worker `rupeefund-cms` at `cms.rupeefund.org` before it moved into `rupeefund-web`. The zone sends that address to `https://rupeefund.org/admin` with two parts:

- A proxied `AAAA` record `cms` with the address `100::`. No server has that address. Cloudflare answers first.
- A Redirect Rule: when the hostname is `cms.rupeefund.org`, a 301 to `https://rupeefund.org/admin`.

`pnpm live:check` checks the 301. Keep the DNS record and the Redirect Rule.
