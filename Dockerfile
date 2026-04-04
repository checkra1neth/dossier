FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install backend deps (clean install to avoid optional deps bug)
RUN npm ci

# Install frontend deps and build
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env.example ./

EXPOSE 8080

CMD ["node", "--import", "tsx", "src/index.ts"]
