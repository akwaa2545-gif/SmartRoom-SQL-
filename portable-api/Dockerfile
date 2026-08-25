# Production Dockerfile for SmartRoom Portable API
FROM node:22-alpine AS base

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install dependencies (only production packages)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY src ./src
COPY sql ./sql

# Create directory for mounting secrets
RUN mkdir -p /app/secrets && chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose default API port
EXPOSE 8787

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8787/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
