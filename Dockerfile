FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# File Author / Maintainer
MAINTAINER Craig OConnor

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Update the repository and install Redis Server
RUN apt-get update && apt-get install -y redis-server

# Bundle app source
COPY . /usr/src/app

EXPOSE 8080
EXPOSE 1337

CMD [ "npm", "start" ]

# Run the server
