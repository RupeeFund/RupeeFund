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

1. Select a service that sends mail from a Worker on the Workers Free plan.
1. Add the EmDash email plugin for that service to `apps/cms`.
1. Turn on the email sign-in. Keep self-signup off, so only an invited person gets an account.
1. Add the sender address and the secret to `docs/DEPLOY.md` section 11.

Urgent when: guests write for the blog often, or a guest cannot use a passkey.

## Check an entry before it publishes

A publish can succeed in the content manager while the site build fails, for example on a source link that is not `https:`. Only the log of `rupeefund-cms` shows the reason, as the `published_invalid` event. Add a `content:beforePublish` rule to `apps/cms/src/plugin.ts` that builds the document with the entry and refuses the publish with the schema message.

Urgent when: a publish breaks a site build.

## Move the season icons to the shared package

`apps/web/public/seasons/` and `apps/cms/public/seasons/` hold the same four files. Move them to `packages/ui` and use one copy.

Urgent when: a season icon changes.

## Refuse a disabled person at the stored files

`apps/cms/src/session-gate.ts` lets any live session open the stored files and `/_image`. It does not read the user record, so a disabled person can open the stored images until the session ends. Read the user by the session ID and refuse a disabled account, as EmDash does for its own routes.

Urgent when: an admin disables a person who had access to drafts.
