# To do

This list holds the work that we know about and did not do yet. Each item tells what to do, why, and the condition that makes it urgent. Remove an item when its work merges.

## GitHub sign-in for the admin panel

The admin panel admits the members of the Cloudflare account (`docs/DEPLOY.md` section 10). So each person who reads the list also gets a role in the Cloudflare dashboard. One GitHub team must admit the panel users in its place.

To do:

1. Make a GitHub OAuth App in the organization that holds the team. Its callback URL is `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`.
1. Add GitHub as an identity provider in Zero Trust, with the client ID and the secret of the OAuth App.
1. In the Access application of `rupeefund-admin`, set GitHub as the only login method. Add a policy that includes the GitHub organization and the team.
1. Update `docs/DEPLOY.md` section 10.

Urgent when: a person who must not open the Cloudflare dashboard needs the panel.

## Check an entry before it publishes

A publish can succeed in the content manager while the site refuses the entry, for example on a source link that is not `https:`. The site then leaves the entry out, and only the log of `rupeefund-web` shows the reason (`docs/DEPLOY.md` section 11.4). A refused legal page then answers 404. Extend `publishGate` in `apps/web/src/plugin/hooks.ts`. Make it check the entry against `apps/web/src/content/schema.ts` and refuse the publish with the schema message.

Urgent when: a publish takes a page off the site.

## The seed ignores the post dates

`emdash seed` 1.2.0 accepts `publishedAt` and `updatedAt` on an entry, but it writes the seed time to both columns. So `apps/web/scripts/seed-local.mjs` sets the dates of the local posts with SQL after the seed. The cause is in `packages/core/src/seed/apply.ts` of EmDash. No upstream issue exists. The repro is in `.scratchpad/upstream/emdash-seed-dates.md`.

To do: when an EmDash release writes the seed dates, remove the SQL step and its workaround comment.

Urgent when: an EmDash upgrade changes the `ec_posts` columns, or a test needs a seeded date.

## The component tests do not load the Astro config

`apps/web/vitest.components.config.ts` calls `getViteConfig` with `configFile: false`. With the Cloudflare adapter, Vitest 5 fails with `There is already a server associated with the config.` (cloudflare/workers-sdk#15969, open). The analysis is in `.scratchpad/upstream/astro-vitest.md`.

To do: when a `@cloudflare/vite-plugin` release closes the issue, remove `configFile: false` and run the component tests.

Urgent when: a component test needs a setting from `astro.config.mjs`.

## A publish fails on the local preview

The local runtime of Wrangler has no `cache.purge` (cloudflare/workers-sdk#15183). The page cache of section 11.1 of `docs/ARCHITECTURE.md` makes each publish call it. So under `pnpm preview`, a publish, an unpublish or a delete answers 500 with `cache.purge is not a function`. Under `pnpm dev`, Astro turns the cache off, and a publish works. The deployed site has `cache.purge`.

To do: when a Wrangler release closes the issue, add a publish to `ALLOWED_WRITES` in `apps/web/tests/site/routes.ts`.

Urgent when: a test or a person must publish on the local preview.

## Ask each person on the list to confirm

The site does not confirm an email address. The subscribe page, the sign-up card and the privacy page promise a welcome email to each person who signs up. When the list reaches 100 people, send the welcome email to each person on it. Include each person who did not ask for monthly updates. The email asks each person to confirm. A confirmed person gets early access to the private community. A person who does not confirm gets no other email before the fund opens.

To do:

1. Add a `confirmed_at` column to the list, in a migration.
1. Make a signed confirm link and a route that sets `confirmed_at`.
1. Let the person pick monthly updates or only the email when the fund opens.
1. Send the welcome email to each person on the list, then send it to each new person when they sign up.
1. Add the community invite to the confirm page.

Urgent when: the list holds 100 people.

## The blog loads slowly

On 2026-10-11, Lighthouse measured the largest image of `/blog` at 3.7 s (LCP). The page loaded 610 KB of images. Serve smaller images, for example with `srcset` and a width limit on each post image.

Urgent when: the Lighthouse budget in CI fails on `/blog`.

## The page cache and the private routes

`cache.enabled` in `apps/web/wrangler.jsonc` adds a cache lookup to each request, also to `/_emdash`, `/auth` and `/api`, which the cache never keeps. Find out if the lookup adds time. If it does, skip those routes.

Urgent when: a request to the content manager or the API becomes slow.

## Test the cache when a page fails

`docs/ARCHITECTURE.md` section 11.1 says that the edge does not keep a page that fails to render or a page with a failed blog check. Only manual probes cover these two cases. Add a site test for each.

Urgent when: a change touches `src/lib/cache.ts` or `blogOpen`.

## A byline change purges nothing

A change to a byline in the content manager purges no page (`docs/ARCHITECTURE.md` section 11.1). A new author name shows only after the cache expires, within 1 hour. Purge the `posts` tag when a byline changes.

Urgent when: an author name must change on the site at once.
