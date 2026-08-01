FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Production/container builds are reproducible by design. Generate and commit
# package-lock.json once with `npm install`, then every image uses `npm ci`.
RUN test -f package-lock.json || (echo "package-lock.json is required for container builds" && exit 1)
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -q -O - http://127.0.0.1:3000/api/live >/dev/null || exit 1
CMD ["node","server.js"]
