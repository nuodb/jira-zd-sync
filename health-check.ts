#!/usr/bin/env bun
// health-check.ts
// Verifies connectivity to JIRA and Zendesk APIs using current environment variables

const zendeskDomain = Bun.env.ZENDESK_DOMAIN;
const jiraDomain = Bun.env.JIRA_DOMAIN;
function toBase64(str: string) {
  // Bun-compatible base64 encoding using ArrayBuffer
  //@ts-ignore
  return Buffer.from(str, 'utf8').toString('base64');
}
const zendeskAuth = toBase64(`${Bun.env.ZENDESK_EMAIL}/token:${Bun.env.ZENDESK_APITOKEN}`);
const jiraToken = Bun.env.JIRA_TOKEN;

async function checkZendesk() {
  try {
    const res = await fetch(`${zendeskDomain}/api/v2/tickets.json?page[size]=1`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${zendeskAuth}`
      }
    });
    if ((res as any).ok) {
      console.log('Zendesk API: ✅ reachable');
    } else {
      console.error(`Zendesk API: ❌ unreachable (status ${(res as any).status})`);
    }
  } catch (e) {
    console.error('Zendesk API: ❌ error', e);
  }
}

async function checkJira() {
  try {
    const res = await fetch(`${jiraDomain}/rest/api/2/myself`, {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });
    if ((res as any).ok) {
      console.log('JIRA API: ✅ reachable');
    } else {
      console.error(`JIRA API: ❌ unreachable (status ${(res as any).status})`);
    }
  } catch (e) {
    console.error('JIRA API: ❌ error', e);
  }
}

await checkZendesk();
await checkJira();
