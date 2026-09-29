# Contributing

Read this file before each change. Then read the doc that owns your change:

- **The Worker, the database or the security headers:** [architecture.md](architecture.md).
- **A promote, a migration, a secret, an export or a removal:** [deploy.md](deploy.md).
- **How a page looks or reads:** the brand guidelines at [brand.rupeefund.org](https://brand.rupeefund.org) (source: `src/pages/index.astro` in `RupeeFund/brand`), then [Design](#design) below.

The site collects a mailing list only. Do not add a way to pay or to vote.

## How to set up

```sh
pnpm install
cp .env.example .env
direnv allow
pnpm db:reset
pnpm dev
```

`pnpm dev` builds the site and serves it with the Worker and the local database on `http://localhost:8787`. It does not reload on an edit. Stop it and run it again. `direnv allow` needs [direnv](https://direnv.net). `pnpm dev` works without it.

## The gate

Run these before you open a pull request. CI runs them again.

```sh
pnpm format       # oxfmt, then Prettier for .astro
pnpm check        # Worker types, typecheck, lint, astro check, vitest
pnpm test:e2e     # Playwright against the local build
```

`pnpm check` makes the Worker types before the typecheck. On a fresh checkout, run it, not `tsc`.

The `site` vitest project builds the whole site first. A change to one page can fail a test that does not name that page.

CI also runs `pnpm run build`, the same command Workers Builds runs on `live`. That build refuses the Turnstile test sitekey and an open preview setting. Keep `scripts/build.mjs` running those guards. While `.env` exists, the build fails on your machine. [deploy.md](deploy.md) section 5 tells why.

Do not make a rule less strict to pass the gate. If a rule is wrong for this repository, turn it off in `.oxlintrc.json` with a comment that says why.

## How to deliver a change

1. Make a branch.
1. Run the gate. Then commit your work.
1. Open a pull request against `main`.
1. Get a review. Then merge.

To learn how a merge reaches the site, read [deploy.md](deploy.md) section 1.

A change to the database needs a new migration file. Read [deploy.md](deploy.md) section 4 before you write one. Its rules protect the live database.

## Conventions

- **TypeScript strict.** Write an explicit return type on each exported function. Use `unknown` with a type guard, not `any`.
- **No comments that repeat the code.** The names and the types show the contract.
- **Tests stay with the module.** Put `*.test.ts` next to the module. Pass times and ids as parameters, so a test can supply them.
- **Conventional Commits.** Subject line only. The [organisation guide](https://github.com/RupeeFund/.github/blob/main/CONTRIBUTING.md) owns the rule.
- **Secrets.** Never commit a secret. Git ignores `.env` and `.dev.vars`.
- **Scripts.** pnpm runs the `package.json` scripts in its shell emulator (`shellEmulator` in `pnpm-workspace.yaml`), not in a real shell. The emulator accepts an env prefix, `&&`, `||`, `|`, a redirect and `$(...)`. It rejects `if`, `for` and `case`. The same applies to the install script of a dependency in `allowBuilds`.
- **Brand files.** `pnpm brand:sync` writes them. [architecture.md](architecture.md) section 9 lists them and tells how to update them.

## Pages and endpoints

To add a page, write a `.astro` file in `src/pages/` and add an entry to `src/lib/seo.ts`. The build fails without one. To rename a page, add a `302` line from the old path to `public/_redirects`. The page must work with no JavaScript. Put page behaviour in `src/scripts/<page>.ts` with a test beside it.

To add an endpoint, write a handler in `src/worker/routes/` and connect it in `src/worker/index.ts`. Keep it under `/api/`. [architecture.md](architecture.md) section 2 tells why.

## Design

The brand guidelines are the source of truth for the look: colours, type, links, buttons, forms, cards, icons, motion and words. Read each rule there. This file adds no design rule. The list below tells how the code builds the rules.

- Change the look only for a defect, a brand rule or a request from the maintainer.
- When the site needs a rule that the brand guidelines do not have, or must depart from one, change the guidelines in `RupeeFund/brand` in the same piece of work. Then build it here.
- Page layout is not a brand rule. The page files in `src/pages/` and the frames in `src/layouts/` hold it.
- `src/index.css` builds the brand rules that the brand files do not hold: the type scale and the classes for links, buttons, cards and forms. Reuse a class before you add one. Put a new class in that file.
- `text-sm` is the body size, 17 px. The theme in `src/index.css` changes the Tailwind scale.
- A button is `btn` with `btn-primary` or `btn-quiet`, the Primary and Quiet buttons of the brand. Add `btn-on-white` to a quiet button on a white surface. Give it a size with a modifier from `src/index.css`, not with utilities in the markup.
- Style a UI state from an attribute, for example `aria-pressed`. Do not set classes from JavaScript.
- The season accents are in `SEASONS` in `src/lib/launch.ts`. `src/lib/launch.test.ts` keeps white text on each accent at 4.5:1.
- Check each visual change in a browser at 360 × 640 and 1440 × 900, with and without reduced motion.
