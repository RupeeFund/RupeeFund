# Deployment

The system runs on the Workers Free plan.

## 1. The branch model

| Branch | Site            | Worker          | Trigger                 |
| ------ | --------------- | --------------- | ----------------------- |
| `main` | none            | none            | never                   |
| `live` | `rupeefund.org` | `rupeefund-web` | the maintainer, by hand |

Cloudflare Workers Builds watches `live`. Its build command is `pnpm run build`, its deploy command is `npx wrangler deploy`, and non-production branch builds are off. Leave them off. Every branch build would keep the production bindings.

Pull requests go to `main`. A merge deploys nothing. Do not run `wrangler deploy` by hand. It uploads whatever `dist` holds and skips the build guards. `pnpm wrangler rollback` is fine in an incident, because it ships no new code.

## 2. How to prove a change

You prove every change on your own machine. No test reaches the live database.

Run the gate in `docs/CONTRIBUTING.md`. `pnpm dev` and the gate use the always-pass Turnstile test pair, so the form completes with no real widget. Read the local rows:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --local --command "SELECT email, consent_at FROM waitlist"
```

## 3. How to promote

Make sure CI passed on the commit. Then fast-forward `live`:

```sh
git fetch origin
git push origin <sha>:live
```

Use `main` as `<sha>` to take the tip of `main`. Do not force the push. `live` is always a prefix of `main`, so a promote takes a commit and everything before it. Promote often.

To go back, run `pnpm wrangler rollback`, then purge the zone cache. Do not delete the Worker. A deleted Worker loses its custom domain and every earlier deployment.

## 4. How to apply a migration

The deployment applies no migration. You apply each one by hand, in this order:

1. Export the live database.
1. Apply the migration to the live database.
1. Fast-forward `live`.

```sh
pnpm wrangler d1 export rupeefund-waitlist --remote --output /tmp/rupeefund-waitlist-backup.sql &&
  pnpm wrangler d1 migrations apply rupeefund-waitlist --remote
```

Keep the `&&`. It stops the apply when the export fails.

**Make each migration additive.** During a promote two Worker versions read the one live database. Add a column with a default or with NULL permitted. A change that removes a column needs two promotes: one that stops the code from reading it, and a later one that drops it.

Never edit a migration that has run. Never reuse a file name. Wrangler matches a migration by file name only. A changed file that has run does nothing. A reused file name runs nothing and reports no error. `tests/migrations/replay.test.ts` refuses the retired names. `wrangler d1 migrations list` proves only that the names agree. To check the schema, query the tables:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## 5. Secrets and variables

| Kind               | Home                       | Key                                       |
| ------------------ | -------------------------- | ----------------------------------------- |
| Public build value | `src/lib/turnstile.ts`     | the Turnstile sitekey                     |
| Worker secret      | `wrangler secret`          | `TURNSTILE_SECRET`                        |
| Worker variable    | `vars` in `wrangler.jsonc` | `TURNSTILE_HOSTNAMES`, `TURNSTILE_ACTION` |

The Workers Builds settings hold no variable. One Turnstile widget serves the site, and its domain list holds `rupeefund.org` only. To rotate the sitekey, change the constant in `src/lib/turnstile.ts` and promote. Set the secret with:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

A `--remote` command needs the Cloudflare account. Put `CLOUDFLARE_ACCOUNT_ID` in `.env`. Wrangler reads `.env` itself, and a value set on the command line wins over it. Without it, wrangler asks which account to use. Do not put the account in `wrangler.jsonc`.

For local work, `.env` holds the always-pass test values. Make it with `cp .env.example .env`. `astro build` and `wrangler dev` read it, and direnv loads it into your shell through `.envrc`. Do not also make a `.dev.vars` file, or wrangler ignores `.env`. The `preview` script carries the same values itself, for Playwright in CI, where no `.env` exists.

`.env.example` and `preview` set `PUBLIC_ALLOW_TEST_SITEKEY=true` beside the test sitekey. Never set that opt-in in the Workers Builds settings. A deployed build with the test sitekey refuses every signup, and `pnpm run build` exits 1 before and after `astro build` when it finds one. For this reason, `pnpm run build` fails while `.env` exists. Rename `.env` before you run the deploy build on your machine. `tests/deploy/sitekey-literal.test.ts` refuses a script or an `.env.example` that names the test sitekey without the opt-in.

## 6. How to verify a deployment

Purge the zone cache first. Then:

```sh
curl -s https://rupeefund.org/api/health                       # {"ok":true}
curl -s https://rupeefund.org/subscribe | grep -o 'data-sitekey="[^"]*"'
curl -sI https://rupeefund.org/ | grep -i -e content-security-policy -e strict-transport
```

The sitekey must not be `1x00000000000000000000AA`. Complete the form one time, then read the row:

```sh
pnpm wrangler d1 execute rupeefund-waitlist --remote --command "SELECT email, consent_at FROM waitlist"
```

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

The first line of the file is `email,name,attributes`. The `attributes` column is JSON with `source`, `consent_at`, `signed_up_at`, and `updates_opt_in`. The amount, the months, the question, and the three audience roles stay in the database.

The export is incremental. Each row goes out one time. A row that an operator edits by hand after its export does not go out again. The command needs Node 24 or later, and wrangler login for `--remote`.

## 9. How to move to a different account

The domain uses Cloudflare Registrar. A move to a different Cloudflare account takes only the registration. You make the zone, the Worker, the database and the Turnstile widget again in the new account.

A Worker custom domain needs an active zone, and the zone becomes active only after the registration moves. So the site is down from the move until the first deploy in the new account. After the move, the domain cannot move again for 30 days.

Before the move:

1. Turn off DNSSEC on the old zone. Wait until `dig +short DS rupeefund.org @a0.org.afilias-nst.info` returns nothing.
1. Add `rupeefund.org` to the new account on a plan. Copy the DNS records, the redirect rule, Always Use HTTPS and Bot Fight Mode from the old zone. Do not add an apex record. The custom domain makes it.
1. Make the database with `pnpm wrangler d1 create`. Copy the `database_id` into `wrangler.jsonc`. Apply every migration with `pnpm wrangler d1 migrations apply rupeefund-waitlist --remote`.
1. Make one Turnstile widget for `rupeefund.org`. Put its sitekey in `src/lib/turnstile.ts`. Set its secret with `pnpm wrangler secret put TURNSTILE_SECRET`.
1. Copy the rows. Give each command its account:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<old> pnpm wrangler d1 export <old-database> --remote --no-schema --table waitlist --output /tmp/waitlist-rows.sql
   CLOUDFLARE_ACCOUNT_ID=<new> pnpm wrangler d1 execute rupeefund-waitlist --remote --file /tmp/waitlist-rows.sql
   ```

   Delete `/tmp/waitlist-rows.sql` after the move. It holds the list.

The move:

1. Disconnect Workers Builds in the old account. Connect it in the new account, with the settings in section 1.
1. In the old account, open **Domain Registration**, then the domain, then **Configuration**, and move it to the new account. Accept the move in the new account.
1. When the zone is active, promote. The deploy makes the custom domain.
1. Verify with section 6. Look for rows that the old Worker took after the copy, and copy them.
1. Turn on DNSSEC in the new zone.
