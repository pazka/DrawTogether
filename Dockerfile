FROM node:8.9.4-alpine

# mount /upload would be nice


# Create app directory  
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 80

CMD [ "npm", "start" ]
