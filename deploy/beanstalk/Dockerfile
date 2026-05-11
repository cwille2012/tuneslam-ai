# Multi-stage Dockerfile for the TuneSlam backend (Elastic Beanstalk Docker platform).
# Build context must be the repo root.

FROM node:20-alpine AS builder
WORKDIR /app

# Install all workspace deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontends/admin/package.json frontends/admin/
COPY frontends/user/package.json frontends/user/
COPY frontends/player/package.json frontends/player/
RUN npm ci --workspaces --include-workspace-root --omit=optional

# Copy sources
COPY shared shared
COPY backend backend

# Build shared and backend
RUN npm --workspace shared run build
RUN npm --workspace backend run build

# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install only production deps for backend + shared
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN npm ci --workspaces --include-workspace-root --omit=dev --omit=optional || \
    npm ci --workspace backend --workspace shared --include-workspace-root --omit=dev --omit=optional

# Copy built artefacts
COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/backend/dist backend/dist

EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
