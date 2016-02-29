# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants Docker registry proxy
# TO_BUILD:       docker build -rm -t registry.cafjs.com:32000/root-registryproxy .
# TO_RUN:         docker run -p 32000:32000 -e DOCKER_APP_INTERNAL_PORT=32000 -e TARGET_URL=https://registry.cafjs.com:32000 registry.cafjs.com:32000/root-registryproxy


FROM node:4.3

EXPOSE 3000

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN  touch /usr/src/app/http_proxy_build; . /usr/src/app/http_proxy_build;  rm -fr node_modules/*; rm -f npm-shrinkwrap.json; if test -f all.tgz; then tar zxvf all.tgz; fi; npm install --production . ; rm -f all.tgz


CMD [ "npm", "start" ]
