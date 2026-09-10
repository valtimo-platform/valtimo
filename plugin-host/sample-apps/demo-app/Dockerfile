# Dev-only image for the reference Valtimo App. It exists so `bootRunWithDocker` can bring up a
# working `kind: APP` integration next to the plugin host; it is deliberately **not** published —
# this is sample code, not a product artifact.
#
# Build context is `plugin-host/`, not this directory: the app builds its browser bundles with
# `@valtimo/plugin-sdk/toolchain`, a `file:../../plugin-sdk` dependency that must be built first.
#
#   docker build -f sample-apps/demo-app/Dockerfile -t valtimo/demo-app .     (from plugin-host/)

FROM node:22-alpine AS builder
WORKDIR /build

COPY plugin-sdk/package.json plugin-sdk/package-lock.json ./plugin-sdk/
RUN npm --prefix plugin-sdk ci
COPY plugin-sdk/ ./plugin-sdk/
RUN npm --prefix plugin-sdk run build

COPY sample-apps/demo-app/package.json sample-apps/demo-app/package-lock.json ./sample-apps/demo-app/
RUN npm --prefix sample-apps/demo-app ci
COPY sample-apps/demo-app/ ./sample-apps/demo-app/
# Compiles the server (dist/) and the iframe bundles the app serves (public/).
RUN npm --prefix sample-apps/demo-app run build
# Drop the build toolchain — including the linked SDK, which is a devDependency: the app's *server*
# has no runtime coupling to it (only the browser bundles import it, and those are already built).
# Pruning here rather than reinstalling in the runtime stage keeps the tree that actually compiled.
RUN npm --prefix sample-apps/demo-app prune --omit=dev


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /build/sample-apps/demo-app/package.json ./package.json
COPY --from=builder /build/sample-apps/demo-app/node_modules ./node_modules
COPY --from=builder /build/sample-apps/demo-app/dist ./dist
COPY --from=builder /build/sample-apps/demo-app/public ./public
# Served as the app's plugin logo, referenced by manifest.logo.
COPY sample-apps/demo-app/logo.svg ./logo.svg

EXPOSE 8095

CMD ["node", "dist/index.js"]
