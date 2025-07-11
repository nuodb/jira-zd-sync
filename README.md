# Zendesk ↔ JIRA Sync Server

<!-- TOC -->
- [Quick Commands for Production Maintenance](#quick-commands-for-production-maintenance)
- [Features](#features)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [File Structure](#file-structure)
- [Running the Server (Production & Development)](#running-the-server-production--development)
  - [Production](#production)
  - [Development](#development)
  - [Testing](#testing)
  - [Health Check](#health-check)
- [Running with Docker Compose](#running-with-docker-compose)
- [Deployment Instructions (Docker Compose)](#deployment-instructions-docker-compose)
- [Docker Compose and Networking Notes](#docker-compose-and-networking-notes)
- [Troubleshooting](#troubleshooting)
<!-- /TOC -->

This project is a Node.js/Bun-based server that keeps Zendesk ticket custom fields in sync with their corresponding JIRA issues. It is designed to ensure that Zendesk tickets always reflect the latest state of their linked JIRA issues, such as type, resolution, and fix versions.

## Quick Commands for Production Maintenance

To start the production server:

```bash
docker compose up --build -d jira-zendesk-prod
```

To stop the production server:

```bash
docker compose down
```

## Features

- **Automatic Polling:**
  - Polls Zendesk for tickets with JIRA links and fetches the latest JIRA issue data.
  - Runs two intervals:
    - Every 30 seconds: Syncs recently changed tickets and JIRAs.
    - Every 30 minutes: Performs a full sync to catch any missed updates.
- **Efficient Updates:**
  - Uses a cache to avoid unnecessary updates.
  - Only updates Zendesk tickets if the JIRA issue's type, resolution, or fix versions have changed.
- **Custom Field Mapping:**
  - Maps JIRA fields to Zendesk custom fields (IDs are configurable via environment variables).
- **Error Logging:**
  - Logs errors and sync activity for monitoring and debugging.

## How It Works

1. **Startup:**
   - Logs environment info.
   - Performs an initial full sync.
   - Starts two polling intervals (recent and full sync).

2. **Polling:**
   - Fetches Zendesk tickets that are not closed and have a JIRA key set.
   - Extracts JIRA keys and fetches the corresponding JIRA issues.
   - If running a recent sync, also fetches recently changed JIRAs and merges them.

3. **Syncing:**
   - Compares each JIRA issue with the cached version.
   - If a JIRA issue is new or has changed, updates the cache and marks it for update.
   - Finds Zendesk tickets referencing updated JIRAs and updates their custom fields.

## Configuration

Set the following environment variables in `.env.production` and `.env.development` based on the usage. **Do not commit files with secrets.** For sharing variable names, use a `.env.example` file:

- `ZENDESK_DOMAIN` - Zendesk API base URL
- `ZENDESK_EMAIL` - Zendesk user email
- `ZENDESK_APITOKEN` - Zendesk API token
- `JIRA_DOMAIN` - JIRA API base URL
- `JIRA_TOKEN` - JIRA API token
- `JIRA_OR_GITHUB_CUSTOM_FIELD_ID` - Zendesk custom field ID for JIRA key
- `JIRA_TYPE_FIELD_ID` - Zendesk custom field ID for JIRA type
- `JIRA_RESOLUTION_FIELD_ID` - Zendesk custom field ID for JIRA resolution
- `JIRA_FIX_VERSIONS_FIELD_ID` - Zendesk custom field ID for JIRA fix versions

Refer to http://nuoconfluence/display/SERVICES/JIRA+-+Zendesk+Sync+Server for default/example values.

## File Structure

- `index.ts` - Main server logic and polling/sync orchestration
- `zendesk.ts` - Zendesk API client and helpers
- `jira.ts` - JIRA API client and helpers
- `log.ts` - Logging utilities
- `logs/` - Server log files
- `health-check.ts` - Health check script
- `tests/` - Test suite (with mocks and helpers)
- `docker-compose.yml` - Docker Compose configuration
- `Dockerfile` - Docker build instructions
- `.env.*` - Environment variable files

## Running the Server (Production & Development)

- The `jira-zendesk-dev`, `jira-zendesk-prod`, and `jira-zendesk-test` services are defined in your `docker-compose.yml`.
- Use the appropriate `.env` file for each environment (e.g., `.env.development` for dev, `.env.production` for prod, `.env.test` for test).

### Production

To run the production server:

```bash
bun start
```

Or, with Docker Compose:

```bash
# Start the production service in the background
# (add --build to force a rebuild)
docker compose up --build -d jira-zendesk-prod
# View logs
docker compose logs -f jira-zendesk-prod
```

### Development

To run the development server (with hot reload, debug, or dev-specific settings):

```bash
bun dev
```

Or, with Docker Compose:

```bash
# Start the development service in the background
docker compose up --build -d jira-zendesk-dev
# View logs
docker compose logs -f jira-zendesk-dev
```

### Testing

To run tests, you should first start the development server (so that any required services or dependencies are available):

**Without Docker Compose:**

```bash
bun dev
# In another terminal:
bun test
```

**With Docker Compose:**

```bash
# Start the development server (if not already running)
docker compose up --build -d jira-zendesk-dev
# Then run tests
docker compose run --rm jira-zendesk-test
```


### Health Check

You can verify that your environment variables and API credentials are correct and that both JIRA and Zendesk APIs are reachable.


#### Run locally

```bash
NODE_ENV=development bun health-check
NODE_ENV=production bun health-check
```

#### Run with Docker Compose

```bash
docker compose run -e NODE_ENV=development --rm jira-zendesk-health
docker compose run -e NODE_ENV=production --rm jira-zendesk-health
```

This will attempt to connect to both APIs using the current environment and print the result to the console. Set `NODE_ENV` as needed for your environment.

## Running with Docker Compose

- Ensure you have Docker and Docker Compose installed.
- Copy `.env.example` to `.env.production` and/or `.env.development` and fill in the required values.
- Use `docker compose up --build -d <service>` to start a service in detached mode.
- Use `docker compose logs -f <service>` to follow the logs of a service.

## Deployment Instructions (Docker Compose)

1. **Prepare Environment Variables:**
   - Copy the example environment file: `cp .env.example .env.production`
   - Edit `.env.production` to set your production values.

2. **Build and Start Services:**
   - Run `docker compose up --build -d jira-zendesk-prod` to build and start the production services.

3. **Monitor Logs:**
   - Use `docker compose logs -f jira-zendesk-prod` to monitor the logs for any issues.

4. **Verify Deployment:**
   - Check the health of the services and verify that the application is working as expected.

## Docker Compose and Networking Notes

- Docker Compose creates a default network for your application. All services are connected to this network and can communicate with each other using the service name as the hostname.
- If you need to connect to external services (like databases or APIs), ensure that the necessary ports are exposed and any required environment variables are set.
- For development, you might want to use `docker compose up --build` to rebuild the images when code changes. For production, use `docker compose up -d` to start the services in detached mode.

## Troubleshooting

- **Log files not created:** Ensure the `logs/` directory exists and is writable by the container. If using Docker Compose, check volume permissions.
- **Environment variables not loaded:** Make sure you have the correct `.env.*` file for your environment and it is in the project root.
- **Docker image not rebuilding:** Use `docker compose up --build -d ...` to force a rebuild.
- **Permission errors:** If you see file or directory permission errors, check your Docker volume mappings and user permissions.

