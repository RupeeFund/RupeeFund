# To do

This list holds the work that we know about and did not do yet. Each item tells what to do, why, and the condition that makes it urgent. Remove an item when its work merges.

## Show the blog

The site builds the blog but hides it. The footer has no Blog link, the pages have no feed link, the sitemap leaves out `/blog`, and each blog page has `noindex`. To show the blog, revert the commit `feat(web): hide the blog until launch`.

Urgent when: the blog has a few posts.

## GitHub sign-in for the admin panel

The admin panel admits the members of the Cloudflare account (`docs/DEPLOY.md` section 10). So each person who reads the list also gets a role in the Cloudflare dashboard. One GitHub team must admit the panel users in its place.

To do:

1. Make a GitHub OAuth App in the organization that holds the team. Its callback URL is `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`.
1. Add GitHub as an identity provider in Zero Trust, with the client ID and the secret of the OAuth App.
1. In the Access application of `rupeefund-admin`, set GitHub as the only login method. Add a policy that includes the GitHub organization and the team.
1. Update `docs/DEPLOY.md` section 10.

Urgent when: a person who must not open the Cloudflare dashboard needs the panel.

## Email sign-in for the content manager

Today a person joins the content manager only through an invite. An admin copies the invite link and sends it by hand. The person then signs in with a passkey.

EmDash can also sign a person in with a link by email, and it can send the invite itself. Both need an email provider: an EmDash email plugin and a service that sends the mail. Without one, EmDash refuses the email sign-in.

To do:

1. Select a service that sends mail from a Worker.
1. Add the EmDash email plugin for that service to `apps/web`.
1. Turn on the email sign-in. Keep self-signup off, so only an invited person gets an account.
1. Add the sender address and the secret to `docs/DEPLOY.md` section 11.

Urgent when: guests write for the blog often, or a guest cannot use a passkey.

## Check an entry before it publishes

A publish can succeed in the content manager while the site refuses the entry, for example on a source link that is not `https:`. The site then leaves the entry out, and only the log of `rupeefund-web` shows the reason (`docs/DEPLOY.md` section 11.4). A refused landing page takes the home page down. Extend `publishGate` in `apps/web/src/plugin/hooks.ts`. Make it check the entry against `apps/web/src/content/schema.ts` and refuse the publish with the schema message.

Urgent when: a publish takes a page off the site.

## Preview the entries without an address

The landing page, the FAQ, the people page and the community team have no `urlPattern` in `apps/web/seed/seed.json`. So **Preview** opens `/<collection>/<id>`, a page that does not exist. Give each one the address of the page that shows it, for example `/` for the landing page.

Urgent when: an editor needs a preview before a publish.

## Keep drafts out of the feed and the sitemap

In the edit mode, EmDash puts the draft text over each published entry. `/blog/rss.xml` and `/sitemap.xml` then show that draft text to the editor.

Urgent when: an editor shares a feed or a sitemap from a browser in the edit mode.

## Make the first admin of a new content database

The live site refuses the setup wizard (`apps/web/src/lib/edge.ts`). The wizard fills a new database from the seed, with its content. With GitHub sign-in, the first person who signs in becomes the admin. So let a signed-in member of the admin team through to the wizard.

Urgent when: now. The content manager moves into the site Worker with a new, empty database.
