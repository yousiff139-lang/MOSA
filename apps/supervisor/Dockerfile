FROM node:20-alpine

# Install Docker CLI so we can use docker exec directly if needed (though dockerode handles most things)
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Compile TypeScript
RUN npm install -g typescript
RUN tsc

CMD ["node", "dist/index.js"]
