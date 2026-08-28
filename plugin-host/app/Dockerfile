# Build context is `plugin-host/`, not `plugin-host/app/`: the app depends on the SDK through a
# `file:../plugin-sdk` dependency, so the SDK has to be inside the context and built first.
#
#   docker build -f app/Dockerfile -t valtimo/plugin-host .        (from plugin-host/)
#
# The image compiles itself — no local `npm run build` is required, so it builds from a clean
# checkout. It ships **no** plugins: /data/preinstalled is empty, and an operator supplies the
# packages this host should serve by baking them in or mounting a directory over it (see
# PLUGIN_PREINSTALL_DIR in app/README.md).

FROM node:22-alpine AS builder
WORKDIR /build

# SDK first, manifests before sources so a dependency-only change reuses the install layer.
COPY plugin-sdk/package.json plugin-sdk/package-lock.json ./plugin-sdk/
RUN npm --prefix plugin-sdk ci
COPY plugin-sdk/ ./plugin-sdk/
RUN npm --prefix plugin-sdk run build

# `file:../plugin-sdk` resolves against the copy above, which now carries its compiled dist/.
COPY app/package.json app/package-lock.json ./app/
RUN npm --prefix app ci
COPY app/ ./app/
RUN npm --prefix app run build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The compiled SDK, laid out so `file:../plugin-sdk` resolves the same way it does in the repo.
# Only package.json + dist: the SDK's own dependencies are build-time only for the host, and its
# toolchain (bin/, src/) has no place in a runtime image.
COPY --from=builder /build/plugin-sdk/package.json /plugin-sdk/package.json
COPY --from=builder /build/plugin-sdk/dist /plugin-sdk/dist

# Production dependency tree only. Installed here rather than copied from the builder so npm
# creates the SDK link itself and no dev toolchain leaks into the image.
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Migration files live outside dist/ (they are .sql, not compiled), so they need their own COPY —
# both `node dist/index.js` and `node dist/migrate.js` resolve them relative to dist/.
COPY app/migrations/ ./migrations/

COPY --from=builder /build/app/dist ./dist

# /data/plugins holds installed packages; /data/preinstalled is the boot-time install drop point,
# deliberately empty in the published image.
RUN mkdir -p /data/plugins /data/preinstalled

EXPOSE 8090

CMD ["node", "dist/index.js"]
