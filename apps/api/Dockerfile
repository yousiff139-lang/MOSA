FROM node:20-alpine
RUN apk add --no-cache openssl ffmpeg android-tools
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/core/package*.json ./packages/core/
COPY packages/db/package*.json ./packages/db/
COPY packages/mqtt/package*.json ./packages/mqtt/
COPY packages/types/package*.json ./packages/types/
RUN npm ci --workspace=apps/api --workspace=packages/core --workspace=packages/db --workspace=packages/mqtt --workspace=packages/types --include-workspace-root

COPY packages ./packages
COPY apps/api ./apps/api

# Generate prisma client and build packages
RUN npm run build --workspace=packages/core
RUN npm run generate --workspace=packages/db
RUN npm run build --workspace=packages/mqtt
RUN npm run build --workspace=packages/types

RUN npm run build --workspace=apps/api
COPY apps/api/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
