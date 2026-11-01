FROM node:26-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9
LABEL org.opencontainers.image.source=https://github.com/RupeeFund/RupeeFund
ENV LANG=C.UTF-8
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gnupg less openssh-client procps sudo \
 && rm -rf /var/lib/apt/lists/* \
 && echo 'node ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/node \
 && npm install -g pnpm@12.16.1 \
 && npm cache clean --force
USER node
