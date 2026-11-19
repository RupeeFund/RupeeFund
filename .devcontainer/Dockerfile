FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1
LABEL org.opencontainers.image.source=https://github.com/RupeeFund/RupeeFund
ENV LANG=C.UTF-8
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gnupg less openssh-client procps sudo \
 && rm -rf /var/lib/apt/lists/* \
 && echo 'node ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/node \
 && npm install -g pnpm@12.21.0 \
 && npm cache clean --force
USER node
