FROM node:14-buster

COPY . /openousd-api

WORKDIR "/openousd-api"

RUN npm install
