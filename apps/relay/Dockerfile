FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/relay/package.json apps/relay/
RUN npm ci --workspace=apps/relay
COPY apps/relay/ apps/relay/
RUN npm run build --workspace=apps/relay

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/relay/dist ./dist
COPY --from=builder /app/apps/relay/package.json ./package.json

EXPOSE 4000
CMD ["npm", "start"]
