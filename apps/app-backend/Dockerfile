# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# Copy non-TS assets (views, config) to dist
RUN cp -r src/views dist/views 2>/dev/null || true
RUN cp -r src/config dist/config 2>/dev/null || true

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
ENV PORT=8000
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "dist/index.js"]
