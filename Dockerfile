FROM ubuntu:24.04

# Install Node.js 22
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

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
