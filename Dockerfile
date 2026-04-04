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

# Fix XMTP node-bindings version mismatch:
# node-sdk needs 1.10.0 (has Backend export) but top-level is 1.9.1
# Replace top-level with the version from node-sdk, symlink all nested copies
RUN TOP=/app/node_modules/@xmtp/node-bindings && \
    SDK_COPY=/app/node_modules/@xmtp/node-sdk/node_modules/@xmtp/node-bindings && \
    if [ -d "$SDK_COPY" ]; then \
      echo "Replacing top-level node-bindings with node-sdk version"; \
      rm -rf "$TOP" && cp -r "$SDK_COPY" "$TOP"; \
    fi && \
    find node_modules -mindepth 3 -path "*/@xmtp/node-bindings" -type d | while read nested; do \
      rm -rf "$nested" && ln -s "$TOP" "$nested"; \
    done

EXPOSE 8080

ENV NODE_PATH=/app/node_modules

CMD ["node", "--import", "tsx", "src/index.ts"]
