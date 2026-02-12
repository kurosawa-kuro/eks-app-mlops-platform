#
# Hono Backend Dockerfile
# - Multi-stage build (TypeScript -> dist)
# - Copies EJS templates into dist so render() works in production
#

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY src ./src
COPY env ./env
RUN npm run build \
  && mkdir -p dist/presentation \
  && cp -R src/presentation/views dist/presentation/views \
  && cp -R src/presentation/public dist/presentation/public

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# install prod deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8000
CMD ["node", "dist/index.js"]


