FROM node:22-alpine
WORKDIR /app/services/oracle-relayer
COPY services/oracle-relayer/package.json services/oracle-relayer/package-lock.json* ./
RUN npm install --omit=dev
COPY services/oracle-relayer/tsconfig.json ./
COPY services/oracle-relayer/src ./src
COPY services/shared ../shared
EXPOSE 8790
CMD ["node", "--env-file=.env.local", "--import", "tsx", "src/relayer.ts"]
