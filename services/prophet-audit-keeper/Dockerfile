FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci
COPY --from=build /app/src ./src
COPY tsconfig.json ./
EXPOSE 8792
CMD ["node", "--import", "tsx", "src/keeper.ts"]
