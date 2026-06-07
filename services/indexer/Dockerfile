FROM node:22-alpine
WORKDIR /app/services/indexer
COPY services/indexer/package.json services/indexer/package-lock.json* ./
RUN npm install --omit=dev
COPY services/indexer/tsconfig.json ./
COPY services/indexer/migrations ./migrations
COPY services/indexer/src ./src
COPY services/shared ../shared
COPY deploy/testnet-v2.json ../../deploy/testnet-v2.json
EXPOSE 8800
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/index.ts"]
