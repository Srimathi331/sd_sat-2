FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY packages/common ./packages/common
COPY services/api-gateway ./services/api-gateway
RUN npm install --omit=dev --workspaces --include-workspace-root
ENV NODE_ENV=production
WORKDIR /app/services/api-gateway
CMD ["node", "src/index.js"]
