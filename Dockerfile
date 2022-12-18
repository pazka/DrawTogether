FROM node:8.9.4-alpine

# Create app directory  
WORKDIR /app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 80

CMD [ "npm", "run","start-prod" ]
