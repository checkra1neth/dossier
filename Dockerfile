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

## Debug: check if native bindings load
RUN node -e "try { require('./node_modules/@xmtp/node-bindings/dist/bindings_node.linux-x64-gnu.node'); console.log('GNU binding OK'); } catch(e) { console.log('GNU:', e.message); }" && \
    node -e "try { require('./node_modules/@xmtp/node-bindings/dist/bindings_node.linux-x64-musl.node'); console.log('MUSL binding OK'); } catch(e) { console.log('MUSL:', e.message); }" && \
    ldd node_modules/@xmtp/node-bindings/dist/bindings_node.linux-x64-gnu.node 2>&1 | head -20 || true

EXPOSE 8080

CMD ["node", "--import", "tsx", "src/index.ts"]
