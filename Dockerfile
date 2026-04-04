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

# Flatten ALL nested @xmtp/node-bindings — symlink to top-level copy
RUN TOP=/app/node_modules/@xmtp/node-bindings && \
    find node_modules -mindepth 3 -path "*/@xmtp/node-bindings" -type d | while read nested; do \
      echo "Replacing nested: $nested -> $TOP"; \
      rm -rf "$nested"; \
      ln -s "$TOP" "$nested"; \
    done

EXPOSE 8080

ENV NODE_PATH=/app/node_modules

CMD ["node", "--import", "tsx", "src/index.ts"]
