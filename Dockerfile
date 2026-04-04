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

# Fix nested XMTP node-bindings — remove duplicates, force single copy
RUN find node_modules -path "*/node_modules/@xmtp/node-bindings" -not -path "node_modules/@xmtp/node-bindings" -type d | \
    while read nested; do \
      echo "Removing nested: $nested"; \
      rm -rf "$nested"; \
    done

EXPOSE 8080

CMD ["node", "--import", "tsx", "src/index.ts"]
