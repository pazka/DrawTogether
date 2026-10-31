# ---- Stage 1: build the React front (build-only; only front/build reaches the runtime image) ----
# react-scripts 4 (webpack 4) hashes with md4, which OpenSSL 3 (node >= 17) only offers through the
# legacy provider. Same node line as the runtime stage (node 16 is EOL); the flag is build-only.
FROM node:26-alpine AS front
ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /front

COPY front/package*.json ./

RUN npm ci --no-audit --no-fund

COPY front/ ./

# same as the laptop-era build.js: `cd front && npm run build` -> front/build
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:26-alpine

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
# and the node-persist room store
RUN mkdir -p front/build/uploads .node-persist && chown node:node front/build/uploads .node-persist

EXPOSE 80

CMD [ "npm", "run","start-prod" ]
