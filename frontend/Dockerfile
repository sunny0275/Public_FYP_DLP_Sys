FROM node:20-alpine AS builder

WORKDIR /app

# Avoid downloading Electron binaries during Docker builds.
# This project builds a web UI (`vite build`) for the nginx image; Electron runtime is not needed here.
# Skipping prevents TLS/proxy issues in CI/Docker environments.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV npm_config_electron_skip_binary_download=1

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci || npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
