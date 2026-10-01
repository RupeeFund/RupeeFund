# Contributing

Thank you for your help. This guide tells you where to talk, how to set up the repository, and how to open a pull request.

The site collects a mailing list only. Do not add a way to pay or to vote.

## Discussions, Issues and pull requests

- **Discussions.** Use [Discussions](https://github.com/RupeeFund/RupeeFund/discussions) to talk about The Rupee Fund itself. Ask a question or share an idea.
- **Issues.** Use [Issues](https://github.com/RupeeFund/RupeeFund/issues/new/choose) for the site itself. Report a bug or suggest a change. Choose the form that fits.
- **Pull requests.** Use a pull request to change the code or the documents. The steps are in [Make a change](#make-a-change).

Discussions and Issues are public. To ask about your own data or to leave the mailing list, write to the team. The [support page](https://github.com/RupeeFund/.github/blob/main/SUPPORT.md) has the address. Do not report a security problem in public. Read the [security policy](https://github.com/RupeeFund/.github/blob/main/SECURITY.md).

All work follows the [Code of Conduct](https://github.com/RupeeFund/.github/blob/main/CODE_OF_CONDUCT.md).

## Set up

You need Node 24 or later and [pnpm](https://pnpm.io/installation). You need no Cloudflare account.

The repository holds two apps: the site in `apps/web` and the admin panel in `apps/admin`. They use one local database.

### On your machine

```sh
pnpm install
pnpm bootstrap
pnpm --filter @rupeefund/web exec playwright install chromium   # for the browser tests
pnpm dev
```

`pnpm bootstrap` makes `apps/web/.env`, resets the local database and fills it with made-up rows. `pnpm dev` serves the site on `http://localhost:8787`. To work on the admin panel, run `pnpm dev:admin` in a second terminal. It serves the panel on `http://localhost:8788`.

To run more than one checkout at a time, run `pnpm dev:portless`. It starts the site and the admin panel in one terminal. Each app gets a name in place of a port, and the terminal shows its address. The first run after each boot asks for your password, because the names use port 443.

### In a dev container

Open the repository in a dev container. In Visual Studio Code, run the command Dev Containers: Reopen in Container. The container installs the dependencies and Chromium, then runs `pnpm bootstrap`. Then run `pnpm dev`, and `pnpm dev:admin` in a second terminal. The container forwards ports 8787 and 8788. `pnpm dev:portless` does not work in the container.

### In GitHub Codespaces

Create a codespace from the repository page. A codespace uses the same dev container. Then run `pnpm dev`.

## Make a change

1. Look for an open issue. For a new idea, open an issue before you write code.
1. Fork the repository and make a branch.
1. Make your change. Then run [the gate](#the-gate).
1. Commit with a [Conventional Commits](https://www.conventionalcommits.org) subject, for example `fix: correct the footer link`.
1. Open a pull request against `main`. Say what changed and how you tested it.
1. A maintainer reviews it. A merge does not deploy anything.

Do not commit a secret, a password or a personal email list.

## The gate

The gate is the set of checks that each change must pass. It is the three commands below. Run them before you open a pull request. CI runs them again.

```sh
pnpm format      # format the files
pnpm check       # types, lint and tests
pnpm test:e2e    # browser tests
```

## Read next

- Read [DESIGN.md](DESIGN.md) before you change a page, a style or a word.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) before you change a Worker, the database, the security headers or the admin panel.
- Read [DEPLOY.md](DEPLOY.md) before you write a migration. It also tells how a change reaches the site.
