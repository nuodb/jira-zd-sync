# Use the official Bun image as the base
FROM oven/bun:latest

WORKDIR /app

# Copy all files into the image
COPY . .

# Install dependencies
RUN bun install

# Ensure entrypoint.sh is executable
RUN chmod +x /app/entrypoint.sh

# Default command (can be overridden by docker-compose)
CMD ["bun", "start"]
