# Deployment

The system runs on the Workers Free plan.

## 1. The branch model

| Branch | Site                  | Worker            | Trigger                                     |
| ------ | --------------------- | ----------------- | ------------------------------------------- |
| `main` | none                  | none              | never                                       |
| `live` | `rupeefund.org`       | `rupeefund-web`   | the maintainer, with the `Promote` workflow |
| `live` | `admin.rupeefund.org` | `rupeefund-admin` | the maintainer, with the `Promote` workflow |
| `live` | `cms.rupeefund.org`   | `rupeefund-cms`   | the maintainer, with the `Promote` workflow |

Each Worker has its own Cloudflare Workers Builds project, and each watches `live`. One promote ships all Workers. Each project uses the repository root as the root directory, because pnpm installs the whole workspace from the root lockfile.

| Worker            | Build command                                    | Deploy command                                        |
| ----------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `rupeefund-web`   | `pnpm turbo run build --filter=@rupeefund/web`   | `pnpm --filter @rupeefund/web exec wrangler deploy`   |
| `rupeefund-admin` | `pnpm turbo run build --filter=@rupeefund/admin` | `pnpm --filter @rupeefund/admin exec wrangler deploy` |
| `rupeefund-cms`   | `pnpm turbo run build --filter=@rupeefund/cms`   | `pnpm --filter @rupeefund/cms exec wrangler deploy`   |

Turn off branch builds for all branches except `live` on each project. Keep them off. `docs/ARCHITECTURE.md` section 3 gives the reason.

Pull requests go to `main`. A merge deploys nothing. Do not run `wrangler deploy` by hand. It uploads whatever `apps/web/dist` holds and skips the build guards. You can run `pnpm wrangler rollback` in an incident, because it ships no new code. For the admin Worker, run `pnpm --filter @rupeefund/admin exec wrangler rollback`. For the content manager, read section 11.7.

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

To go back, run `pnpm wrangler rollback` and `pnpm --filter @rupeefund/admin exec wrangler rollback`. Then purge the zone cache. The next publish in the content manager builds the site again from `live`. For the content manager, read section 11.7. Do not delete the Worker. A deleted Worker loses its custom domain and every earlier deployment.

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

`TURNSTILE_ACTION` has two homes. The Turnstile widget uses the constant in `apps/web/src/lib/turnstile.ts`. The Worker checks the variable in `apps/web/wrangler.jsonc`. The two must match. `pnpm run build` fails when they differ.

The Workers Builds settings hold no variable. One Turnstile widget serves the site, and its domain list holds `rupeefund.org` only. To rotate the sitekey, change the constant in `apps/web/src/lib/turnstile.ts` and promote. Set the secret with:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

A `--remote` command needs the Cloudflare account. Put `CLOUDFLARE_ACCOUNT_ID` in `apps/web/.env`. Wrangler reads that file itself. Without it, wrangler asks which account to use. Do not put the account in `wrangler.jsonc`.

`pnpm dev` and `pnpm preview` carry the always-pass Turnstile test values and `PUBLIC_ALLOW_TEST_SITEKEY=true` themselves. Do not put a Turnstile value in `.env`. If an old `pnpm bootstrap` made `apps/web/.env`, delete its Turnstile lines. Never set that opt-in in the Workers Builds settings. A deployed build with the test sitekey refuses every signup, so `pnpm run build` exits 1 when it finds one.

## 6. How to verify a deployment

Purge the zone cache first. Then:

```sh
pnpm live:check
```

It checks the site, the admin Worker and the CMS Worker, prints one `PASS` or `FAIL` line for each check, and exits 1 on a failure. `apps/web/scripts/live-check.mts` lists the checks.

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

1. Add `rupeefund.org` as a zone in the new account. Copy the DNS records, the redirect rule, Always Use HTTPS and Bot Fight Mode from the old zone. Do not add an apex record. The custom domain makes it.

1. Make the database with `pnpm wrangler d1 create`. Copy the `database_id` into `apps/web/wrangler.jsonc` **and into `apps/admin/wrangler.jsonc`**. Both Workers bind the one database. Apply every migration with `pnpm wrangler d1 migrations apply rupeefund-waitlist --remote`.

1. Make one Turnstile widget for `rupeefund.org`. Put its sitekey in `apps/web/src/lib/turnstile.ts`. Set its secret with `pnpm wrangler secret put TURNSTILE_SECRET`.

1. Copy the rows. Give each command its account:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<old> pnpm wrangler d1 export <old-database> --remote --no-schema --table waitlist --output /tmp/waitlist-rows.sql
   CLOUDFLARE_ACCOUNT_ID=<new> pnpm wrangler d1 execute rupeefund-waitlist --remote --file /tmp/waitlist-rows.sql
   ```

   Delete `/tmp/waitlist-rows.sql` after the move. It holds the list.

1. Make the resources of the content manager (section 11.1). Copy the content database the same way, with `--table` removed. Copy each object of `rupeefund-media` to the new bucket, for example with [rclone](https://developers.cloudflare.com/r2/examples/rclone/). Set `DEPLOY_HOOK_URL` after the move (section 11.3).

The move:

1. Disconnect the three Workers Builds projects in the old account. Connect each in the new account, with the settings in section 1.
1. In the old account, open **Domain Registration**, then the domain, then **Configuration**, and move it to the new account. Accept the move in the new account.
1. When the zone is active, promote. The deploy makes the custom domain.
1. Repeat sections 10.1 to 10.3 for the admin Worker, and section 11.3 for the rebuild.
1. Verify with section 6. Look for rows that the old Worker took after the copy, and copy them.
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

`docs/ARCHITECTURE.md` section 11 tells how the parts work together.

The first promote with the content manager also builds `rupeefund-web`. That build fails, because the content manager has no content yet. The old site stays live. Section 11.4 builds the site again.

### 11.1 Make the resources

R2 must be on for the account. If it is off, go to **R2 Object Storage** in the dashboard and turn it on. Then:

```sh
pnpm --filter @rupeefund/cms exec wrangler d1 create rupeefund-content --location apac
pnpm --filter @rupeefund/cms exec wrangler r2 bucket create rupeefund-media --location apac
pnpm --filter @rupeefund/cms exec wrangler kv namespace create rupeefund-cms-session
```

`apac` keeps the data near the readers, as for `rupeefund-waitlist`. Put the database ID in `d1_databases` and the namespace ID in `kv_namespaces` of `apps/cms/wrangler.jsonc`. Merge that change before the promote in section 11.4. Without the IDs, the deploy makes new, empty resources.

### 11.2 Close the setup to strangers

The content manager signs people in with passkeys. Until it has an admin, any person who opens it can run the setup and become the admin. Put a temporary Access application in front of it for the setup:

1. Go to **Zero Trust** > **Access** > **Applications**.
1. Add a self-hosted application on `cms.rupeefund.org` with the path `/_emdash/*`.
1. Set the login method and the policy as in section 10.2.

Remove this application in section 11.4, after you make the admin.

### 11.3 Connect the rebuild

Open `rupeefund-web` in **Workers & Pages**. Go to **Settings** > **Builds** > **Deploy Hooks**. Add a hook for the branch `live`. Set its URL as a secret:

```sh
pnpm --filter @rupeefund/cms exec wrangler secret put DEPLOY_HOOK_URL
```

The URL starts a build. Keep it secret.

To make the hook with the `cf` CLI, run `cf builds deploy-hooks create rupeefund-web --branch live --deploy-hook-name cms-publish`. The command shows the `deploy_hook_uuid` and not the URL. The URL is `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<deploy_hook_uuid>`, so the ID is also a secret. Run the command in your own terminal, not where others can read the output.

Do this before the first deploy of `rupeefund-cms`. The deploy fails when `DEPLOY_HOOK_URL` is not set. When `rupeefund-cms` does not exist, the command asks to make it. Answer yes. Then the Worker exists with the secret and no code.

### 11.4 Set up the content

1. Open `rupeefund-cms` in **Workers & Pages**. Go to **Settings** > **Builds** > **Connect**. Do not use **Import a repository**, because it makes a new Worker. Select this repository and the branch `live`, and use the settings in section 1. Turn off the builds for the other branches.
1. Promote (section 3).
1. Open `https://cms.rupeefund.org/_emdash/admin`. Access asks you to sign in. Then the setup wizard opens.
1. Tick the sample content. The sample content is the present text of the site.
1. Make your admin account and its passkey.
1. Delete the Access application of section 11.2.

Then run `pnpm live:check`. The five `cms` lines must say `PASS`. Then unpublish one FAQ entry and publish it again in the editor. The Deploy Hook then builds the site from the CMS. Read the build log of `rupeefund-web` to prove it.

If the content manager loses all its people, put the Access application of section 11.2 back before you open it again.

### 11.5 Invite a person

The content manager sends no email. To add a person:

1. Go to **Users** in the content manager and invite the email address of the person. The person gets the Author role (30). Select a different role if necessary.
1. Copy the invite link and send it to the person yourself, with a link to `docs/EDITING.md`.
1. The person opens the link and makes a passkey.

The person signs in with that passkey from then on. Self-signup stays off.

To remove a person, disable the account in **Users**. Until the session of that person ends, the person can still open the stored images (`docs/TODO.md`).

### 11.6 Update EmDash

EmDash changes its database on the first request after the deploy. Renovate opens one pull request for all EmDash packages and does not merge it.

1. Read the release notes of each version in the pull request.
1. Merge the pull request. Write down the time.
1. Promote (section 3).
1. Run `pnpm live:check`. Sign in to the content manager and open an entry.

If the content manager fails, go back (section 11.7) to the time you wrote down.

### 11.7 Go back

- **Wrong words on the site.** Restore the earlier revision of the entry in the editor, and publish it. The site builds again. A rollback of `rupeefund-web` stays only until the next publish.

- **A publish that does not reach the site.** The build of `rupeefund-web` fails, and the last good site stays live. Open `rupeefund-cms` in **Workers & Pages** and go to **Observability**. Find the `published_invalid` event. It gives the problem and its place, such as `posts.3.title` or `Publish the home page`. Correct the entry and publish it again. A `published_load_failed` event tells that the database did not answer. Then publish again later.

- **A broken content manager.** Run `pnpm --filter @rupeefund/cms exec wrangler rollback`. If the bad version changed the database, also restore the database to the time before the deploy:

  ```sh
  pnpm --filter @rupeefund/cms exec wrangler d1 time-travel restore rupeefund-content --timestamp=<time>
  ```

  Time Travel keeps 7 days on the Workers Free plan ([Cloudflare documentation](https://developers.cloudflare.com/d1/reference/time-travel/)). The restore removes each edit after that time.

### 11.8 Change a content field

`apps/cms/seed/seed.json` applies only at the first setup. On the live content manager, an admin adds or removes a field in the content manager itself. The site shows only the fields and the collections that its code reads. A new field or collection does not show until the code reads it. `docs/ARCHITECTURE.md` section 11.6 names the code that changes with a field.

Keep this order, or each build of `rupeefund-web` fails until the content agrees with the code:

- **To add a field.** Add the field in the live content manager, and fill it in each entry. Then promote the code that reads it.
- **To remove a field.** Promote the code that stops reading it. Then remove the field in the live content manager.
