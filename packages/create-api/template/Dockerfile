# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run compile

# Production stage
FROM node:20-alpine

# Run as production: api-core refuses to boot with a missing/weak/placeholder
# AUTH_SECRET only when NODE_ENV=production. (docker-compose.yml overrides this
# to `development` for local use.)
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/lib ./lib
COPY --from=builder /app/public ./public
COPY --from=builder /app/config ./config

EXPOSE 3030

CMD ["npm", "start"]
