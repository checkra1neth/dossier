FROM node:22

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install backend deps — delete lock & node_modules first per XMTP recommendation
RUN rm -f package-lock.json && npm install

# Install frontend deps and build
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env.example ./

# Find ALL copies of node-bindings and ensure they have the .node files
RUN find node_modules -path "*/node-bindings/dist" -type d | while read d; do \
      echo "=== $d ==="; ls "$d"/*.node 2>/dev/null || echo "NO .node FILES!"; \
    done
# Dedupe to flatten nested copies
RUN npm dedupe 2>/dev/null || true

EXPOSE 8080

CMD ["node", "--import", "tsx", "src/index.ts"]
