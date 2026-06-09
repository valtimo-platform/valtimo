FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

RUN mkdir -p /data/plugins

EXPOSE 8090

CMD ["node", "dist/index.js"]
