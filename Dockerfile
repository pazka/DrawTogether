# ---- Stage 1: build the React front (build-only; only front/build reaches the runtime image) ----
# react-scripts 4 (webpack 4) hashes with md4, which OpenSSL 3 (node >= 17) only offers through the
# legacy provider. Same node line as the runtime stage (node 16 is EOL); the flag is build-only.
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS front
ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /front

COPY front/package*.json ./

RUN npm ci --no-audit --no-fund

COPY front/ ./

# same as the laptop-era build.js: `cd front && npm run build` -> front/build
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

RUN npm ci --no-audit --no-fund

# Bundle app source
COPY . .

# Built front, served by express from /app/front/build (build.js copied front/build the same way)
COPY --from=front /front/build ./front/build

# Writable data dirs (normally volumes), owned by node (uid 1000) so the app also starts as
# non-root when they are not mounted: upload root (multer temp dir front/build/uploads/.tmp)
# and the node-persist room store. Legacy box compose: bind mounts on these two paths, port 80.
# hosh-deploy compose (docker-compose.example.yml): uid 10001, one named volume at /data
# (UPLOADS_DIR=/data/uploads, PERSIST_DIR=/data/persist, PORT=8000); /data is owned by 10001 so a
# fresh volume starts writable.
RUN mkdir -p front/build/uploads .node-persist /data && chown node:node front/build/uploads .node-persist \
 && chown 10001:10001 /data

EXPOSE 80

# GET /healthz on $PORT (default 80): uploads + room store writable, room list readable
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "/app/scripts/healthcheck.js"]

CMD [ "npm", "run","start-prod" ]
