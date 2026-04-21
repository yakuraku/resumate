FROM node:20-alpine AS builder

WORKDIR /app/frontend

# Copy package files first for better layer caching.
COPY frontend/package*.json ./

RUN npm ci

# Copy the rest of the frontend source.
COPY frontend/ ./

# BACKEND_URL must be available at build time because Next.js bakes
# rewrites() from next.config.ts into .next/routes-manifest.json during
# `next build`. The default here covers local dev; docker-compose overrides
# it to http://backend:8921 so the proxy resolves inside the Docker network.
ARG BACKEND_URL=http://localhost:8921
ENV BACKEND_URL=$BACKEND_URL

# Build the Next.js production bundle.
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app/frontend

ENV NODE_ENV=production

# Copy only the built output and production dependencies.
COPY --from=builder /app/frontend/package*.json ./
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/next.config.ts ./

# Port the frontend listens on (Next.js default start port).
EXPOSE 3000

# BACKEND_URL is injected at runtime by docker-compose.yml.
# next.config.ts reads it when `next start` initialises the rewrite rules.
CMD ["npm", "start"]
