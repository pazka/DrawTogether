# ---- Stage 1: build the React front (build-only; only front/build reaches the runtime image) ----
# react-scripts 4 (webpack 4) builds cleanly on node 16 without --openssl-legacy-provider.
FROM node:16-alpine AS front

WORKDIR /front

COPY front/package*.json ./

RUN npm ci --no-audit --no-fund

COPY front/ ./

# same as the laptop-era build.js: `cd front && npm run build` -> front/build
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-alpine

# Upgrade bundled npm: npm 10 ships tar 6.x (CVE-2026-59873); npm 11.18+ ships tar >= 7.5.19
# (npm@12 requires node >= 22, so pin the npm 11 line)
RUN npm install -g npm@11

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

RUN npm install

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
