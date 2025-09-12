FROM node:20-slim

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

VOLUME ["/app/tokens", "/app/userDataDir"]

CMD ["npm", "start"]
