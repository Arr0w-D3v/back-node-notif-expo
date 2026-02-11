FROM node:20-alpine

WORKDIR /app

# Install build dependencies for sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "src/index.js"]
