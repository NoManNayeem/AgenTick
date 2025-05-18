# Use official Node image
FROM node:18-alpine

# Set workdir
WORKDIR /app

# Copy package.json and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy all frontend code
COPY frontend/ .

# Build the production version
RUN npm run build

# Expose frontend port
EXPOSE 3000

# Start Next.js app
CMD ["npm", "start"]
