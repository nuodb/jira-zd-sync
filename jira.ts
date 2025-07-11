import { type cachedJiras } from "index";
import log from "log";


namespace jira {


    export interface TypeField {
        self: string, // e.g. "http://nuojira.dsone.3ds.com/rest/api/2/issuetype/10100"
        id: `${number}`, // e.g. "10100"
        description: string,
        iconUrl: string,
        name: string,   // e.g. "Customer Support Request"
        subtask: boolean,
        avatarId: number,
    }

    export interface FixVersionsField {
        self: string, // e.g. "http://nuojira.dsone.3ds.com/rest/api/2/version/16863"
        id: `${number}`, // e.g. "16863"
        name: string, // e.g. "7.0-dev"
        archived: boolean,
        released: boolean,
    }

    export interface Fields {
        [fieldKey: string]: unknown,
        issuetype: TypeField,
        fixVersions: FixVersionsField[],
        resolution: ResolutionType,
        // summary: string,
        // updated: 
    }

    export type ResolutionType = string | null | {
        self: string,
        id: `${number}`,
        description: string,
        name: string    // e.g. "Not A Bug"
    }

    export interface Issue {
        expand: string,
        id: `${number}`, // e.g. "72855"
        self: string, // address of the issue through API, e.g. "http://nuojira.dsone.3ds.com/rest/api/2/issue/72855"
        key: string, // e.g. "DB-40467"
        fields: Fields,
    }

    export interface Response {
        expand: "names,schema",
        startAt: 0,
        maxResults: 50,
        total: 1,
        issues: Issue[],
    };

    export interface PropsForZendesk {
        key: string, // e.g. "DB-40467"
        type: string,   // e.g. "Customer Support Request"
        resolution: ResolutionType,
        fixVersions: string[],
    }

    export const apiToken = Bun.env.JIRA_TOKEN;

    export async function getJIRAs(issueKeys: string[]): Promise<PropsForZendesk[]> {

        if (issueKeys.length === 0) return [];

        const quotedKeys = issueKeys.map(k => `"${k}"`).join(", ");
        const jql = encodeURIComponent(`issuekey in (${quotedKeys})`);
        const fields = ["issuetype", "resolution", "fixVersions"];

        // const response: any = await fetch("http://nuojira.dsone.3ds.com/rest/api/2/search?reporter%20=%20currentUser()%20ORDER%20BY%20created%20DESC", {
        const response: any = await fetch(`${Bun.env.JIRA_DOMAIN}/rest/api/2/search?jql=${jql}&fields=${fields.join(",")}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${apiToken}`,
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`JIRA fetch failed: ${response.status} ${errorText}`);
        }

        const data: Response = await response.json();
        log("Issues got: ", data)

        const processedIssues: PropsForZendesk[] = data.issues.map((issue) => ({
            id: issue.id,
            key: issue.key,
            type: issue.fields.issuetype.name,
            resolution: issue.fields.resolution ?? "Unresolved", //!!! the result might actually be an object, and we'd get the `.name`
            fixVersions: issue.fields.fixVersions.map((v: any) => v.name),
        }));

        return processedIssues;
    }

    //? doesn't work for just any field.
    export async function updateJira(issueKey: string, body: string): Promise<void> {

        log("Updating JIRA issue:", issueKey, body);

        const response: any = await fetch(`${Bun.env.JIRA_DOMAIN}/rest/api/2/issue/${issueKey}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body
        });
        if (!response.ok) {
            const data: Response = await response.json();
            log("Error updating jira issue:", data);
            throw "Failed updating jira issue"
        }

        const data: Response = await response.json();
        log("Updated JIRA: ", data);

    }

    export async function getVersions() {
        const projectKey = "SUP"; // Replace with your project key
        const response = await fetch(`${Bun.env.JIRA_DOMAIN}/rest/api/2/project/${projectKey}/versions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jira.apiToken}`,
                'Accept': 'application/json'
            }
        })
        log(response);
        //@ts-ignore
        const target = await response.json();
        if (target) {
            log("Version ID:", target);
        } else {
            log("Version 7.0 not found.");
        }
    }

    export async function getRecentlyChangedJIRAs(jiras: cachedJiras): Promise<PropsForZendesk[]> {
        
        // poll for the latest changed tickets
        // e.g. ["PROJ-1", "PROJ-2", "PROJ-3"];
        //? All issues, in order of modified:
        // const recencyClause = recent ? `AND updated >= -2m`: "";
        const recencyClause = `AND updated >= -2m`;
        const jiraKeys = jiras.keys().toArray();
        if (jiraKeys.length === 0) return [];
        // log("JIRAKEYS:", jiraKeys);
        const jql = `issuekey in (${jiraKeys.map(k => `"${k}"`).join(",")}) ${recencyClause} ORDER BY updated DESC`;

        // const response: any = await fetch("http://nuojira.dsone.3ds.com/rest/api/2/search?reporter%20=%20currentUser()%20ORDER%20BY%20created%20DESC", {
        // const response: any = await fetch(`${Bun.env.JIRA_DOMAIN}/rest/api/2/search?jql=${jql}&fields=${fields.join(",")}`, {

        const fields = ["summary", "status", "updated", "issuetype", "resolution", "fixVersions"];
        const response: any = await fetch(`${Bun.env.JIRA_DOMAIN}/rest/api/2/search`, {
            method: "POST",
            headers: {
                'Authorization': `Bearer ${jira.apiToken}`,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                jql,
                maxResults: 10,
                fields
            })
        });
        if (!response.ok) {
            log("Error fetching issues:", response.statusText);
        }
        const data: Response = await response.json();
        log("Recently updated issues:", data);
        data.issues.forEach(issue => {
            log(`${issue.key}: updated at ${issue.fields.updated}`);
        });

        const processedIssues: PropsForZendesk[] = data.issues.map((issue) => ({
            id: issue.id,
            key: issue.key,
            type: issue.fields.issuetype.name,
            resolution: issue.fields.resolution ?? "Unresolved", //!!! the result might actually be an object, and we'd get the `.name`
            fixVersions: issue.fields.fixVersions.map((v: any) => v.name),
        }));

        return processedIssues;
    }

}

export default jira;