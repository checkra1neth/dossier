FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install all deps (including devDependencies for esbuild)
RUN npm ci

# Copy source and build server bundle
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build:server

# Build frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# Prune devDependencies for smaller image
RUN npm prune --production

EXPOSE 8080

CMD ["node", "dist/index.mjs"]
