# Zendesk ↔ JIRA Sync Server

This project is a Node.js/Bun-based server that keeps Zendesk ticket custom fields in sync with their corresponding JIRA issues. It is designed to ensure that Zendesk tickets always reflect the latest state of their linked JIRA issues, such as type, resolution, and fix versions.

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

Set the following environment variables:

- `ZENDESK_DOMAIN` - Zendesk API base URL
- `ZENDESK_EMAIL` - Zendesk user email
- `ZENDESK_APITOKEN` - Zendesk API token
- `JIRA_DOMAIN` - JIRA API base URL
- `JIRA_TOKEN` - JIRA API token
- `JIRA_OR_GITHUB_CUSTOM_FIELD_ID` - Zendesk custom field ID for JIRA key
- `JIRA_TYPE_FIELD_ID` - Zendesk custom field ID for JIRA type
- `JIRA_RESOLUTION_FIELD_ID` - Zendesk custom field ID for JIRA resolution
- `JIRA_FIX_VERSIONS_FIELD_ID` - Zendesk custom field ID for JIRA fix versions

## File Structure

- `index.ts` - Main server logic and polling/sync orchestration
- `zendesk.ts` - Zendesk API client and helpers
- `jira.ts` - JIRA API client and helpers
- `log.ts` - Logging utilities
- `assert.ts` - Assertion helpers
- `tests/` - Test suite

## Running the Server

1. Install dependencies:
   ```bash
   bun install
   ```
2. Set environment variables (see above).
3. Start the server:
   ```bash
   bun run index.ts
   ```

## Notes

- The server is designed for continuous operation and should be run as a background process.
- Logs are written to the `logs/` directory.
- For production use, consider adding retry logic, cache cleanup, and improved error handling.



