FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY contract/package.json contract/package.json
COPY domain/package.json domain/package.json
COPY did/package.json did/package.json
COPY did-resolver-service/package.json did-resolver-service/package.json

RUN npm ci --ignore-scripts

COPY contract contract
COPY domain domain
COPY did did
COPY did-resolver-service did-resolver-service

RUN npm run build -w contract \
  && npm run build -w domain \
  && npm run build -w did \
  && npm run build -w did-resolver-service


FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY contract/package.json contract/package.json
COPY domain/package.json domain/package.json
COPY did/package.json did/package.json
COPY did-resolver-service/package.json did-resolver-service/package.json

RUN npm ci --ignore-scripts --omit=dev

COPY --from=builder /app/contract/dist contract/dist
COPY --from=builder /app/domain/dist domain/dist
COPY --from=builder /app/did/dist did/dist
COPY --from=builder /app/did-resolver-service/dist did-resolver-service/dist

EXPOSE 3001

WORKDIR /app/did-resolver-service
USER node
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
