# syntax=docker/dockerfile:1
# Backend multi-stage build using Docker Hardened Images.

FROM dhi.io/node:22-alpine3.24-dev AS build

WORKDIR /app

# Native modules used by bcrypt and sharp require the build toolchain.
RUN apk add --no-cache python3 make g++ openssl

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts && npm rebuild bcrypt sharp

COPY prisma ./prisma
RUN npm run db:generate

COPY tsconfig.json ./
COPY src ./src
COPY scripts/migrate_passwords.ts ./scripts/migrate_passwords.ts
RUN npm run build
RUN mkdir -p uploads && chown 65532:65532 uploads

# Keep Prisma CLI and production native modules, but remove development dependencies.
RUN npm prune --omit=dev && npm cache clean --force

FROM dhi.io/node:22-alpine3.24 AS runner

WORKDIR /app
ENV NODE_ENV=production

# Prisma 5 detects Alpine's OpenSSL in /lib when the runtime has no shell.
COPY --from=build /usr/lib/libssl.so.3 /usr/lib/libcrypto.so.3 /lib/

COPY --from=build --chown=65532:65532 /app/package.json /app/package-lock.json* ./
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=65532:65532 /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=65532:65532 /app/prisma ./prisma
COPY --from=build --chown=65532:65532 /app/dist ./dist
COPY --chown=65532:65532 scripts/container-entrypoint.js ./scripts/container-entrypoint.js
COPY --chown=65532:65532 uploads ./seed_uploads

COPY --from=build --chown=65532:65532 /app/uploads ./uploads

USER 65532

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "/app/scripts/container-entrypoint.js", "api"]
