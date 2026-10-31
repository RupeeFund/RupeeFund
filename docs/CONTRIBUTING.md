# Contributing

Thank you for your help. The site collects a mailing list only. Do not add a way to pay or to vote.

## Discussions, Issues and pull requests

- Public [Discussions](https://github.com/RupeeFund/RupeeFund/discussions): questions and ideas about The Rupee Fund.
- Public [Issues](https://github.com/RupeeFund/RupeeFund/issues/new/choose): bugs in the site and changes to it. Choose the form that fits.
- Pull requests: [Make a change](#make-a-change).
- Your own data, or to leave the list: the address on the [support page](https://github.com/RupeeFund/.github/blob/main/SUPPORT.md).
- A security problem: the [security policy](https://github.com/RupeeFund/.github/blob/main/SECURITY.md), not in public.

All work follows the [Code of Conduct](https://github.com/RupeeFund/.github/blob/main/CODE_OF_CONDUCT.md).

## Set up

You need Node 26 or later and [pnpm](https://pnpm.io/installation), but no Cloudflare account.

```sh
pnpm install
pnpm db:reset   # once before your first pnpm dev: fill the local databases with sample data
pnpm dev
```

| Command          | Address                 | Serves                                                         |
| ---------------- | ----------------------- | -------------------------------------------------------------- |
| `pnpm dev`       | `http://localhost:8787` | The site and the content manager                               |
| `pnpm dev:admin` | `http://localhost:8788` | The admin panel, in a second terminal                          |
| `pnpm preview`   | `http://localhost:8789` | The live build. It needs a secret (`docs/DEPLOY.md` section 6) |

- To sign in to the content manager as an admin, with no GitHub account, open `http://localhost:8787/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
- When pnpm tells you to run `pnpm install`, run it.
- `pnpm db:reset` erases your local data. Stop each server first. It refuses while `pnpm dev` or `pnpm preview` runs from this checkout, but it cannot see `pnpm dev:portless` or a server in another folder.
- For more than one checkout at a time, run `pnpm dev:portless`. Its first run after each boot asks for your password.

### In Codespaces or a dev container

1. Click **Open in GitHub Codespaces** in the [README](../README.md), or open a dev container.
1. When the terminal shows the welcome text, run `pnpm dev`. A codespace opens the site in a new tab. To open it again, use port 8787 in the **Ports** tab.
1. To sign in, add `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin` to that address.

`pnpm dev:portless` does not work in a container.

## Make a change

1. Find an open issue. For a new idea, open an issue before you write code.
1. Fork the repository and make a branch.
1. Make your change. Run [the gate](#the-gate).
1. Commit with a [Conventional Commits](https://www.conventionalcommits.org) subject, for example `fix: correct the footer link`.
1. Open a pull request against `main`. Say what changed and how you tested it. A maintainer reviews it. A merge does not deploy anything.

Do not commit a secret, a password or a personal email list.

## The gate

Each change must pass these commands before you open a pull request. The browser tests need Chromium once: `pnpm --filter @rupeefund/web exec playwright install --with-deps chromium`.

```sh
pnpm format
pnpm check       # types, lint and tests
pnpm test:e2e    # browser tests
```

CI runs more steps on each pull request (`.github/workflows/ci.yml`). To run the Lighthouse budgets locally: `pnpm --filter @rupeefund/web test:lighthouse`.

## Read next

The [documentation index](README.md) names the document that owns your change.
