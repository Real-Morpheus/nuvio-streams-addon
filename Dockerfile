FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache curl tor

RUN npm install
COPY . .
RUN chmod +x start.sh

EXPOSE 7000
CMD ["./start.sh"]
