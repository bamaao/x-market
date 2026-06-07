FROM node:22-alpine
WORKDIR /app/services/chain-monitor
COPY services/chain-monitor/package.json services/chain-monitor/package-lock.json* ./
RUN npm install --omit=dev
COPY services/chain-monitor/tsconfig.json ./
COPY services/chain-monitor/src ./src
COPY services/shared ../shared
EXPOSE 8789
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/monitor.ts"]
