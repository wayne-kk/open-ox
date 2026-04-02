FROM docker.1ms.run/node:20-slim

# Create app directory
WORKDIR /home/user/app

# Copy package.json and install deps at build time
COPY package.json ./
RUN npm install --legacy-peer-deps

# Back to home
WORKDIR /home/user
