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

```sh
pnpm install
pnpm db:reset   # make the local databases and fill them with sample content and made-up rows
pnpm dev        # serve the site and the content manager
```

Run `pnpm db:reset` before your first `pnpm dev`. Without it, the local content database is empty.

The terminal shows the address of the site, `http://localhost:8787`. When you save a file, the browser reloads. If the build fails, the terminal shows the error and the site stays as it was.

To sign in to the content manager, open `http://localhost:8787/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`. This page signs you in as an admin. You need no GitHub account and no key. The site shows each publish at the next page load.

| Command          | Address                 | What it serves                                                                     |
| ---------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`       | `http://localhost:8787` | The site and the content manager.                                                  |
| `pnpm dev:admin` | `http://localhost:8788` | The admin panel. Run it in a second terminal.                                      |
| `pnpm preview`   | `http://localhost:8789` | The site as the live build. Its GitHub sign-in needs the secret of the GitHub App. |

- When pnpm tells you to run `pnpm install`, run it.
- `pnpm db:reset` erases your local data. Run it again for a clean start. Stop `pnpm dev` and `pnpm preview` first, or it refuses. It cannot see `pnpm dev:portless`, so stop that yourself.
- To run more than one checkout at a time, run `pnpm dev:portless`. It starts both apps and gives each a name in place of a port. The first run after each boot asks for your password.

### In Codespaces or a dev container

Click **Open in GitHub Codespaces** in the [README](../README.md), or open the repository in a dev container. Wait until the terminal shows the welcome text. Then run `pnpm dev`. In a codespace, the site opens in a new browser tab. To open it again, use the **Ports** tab, port 8787. To sign in to the content manager, add `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin` to that address. `pnpm dev:portless` does not work in a container.

## Make a change

1. Look for an open issue. For a new idea, open an issue before you write code.
1. Fork the repository and make a branch.
1. Make your change. Then run [the gate](#the-gate).
1. Commit with a [Conventional Commits](https://www.conventionalcommits.org) subject, for example `fix: correct the footer link`.
1. Open a pull request against `main`. Say what changed and how you tested it.
1. A maintainer reviews it. A merge does not deploy anything.

Do not commit a secret, a password or a personal email list.

## The gate

The gate is the set of checks that each change must pass. It is the three commands below. Run them before you open a pull request. The browser tests need Chromium one time: `pnpm --filter @rupeefund/web exec playwright install --with-deps chromium`.

```sh
pnpm format      # format the files
pnpm check       # types, lint and tests
pnpm test:e2e    # browser tests
```

CI runs these checks on each pull request. It also runs `pnpm audit --prod`, the production build and a word check. `.github/workflows/ci.yml` lists the steps.

## Read next

The [documentation index](README.md) names the document that owns your change.
