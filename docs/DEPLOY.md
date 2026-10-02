# Deployment

The system runs on the Workers Free plan.

## 1. The branch model

| Branch | Site                  | Worker            | Trigger                                     |
| ------ | --------------------- | ----------------- | ------------------------------------------- |
| `main` | none                  | none              | never                                       |
| `live` | `rupeefund.org`       | `rupeefund-web`   | the maintainer, with the `Promote` workflow |
| `live` | `admin.rupeefund.org` | `rupeefund-admin` | the maintainer, with the `Promote` workflow |

Each Worker has its own Cloudflare Workers Builds project, and both watch `live`. One promote ships both Workers. Both projects use the repository root as the root directory, because pnpm installs the whole workspace from the root lockfile.

| Worker            | Build command                                    | Deploy command                                        |
| ----------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `rupeefund-web`   | `pnpm turbo run build --filter=@rupeefund/web`   | `pnpm --filter @rupeefund/web exec wrangler deploy`   |
| `rupeefund-admin` | `pnpm turbo run build --filter=@rupeefund/admin` | `pnpm --filter @rupeefund/admin exec wrangler deploy` |

Turn off branch builds for all branches except `live` on both projects. Keep them off. `docs/ARCHITECTURE.md` section 3 gives the reason.

Pull requests go to `main`. A merge deploys nothing. Do not run `wrangler deploy` by hand. It uploads whatever `apps/web/dist` holds and skips the build guards. You can run `pnpm wrangler rollback` in an incident, because it ships no new code. For the admin Worker, run `pnpm --filter @rupeefund/admin exec wrangler rollback`.

## 2. How to prove a change

You prove every change on your own machine. No test reaches the live database.

Run the gate in `docs/CONTRIBUTING.md`. `pnpm dev` and the gate use the always-pass Turnstile test pair, so the form completes with no real widget. Read the local rows:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --local --persist-to ../../.wrangler/state --command "SELECT email, consent_at FROM waitlist"
```

## 3. How to promote

Run the `Promote` workflow from the Actions tab on `main`. It fast-forwards `live` to the tip of `main`. It stops when CI has not passed on that commit. It also stops when the promote adds a migration and you did not tick the box that says you applied it (section 4).

Without the workflow, make sure CI passed on the commit. Then fast-forward `live`:

```sh
git fetch origin
git push origin <sha>:live
```

Do not force the push. `live` is always a prefix of `main`, so a promote takes a commit and everything before it. Promote often.

To go back, run `pnpm wrangler rollback` and `pnpm --filter @rupeefund/admin exec wrangler rollback`. Then purge the zone cache. Do not delete the Worker. A deleted Worker loses its custom domain and every earlier deployment.

## 4. How to apply a migration

The deployment applies no migration. You apply each one by hand, in this order:

1. Export the live database.
1. Apply the migration to the live database.
1. Fast-forward `live`.

```sh
pnpm db:migrate --remote
```

The command exports the live database to a new temporary folder first, and prints the file path. On macOS and Linux, only your user can read that folder. It stops when the export fails. Then it applies the new migrations and confirms that none are left. Wrangler asks you to confirm the apply. Delete the export file when you are done, because it holds the list. Without `--remote`, the command migrates the local database.

**Make each migration additive.** During a promote two Worker versions read the one live database. Add a column with a default or with NULL permitted. A change that removes a column needs two promotes: one that stops all reads of the column, and a later one that drops it.

**`0005_signup_data.sql` is the one exception.** It rebuilds the `waitlist` table. It went live on 2026-10-01.

Never edit a migration that has run. Never reuse a file name. Wrangler matches a migration by file name only. A changed file that has run does nothing. A reused file name runs nothing and reports no error. `packages/db/tests/replay.test.ts` refuses the retired names. `wrangler d1 migrations list` proves only that the names agree. To check the schema, query the tables:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## 5. Secrets and variables

| Kind               | Home                                | Key                                       |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| Public build value | `apps/web/src/lib/turnstile.ts`     | the Turnstile sitekey, `TURNSTILE_ACTION` |
| Worker secret      | `wrangler secret`                   | `TURNSTILE_SECRET`                        |
| Worker variable    | `vars` in `apps/web/wrangler.jsonc` | `TURNSTILE_HOSTNAMES`, `TURNSTILE_ACTION` |

`TURNSTILE_ACTION` has two homes. The Turnstile widget uses the constant in `apps/web/src/lib/turnstile.ts`. The Worker checks the variable in `apps/web/wrangler.jsonc`. The two must match. `pnpm run build` fails when they differ.

The Workers Builds settings hold no variable. One Turnstile widget serves the site, and its domain list holds `rupeefund.org` only. To rotate the sitekey, change the constant in `apps/web/src/lib/turnstile.ts` and promote. Set the secret with:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

In this section, `.env` means `apps/web/.env`. A `--remote` command needs the Cloudflare account. Put `CLOUDFLARE_ACCOUNT_ID` in `.env`. Wrangler reads `.env` itself. A value on the command line replaces the value in `.env`. Without it, wrangler asks which account to use. Do not put the account in `wrangler.jsonc`.

For local work, `.env` holds the always-pass test values. `pnpm bootstrap` makes it. `astro build` and `wrangler dev` read it, and direnv loads it into your shell through `.envrc`. Do not also make a `.dev.vars` file, or wrangler ignores `.env`. The `preview` script carries the same values itself, for Playwright in CI, where no `.env` exists.

`.env.example` and `preview` set `PUBLIC_ALLOW_TEST_SITEKEY=true` beside the test sitekey. Never set that opt-in in the Workers Builds settings. A deployed build with the test sitekey refuses every signup, and `pnpm run build` exits 1 before and after `astro build` when it finds one. For this reason, `pnpm run build` fails while `.env` exists. Rename `.env` before you run the deploy build on your machine. `apps/web/tests/deploy/sitekey-literal.test.ts` refuses a script or an `.env.example` that names the test sitekey without the opt-in.

## 6. How to verify a deployment

Purge the zone cache first. Then:

```sh
pnpm live:check
```

It checks the site and the admin Worker, prints one `PASS` or `FAIL` line for each check, and exits 1 on a failure:

- `/api/health` answers `{"ok":true}`.
- `/subscribe` carries a real sitekey, not a test one.
- The home page carries the security headers.
- The logo and the favicon load.
- The admin panel refuses a request with no sign-in, for the page and for the counts.

Then complete the form one time, and read the row:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --command "SELECT email, consent_at FROM waitlist"
```

Then sign in to the admin panel with a browser (section 10.3).

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

The first line of the file is `email,name,attributes`. The `attributes` column is JSON with `source`, `consent_at`, `signed_up_at`, and `updates_opt_in`. If the form did not ask a person about updates, the export writes `updates_opt_in` as `false`. The amount, the months, the question, the roles and the reasons stay in the database.

[ARCHITECTURE.md](ARCHITECTURE.md) section 6 tells which rows go out. The command needs Node 24 or later, and wrangler login for `--remote`.

A run exports one batch. When more rows wait, the last line on stderr says `still pending`. Run the command again until that line stops. Send each run to a new file, because `>` replaces the old file.

To export from the admin panel, press **Export**. It saves the file to your device.

To send a batch again after a lost file, find its time `at`. The `export` log line and stderr both show it. Then clear the stamp and export again:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --command \
  "UPDATE waitlist SET exported_at = NULL WHERE exported_at = <at>"
```

Before you clear it, count the rows with that `exported_at`. The number must equal the `count` in the log line. If it does not, two exports share the time. Stop. Ask the team. The next export skips a row if its person unsubscribed after the first export.

## 9. How to move to a different account

The domain uses Cloudflare Registrar. A move to a different Cloudflare account takes only the registration. You make the zone, the Worker, the database and the Turnstile widget again in the new account.

A Worker custom domain needs an active zone, and the zone becomes active only after the registration moves. So the site is down from the move until the first deploy in the new account. After the move, Cloudflare locks the registration against transfer for 30 days ([Cloudflare documentation](https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/)).

Before the move:

1. Turn off DNSSEC on the old zone. Wait until `dig +short DS rupeefund.org @a0.org.afilias-nst.info` returns nothing.

1. Add `rupeefund.org` as a zone in the new account. Copy the DNS records, the redirect rule, Always Use HTTPS and Bot Fight Mode from the old zone. Do not add an apex record. The custom domain makes it.

1. Make the database with `pnpm wrangler d1 create`. Copy the `database_id` into `apps/web/wrangler.jsonc` **and into `apps/admin/wrangler.jsonc`**. Both Workers bind the one database. Apply every migration with `pnpm wrangler d1 migrations apply rupeefund-waitlist --remote`.

1. Make one Turnstile widget for `rupeefund.org`. Put its sitekey in `apps/web/src/lib/turnstile.ts`. Set its secret with `pnpm wrangler secret put TURNSTILE_SECRET`.

1. Copy the rows. Give each command its account:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<old> pnpm wrangler d1 export <old-database> --remote --no-schema --table waitlist --output /tmp/waitlist-rows.sql
   CLOUDFLARE_ACCOUNT_ID=<new> pnpm wrangler d1 execute rupeefund-waitlist --remote --file /tmp/waitlist-rows.sql
   ```

   Delete `/tmp/waitlist-rows.sql` after the move. It holds the list.

The move:

1. Disconnect both Workers Builds projects in the old account. Connect each in the new account, with the settings in section 1.
1. In the old account, open **Domain Registration**, then the domain, then **Configuration**, and move it to the new account. Accept the move in the new account.
1. When the zone is active, promote. The deploy makes the custom domain.
1. Repeat sections 10.1 to 10.3 for the admin Worker.
1. Verify with section 6. Look for rows that the old Worker took after the copy, and copy them.
1. Turn on DNSSEC in the new zone.

## 10. The admin panel

The panel needs no secret. Cloudflare Access does the login. The Worker needs one variable, `ACCESS_AUD` in `apps/admin/wrangler.jsonc`: the audience tag of its Access application. The Worker refuses every request whose Access pass carries another tag.

### 10.1 Set up the login method

Go to **Zero Trust** > **Integrations** > **Identity providers**.

Cloudflare adds its own identity provider to a new organisation, and that provider admits **members of your Cloudflare account only**. A volunteer with no account membership cannot sign in with it.

For a list of email addresses, add **One-time PIN** as well. A new organisation does not get it by default. Access then emails a code to any address you name in the policy.

If your mail gateway filters mail, allow `noreply@notify.cloudflare.com`.

### 10.2 Protect the Worker

Go to **Workers & Pages**. Open `rupeefund-admin`. Open the **Access** tab. Put the Worker behind Access. This covers every address the Worker answers on.

Copy the **Application Audience (AUD) Tag** of the new application into `ACCESS_AUD` and into `access.dev.aud` in `apps/admin/wrangler.jsonc`. When you remove and add the application again, the tag changes. Update both values, or the panel refuses every person.

Then add the policy: action **Allow**, rule type **Include**, selector **Emails**, and one row for each team member. Set the session duration. A long session stays signed in on a device that nobody watches.

A person takes a seat at the first sign-in and keeps it until you remove the person. When no seat is free, Access refuses the next person. Read the seat count in the Zero Trust overview before you invite the team.

### 10.3 Prove it

```sh
pnpm live:check
```

The two `admin` lines must say `PASS`. A `FAIL` on either line means Access is not in front of the Worker. Stop and fix the policy before you tell the team.

Then sign in with a browser and read the dashboard. A `{"error":"forbidden"}` page after a good sign-in means `ACCESS_AUD` is wrong. Do the browser sign-in after each deploy that changes `apps/admin/wrangler.jsonc`.

### 10.4 If you ever remove Access

The Worker refuses every request (`docs/ARCHITECTURE.md` section 10.1). This is intentional. A panel that stops is safer than a panel that opens to the public.
