# To do

This list holds the work that we know about and did not do yet. Each item tells what to do, why, and the condition that makes it urgent. Remove an item when its work merges.

## Show the blog

The site builds the blog but hides it. The `/blog` entry in `apps/web/src/lib/seo.ts` has `indexable: false`. So each blog page has `noindex`, and the sitemap and the feed links leave out the blog. To show the blog, set `indexable: true` on that entry, update the tests in `apps/web/tests/site/`, and add a Blog link to the **Footer** menu in the content manager.

Urgent when: the blog has a few posts.

## GitHub sign-in for the admin panel

The admin panel admits the members of the Cloudflare account (`docs/DEPLOY.md` section 10). So each person who reads the list also gets a role in the Cloudflare dashboard. One GitHub team must admit the panel users in its place.

To do:

1. Make a GitHub OAuth App in the organization that holds the team. Its callback URL is `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`.
1. Add GitHub as an identity provider in Zero Trust, with the client ID and the secret of the OAuth App.
1. In the Access application of `rupeefund-admin`, set GitHub as the only login method. Add a policy that includes the GitHub organization and the team.
1. Update `docs/DEPLOY.md` section 10.

Urgent when: a person who must not open the Cloudflare dashboard needs the panel.

## Check an entry before it publishes

A publish can succeed in the content manager while the site refuses the entry, for example on a source link that is not `https:`. The site then leaves the entry out, and only the log of `rupeefund-web` shows the reason (`docs/DEPLOY.md` section 11.4). A refused people page takes `/people` down. Extend `publishGate` in `apps/web/src/plugin/hooks.ts`. Make it check the entry against `apps/web/src/content/schema.ts` and refuse the publish with the schema message.

Urgent when: a publish takes a page off the site.
