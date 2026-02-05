# Base image
FROM node:18-slim

# Install system dependencies (FFmpeg is critical for audio)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build Next.js app
RUN npm run build

# Set environment variables
ENV NODE_ENV production
ENV HOSTNAME "0.0.0.0"
ENV PORT 3000

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
