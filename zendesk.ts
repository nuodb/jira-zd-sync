import log from "log";
import type { components, paths } from "zendesk-openapi";
import createClient from "openapi-fetch";
import assert from "assert";

// aliasing global fetch to avoid collision with zendesk.fetch
const ftch = fetch;

namespace zendesk {

    export const jiraOrGithubCustomFieldId = Number(Bun.env.JIRA_OR_GITHUB_CUSTOM_FIELD_ID);
    export const jiraTypeFieldId = Number(Bun.env.JIRA_TYPE_FIELD_ID);  // "JIRA Type" field
    export const jiraResolutionFieldId = Number(Bun.env.JIRA_RESOLUTION_FIELD_ID);  // "JIRA Resolution" field
    export const jiraFixVersionsFieldId = Number(Bun.env.JIRA_FIX_VERSIONS_FIELD_ID);  // "JIRA Fix Versions" field

    //@ts-ignore
    export const auth = btoa(`${Bun.env.ZENDESK_EMAIL}/token:${Bun.env.ZENDESK_APITOKEN}`);

    export const client = createClient<paths>({
        baseUrl: `${Bun.env.ZENDESK_DOMAIN}`,
        headers: {
            'Content-Type': "application/json",
            "Authorization": `Basic ${auth}`
        }
    });


    export interface ZendeskResponse {
        ok: boolean,
        url: string,
        status: number,
        statusText: string,
        redirected: boolean,
        bodyUsed: boolean,
        json: () => any
    };



    export interface TicketsResponse {
        readonly count?: number;
        readonly facets?: string | null;
        readonly next_page?: string | null;
        readonly previous_page?: string | null;
        results?: (
            components["schemas"]["SearchResultObject"]
            & { custom_fields: { id: number, value: any }[] }
        )[];
    }

    export function fetch(input: string | Request, init?: Omit<BunFetchRequestInit, 'headers'>): Promise<ZendeskResponse> {
        return ftch(`${Bun.env.ZENDESK_DOMAIN}${input}`, {
            headers: {
                'Content-Type': "application/json",
                "Authorization": `Basic ${auth}`
            },
            ...init
        }) as unknown as Promise<ZendeskResponse>;
    }

    export async function getTicket(ticketId: number) {
        const { data, error } = await client.GET(`/api/v2/tickets/{ticket_id}`, {
            params: {
                path: { ticket_id: ticketId }
            }
        });

        error && log("erred", error);
        assert(data && data.ticket, "failed to get the ticket by id " + ticketId);
        const { ticket } = data;

        return ticket
    }

    const defaultTicket = {
        ticket: {
            subject: "Ticket for testing jira to zendesk sync server",
            comment: {
                body: "pass a ticket to createTicket function if desired to set a first specific comment"
            },
            priority: "normal",
        }
    };

    export async function createTicket(ticket: typeof defaultTicket = defaultTicket): Promise<components["schemas"]["TicketObject"]> {
        const body = JSON.stringify(ticket);

        const response = await fetch("/api/v2/tickets", {
            method: "POST",
            body,
        });
        if (!response.ok) {
            throw new Error(`Failed to create ticket: ${response.statusText}`);
        }

        const data = await response.json();
        assert(data);
        assert(data.ticket, "data.ticket is not defined:", JSON.stringify(data, null, 1));
        return data.ticket;
    };




    /**
     * Get the Zendesk tickets that are not solved or closed that have the "JIRA or Github" field set.
     * @returns 
     */
    export async function getTickets(recent = false): Promise<any[]> {

        // if recent, only get tickets that have been updated in the last 60 seconds
        const recencyClause = recent ? `updated>${new Date(new Date().getTime() - 60 * 1000).toISOString()}` : "";
        const query = `type:ticket status<closed ${recencyClause} custom_field_${jiraOrGithubCustomFieldId}:*`

        const { data, error } = await client.GET(`/api/v2/search`, {
            params: { query: { query } }
        });

        if (error || !data.results) {
            log("Error polling:", error);
            return []
        }

        if (!("results" in data)) return []
        if (data.results.length === 0) {
            log("No tickets found by query", query, JSON.stringify(data));
            return []
        }

        log(`Tickets that are not closed that have a JIRA field set${recent ? " and the zendesk ticket was recently updated" : ""}:`, data.results.map((t) => t.id));

        return data.results || data as TicketsResponse['results']
    }


    /**
     * 
     * @param ticket 
     * @returns e.g. 'DB-40467'
     */
    export function getJIRAKey(ticket: NonNullable<zendesk.TicketsResponse['results']>[number]): string {
        const jira = ticket.custom_fields.find((field) => field.id === zendesk.jiraOrGithubCustomFieldId);

        let jiraKey: string = jira?.value;
        if (jiraKey.includes("nuojira")) {
            jiraKey = jiraKey.slice(jiraKey.lastIndexOf("/") + 1);
        }
        return jiraKey
    }



    export async function deleteTicket(ticketId: number) {
        const { response, data, error } = await client.DELETE(`/api/v2/tickets/{ticket_id}`, {
            params: {
                path: { ticket_id: ticketId }
            }
        });
        if (error) {
            throw new Error(`Failed to delete ticket: ${error}`);
        }

    }

    export interface ZendeskUpdateTicket {
        id: number,
        custom_fields: NonNullable<TicketsResponse['results']>[number]['custom_fields']
    }


    export async function updateTickets(ticketsToUpdate: ZendeskUpdateTicket[]) {

        const body = {
            tickets: ticketsToUpdate
        };

        log("Updating JIRA props for zendesk tickets", body);
        const response = (await fetch(`/api/v2/tickets/update_many`, {
            method: "PUT",
            body: JSON.stringify(body)
        }));

        if (!response.ok) {
            log("Error updating tickets with status:", response.statusText);
        } else {
            log("Updated tickets:", body.tickets.map((t) => t.id));
        }
    }
}


export default zendesk