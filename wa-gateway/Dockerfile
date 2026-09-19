FROM node:20-alpine

WORKDIR /app

# Install dependencies for canvas/build tools if needed
RUN apk add --no-cache tzdata git

ENV TZ=Asia/Jakarta

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
