FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY packages/common ./packages/common
COPY services/feed-service ./services/feed-service
RUN npm install --omit=dev --workspaces --include-workspace-root
ENV NODE_ENV=production
WORKDIR /app/services/feed-service
CMD ["node", "src/index.js"]
