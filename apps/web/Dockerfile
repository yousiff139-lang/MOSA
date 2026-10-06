FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/core/package*.json ./packages/core/
COPY packages/db/package*.json ./packages/db/
COPY packages/mqtt/package*.json ./packages/mqtt/
COPY packages/types/package*.json ./packages/types/
RUN npm ci --workspace=apps/web --workspace=packages/core --workspace=packages/types --include-workspace-root

COPY packages ./packages
COPY apps/web ./apps/web
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/types

WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone/apps/web ./apps/web
COPY --from=builder /app/apps/web/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next/standalone/package.json ./package.json
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
