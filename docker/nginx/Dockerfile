FROM nginx:alpine

# Install certbot and dependencies
RUN apk add --no-cache certbot certbot-nginx openssl bash

# Create directory for Let's Encrypt challenges
RUN mkdir -p /var/www/certbot

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
