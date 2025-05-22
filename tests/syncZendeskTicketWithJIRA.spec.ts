import assert from "assert";
import { test, beforeAll, afterAll, expect } from "@jest/globals";
import zendesk from "zendesk";
import { wait } from "./helpers";

interface RefJiraProps {
    key: string,
    fixVersions: string,
    type: string,
    resolution: string
}

// reference JIRA props to find as value on Zendesk. 
//* Keep adding to this array
const js: RefJiraProps[] = [{
    key: "DB-38283",
    fixVersions: "None",
    type: "Bug",
    resolution: "Not A Bug"
}, {
    key: "DB-38282",
    fixVersions: "None",
    type: "Bug",
    resolution: "Incomplete"
}, {
    key: "DB-38209",
    resolution: "Not A Bug",
    fixVersions: "None",
    type: "Customer Support Request"
}, {
    key: "TF-15",
    resolution: "Fixed",
    fixVersions: "1.0.0",
    type: "Task"
}, {
    key: "DOC-4182",
    resolution: "Task Complete",
    fixVersions: "6.0.1",
    type: "Task"
}, {
    key: "DOC-4116",
    resolution: "Task Complete",
    fixVersions: "6.0,5.1",
    type: "Task"
}];

let ticketIds: number[] = [];

beforeAll(async () => {
    for (let idx = 0; idx < js.length; idx++) {
        const ticket = await zendesk.createTicket();
        expect(ticket).toBeDefined();
        assert(ticket.id);
        ticketIds.push(ticket.id);
    }
});

afterAll(async () => {
    for (let idx = 0; idx < js.length; idx++) {
        const ticketId = ticketIds[idx];
        assert(ticketId);
        await zendesk.deleteTicket(ticketId);
    }
});


test("syncs zendesk tickets with respective JIRA", async () => {

    // set the ticket's "JIRA or Github" field
    // link it to a resolved/stable JIRA with known properties
    for (let idx = 0; idx < js.length; idx++) {
        const j = js[idx];
        assert(j);
        const ticketId = ticketIds[idx];
        assert(ticketId);
        await zendesk.updateTickets([{
            id: ticketId,
            custom_fields: [{
                id: zendesk.jiraOrGithubCustomFieldId,
                value: j.key
            }]
        }]);
    }
    
    // check that after a minute the zendesk ticket's JIRA fields are set and match the known properties
    await wait(90000);
    
    for (let idx = 0; idx < js.length; idx++) {
        const j = js[idx];
        assert(j);
        const ticketId = ticketIds[idx];
        assert(ticketId);
        const ticket = await zendesk.getTicket(ticketId);
        expect(ticket.custom_fields?.find(cf => cf.id === zendesk.jiraResolutionFieldId)?.value).toBe(j.resolution);
        expect(ticket.custom_fields?.find(cf => cf.id === zendesk.jiraTypeFieldId)?.value).toBe(j.type);
        expect(ticket.custom_fields?.find(cf => cf.id === zendesk.jiraFixVersionsFieldId)?.value).toBe(j.fixVersions);
    }

}, 100000);


// test("internal note is shown with error message upon issue", () => {

// });