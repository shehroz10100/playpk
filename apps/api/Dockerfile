# PlayPK API — build from monorepo root:
#   docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/walkin/package.json ./apps/walkin/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json ./packages/config/
# Skip redis-memory-server postinstall (dev-only; needs make/gcc in CI images)
ENV REDISMS_DISABLE_POSTINSTALL=1
RUN npm ci --ignore-scripts

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
COPY packages/config ./packages/config
# Compile shared-types to JS — Node cannot require the package's .ts entry in production.
RUN npm run build --workspace=@playpk/shared-types \
  && node -e "const fs=require('fs');const p='packages/shared-types/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.main='./dist/index.js';j.types='./dist/index.d.ts';j.exports={'.':{types:'./dist/index.d.ts',default:'./dist/index.js'}};fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"
RUN npm run db:generate --workspace=@playpk/api
RUN npm run build --workspace=@playpk/api

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
WORKDIR /app/apps/api
EXPOSE 4000
# Log migrate failures clearly; still fail fast so bad schema never serves traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
