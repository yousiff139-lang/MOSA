FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy server directory
COPY server/ ./server/

# Ensure data directory exists
RUN mkdir -p /app/data

# Set persistent database path
ENV DB_PATH=/app/data/smarthome.db

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server/index.js"]
