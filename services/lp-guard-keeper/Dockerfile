FROM node:22-alpine
WORKDIR /app/services/lp-guard-keeper
COPY services/lp-guard-keeper/package.json services/lp-guard-keeper/package-lock.json* ./
RUN npm install --omit=dev
COPY services/lp-guard-keeper/tsconfig.json ./
COPY services/lp-guard-keeper/src ./src
COPY services/shared ../shared
EXPOSE 8788
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/keeper.ts"]
