FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

# Migration files live outside dist/ (they are .sql, not compiled), so they need their own COPY —
# both `node dist/index.js` and `node dist/migrate.js` resolve them relative to dist/.
COPY migrations/ ./migrations/

RUN mkdir -p /data/plugins

EXPOSE 8090

CMD ["node", "dist/index.js"]
