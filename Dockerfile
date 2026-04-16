FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build server only (client already built and committed as dist/public/)
RUN npx tsx script/build-server.ts

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
