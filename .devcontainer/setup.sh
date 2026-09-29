#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$HOME/.local/bin"
corepack enable --install-directory "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
pnpm install --frozen-lockfile
[ -f .env ] || cp .env.example .env
pnpm db:reset
pnpm exec playwright install --with-deps chromium
