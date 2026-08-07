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

EXPOSE 80

CMD [ "npm", "run","start-prod" ]
