FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npx vite build

FROM node:20-alpine AS server-build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=server-build /app/dist ./dist
COPY --from=client-build /app/client/dist ./client/dist
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/web.js"]