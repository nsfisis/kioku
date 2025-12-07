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

# Copy source files
COPY tsconfig.json esbuild.mjs ./
COPY src/server ./src/server

# Build the server
RUN pnpm build:server

# Production stage
FROM node:22-slim AS production

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Copy built server from builder stage
COPY --from=builder /app/dist/server ./dist/server

# Copy drizzle migrations for database setup
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run migrations and start the server
CMD ["sh", "-c", "pnpm db:migrate && node dist/server/index.js"]
