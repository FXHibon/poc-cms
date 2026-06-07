# ====================================================
# Stage 1: Build & Dependency Installation
# ====================================================
FROM node:26-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency definition files first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (production + development, needed if compiling or test suites require it)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# ====================================================
# Stage 2: Minimal Production Runner
# ====================================================
FROM node:26-alpine AS runner

WORKDIR /usr/src/app

# Set node environment to production
ENV NODE_ENV=production

# Copy built package dependencies and source from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/public ./public

# Create uploads directory and set permissions for security hardening
RUN mkdir -p public/uploads \
    && addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app

# Drop root privileges and execute as appuser
USER appuser

# Expose server port (default 3000)
EXPOSE 3000

# Health check setup using wget (alpine default)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "src/server.js"]
