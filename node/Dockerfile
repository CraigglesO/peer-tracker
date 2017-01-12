FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# File Author / Maintainer
MAINTAINER Craig OConnor

# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/

# From here we load our application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
WORKDIR /opt/app
COPY . /opt/app

# Update the repository and install Redis Server
RUN apt-get update

# Bundle app source
COPY . /usr/src/app

EXPOSE 8080
EXPOSE 1337

# Run the server
CMD [ "npm", "start" ]
