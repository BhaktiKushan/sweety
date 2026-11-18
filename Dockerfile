# Builds the React client, then runs the Express server which serves the API
# and the built client from one process.
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client-build /app/client/dist ../client/dist
EXPOSE 4000
CMD ["node", "src/index.js"]
