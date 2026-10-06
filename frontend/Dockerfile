FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY packages/db/package*.json ./packages/db/
COPY packages/mqtt/package*.json ./packages/mqtt/
COPY packages/types/package*.json ./packages/types/
RUN npm ci --workspace=frontend --workspace=packages/types --include-workspace-root

COPY packages ./packages
COPY frontend ./frontend
RUN npm run build --workspace=packages/types

WORKDIR /app/frontend
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "start"]
