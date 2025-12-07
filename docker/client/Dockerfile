# Build stage
FROM node:22-slim AS builder

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source files needed for client build
COPY tsconfig.json vite.config.ts index.html ./
COPY src/client ./src/client

# Build the client
RUN pnpm build:client

# Production stage - nginx for static file serving
FROM nginx:stable AS production

# Copy built client from builder stage
COPY --from=builder /app/dist/client /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
