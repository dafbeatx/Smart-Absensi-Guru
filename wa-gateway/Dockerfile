FROM node:20-alpine

WORKDIR /app

# Install timezone data
RUN apk add --no-cache tzdata git

ENV TZ=Asia/Jakarta
# Hugging Face Spaces requires container to listen on port 7860
ENV PORT=7860

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Hugging Face runs containers with UID 1000 by default
RUN mkdir -p /app/auth_info_baileys && chown -R 1000:1000 /app

USER 1000

EXPOSE 7860

CMD ["npm", "start"]
