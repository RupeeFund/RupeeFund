FROM node:26-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68
LABEL org.opencontainers.image.source=https://github.com/RupeeFund/RupeeFund
ENV LANG=C.UTF-8
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gnupg less openssh-client procps sudo \
 && rm -rf /var/lib/apt/lists/* \
 && echo 'node ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/node \
 && npm install -g pnpm@12.18.0 \
 && npm cache clean --force
USER node
