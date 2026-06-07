FROM node:22-alpine
WORKDIR /app/services/walrus-relay
COPY services/walrus-relay/package.json ./
RUN npm install --omit=dev
COPY services/walrus-relay/tsconfig.json ./
COPY services/walrus-relay/src ./src
EXPOSE 8791
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/server.ts"]
