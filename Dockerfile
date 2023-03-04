FROM node:18.14.2-alpine
WORKDIR /usr/app
COPY package.json .
RUN npm install\
    && npm install typescript -g
COPY . .
RUN tsc
CMD ["node","--experimental-specifier-resolution=node", "./dist/index.js"]