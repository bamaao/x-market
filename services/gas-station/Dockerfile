FROM node:22-alpine
WORKDIR /app/services/gas-station
COPY services/gas-station/package.json services/gas-station/package-lock.json* ./
RUN npm install --omit=dev
COPY services/gas-station/tsconfig.json ./
COPY services/gas-station/src ./src
COPY services/shared ../shared
EXPOSE 8787
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/server.ts"]
