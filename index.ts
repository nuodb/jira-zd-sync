import zendesk from "zendesk";
import log from "log";
import assert from "assert";
import jira from "jira";



log("Bun.env.ENV type:", Bun.env.NODE_ENV);
log("Bun.env.ZENDESK_DOMAIN:", Bun.env.ZENDESK_DOMAIN);

/** Represents the state of the JIRA info as per zendesk tickets */
export const cachedJiras = new Map<string, jira.PropsForZendesk>();
export type cachedJiras = typeof cachedJiras;


function validateEnv() {
    const requiredVars = [
        'ZENDESK_DOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_APITOKEN',
        'JIRA_DOMAIN', 'JIRA_TOKEN',
        'JIRA_OR_GITHUB_CUSTOM_FIELD_ID', 'JIRA_TYPE_FIELD_ID',
        'JIRA_RESOLUTION_FIELD_ID', 'JIRA_FIX_VERSIONS_FIELD_ID'
    ];
    const missing = requiredVars.filter((v) => !Bun.env[v]);
    if (missing.length > 0) {
        log(`Missing required environment variables: ${missing.join(", ")}`);
        throw new Error("Missing required environment variables");
    }
}

let isSyncing = false;

async function pollAndSync({ recent = false }: { recent?: boolean } = {}) {
    if (isSyncing) {
        log(`Sync already in progress, skipping this cycle.`);
        return;
    }

    isSyncing = true;
    const start = Date.now();

    try {
        const response = await poll({ recent });
        if (!response) return

        const [zTickets, jiras] = response;
        await sync(zTickets, jiras);
        log(`Sync cycle (${recent ? 'recent' : 'full'}) completed in ${Date.now() - start}ms.`);


    } catch (err) {
        log(`Error in pollAndSync: ${err instanceof Error ? err.stack : err}`);
    } finally {
        isSyncing = false;
    }

}

async function poll({ recent = false }): Promise<[zendesk.TicketsResponse | undefined, jira.PropsForZendesk[]] | undefined> {

    log(`Checking for tickets to update...`);

    let tickets = await zendesk.getTickets(recent);
    if (!recent) {
        if (!tickets || !tickets.results) {
            // log("ERROR: Could not get the tickets.");
            return
        }
        if (tickets.results.length === 0) {
            log("No tickets to update.");
            return
        }
    }

    let issueKeys = tickets?.results?.map((t) => zendesk.getJIRAKey(t)) || [];
    // dedupe issueKeys
    const uniqueKeys = new Set(issueKeys);
    issueKeys = Array.from(uniqueKeys);
    log("JIRAS to get:", issueKeys);

    if (!issueKeys) {
        log("ERROR: Could not get the issueKeys.");
        //! send an internal note with the issue of parsing the field
        return
    }

    // gets the JIRAs of the recently changed or all non-closed Zendesk tickets
    const allZendeskJiras = await jira.getJIRAs(issueKeys);
    console.debug("All Zendesk JIRAs", allZendeskJiras);

    // if only grabbing the recently changed Zendesk tickets, then should check if any of the tracked JIRAs recently changed
    let allJiras: jira.PropsForZendesk[] = [];
    if (recent) {
        const recentlyChangedJiras = await jira.getRecentlyChangedJIRAs(cachedJiras);

        if (recentlyChangedJiras.length > 0) {
            // override the tickets to get all the tickets that have jiras set, not only the recently changed ones
            tickets = await zendesk.getTickets();
        }

        // merge with allZendeskJiras, and dedupe
        allJiras = allZendeskJiras.concat(recentlyChangedJiras);
        const uniqueJiras = new Map(allJiras.map((jira) => [jira.key, jira]));
        console.debug("Unique Jiras", uniqueJiras);
        allJiras = Array.from(uniqueJiras.values());
    } else {
        allJiras = allZendeskJiras;
    }

    return [tickets, allJiras]
}

async function sync(tickets: zendesk.TicketsResponse | undefined, allJiras: jira.PropsForZendesk[]) {


    console.debug("All JIRAs", allJiras);
    const updatedJiras: jira.Issue['key'][] = [];

    allJiras.forEach((j) => {

        // if the jira is not in the cache, or the jira has changed, update the zendesk ticket
        const cachedJira = cachedJiras.get(j.key);
        if (cachedJira) {
            if (cachedJira.type !== j.type ||
                cachedJira.resolution !== j.resolution ||
                cachedJira.fixVersions.join(",") !== j.fixVersions.join(",")
            ) {
                updatedJiras.push(j.key);
                cachedJiras.set(j.key, j);
            } // else no need to update the tickets related to this jira
        } else {
            // if the jira is not in the cache, add it to the cache and update the zendesk ticket
            cachedJiras.set(j.key, j);
            updatedJiras.push(j.key);
        }
    });

    if (updatedJiras.length === 0) {
        log("No JIRAs are different than what is available in cache.");
        return
    }
    log("JIRAs different than available in cache:", updatedJiras);

    if (!tickets?.results) return

    const rawTicketsToUpdate = tickets.results.filter((t) => {
        const jiraKey = zendesk.getJIRAKey(t);

        if (updatedJiras.includes(jiraKey)) return true
    });

    // get the raw zendesk tickets that reference
    // one of the updatedJiras.
    // then update these tickets with the new jira information

    // if jiras have been modified, 
    // get the zendesk tickets that reference the 
    // modified jiras.


    const ticketsToUpdate = rawTicketsToUpdate.map((t) => {
        assert(t.id);
        const jira = cachedJiras.get(zendesk.getJIRAKey(t))!;

        if (jira.resolution && typeof jira.resolution !== "string") {
            jira.resolution = jira.resolution.name
        }

        return {
            id: t.id,
            custom_fields: [{
                id: zendesk.jiraTypeFieldId,
                value: jira.type,
            }, {
                id: zendesk.jiraResolutionFieldId,
                value: jira.resolution,
            }, {
                id: zendesk.jiraFixVersionsFieldId,
                value: jira.fixVersions.length === 0 ? "None" : jira.fixVersions.join(","),
            }]
        }
    })

    // update the zendesk tickets where the props of interest have changed
    await zendesk.updateTickets(ticketsToUpdate);
}


async function main() {
    try {
        validateEnv();
        log("Starting the NuoDB JIRA to Zendesk Sync Server...");
        
        await pollAndSync();   // makes sure that all zendesk tickets are in sync with their JIRAs at the start
        
        const RECENT_INTERVAL = 30 * 1000;
        const FULL_INTERVAL = 30 * 60 * 1000;
        setInterval(() => pollAndSync({ recent: true }), RECENT_INTERVAL); // every 30 seconds
        setInterval(() => pollAndSync(), FULL_INTERVAL); // every 30 minutes to guarantee that all tickets are in sync, in case any were not caught by the recent check
    
    } catch (err) {
        log(`Startup error: ${err instanceof Error ? err.stack : err}`);
    }
}

main();



