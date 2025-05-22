import assert from "assert";
import { test, beforeAll, afterAll, expect } from "@jest/globals";
import zendesk from "zendesk";
import jira from "jira";
import versions from "./mock/jiraVersions";
import { wait } from "./helpers";

let zTicketId: undefined | number;

const fixVersions = [versions.find(v => v.name === "1.0")];
assert(fixVersions);
const testJira = {
    key: "SUP-1488",
    fields: {
        resolution: "Unresolved",
        fixVersions
    }
}

beforeAll(async () => {
    const ticket = await zendesk.createTicket();
    expect(ticket).toBeDefined();
    zTicketId = ticket.id;

    await zendesk.updateTickets([{
        id: zTicketId!,
        custom_fields: [{
            id: zendesk.jiraOrGithubCustomFieldId,
            value: testJira.key
        }]
    }]);
});

afterAll(async () => {
    assert(zTicketId);
    await jira.updateJira(testJira.key, JSON.stringify({
        fields: {
            fixVersions: []
        }
    }))
    await zendesk.deleteTicket(zTicketId);
});


test("Zendesk syncs with the JIRA issue's fixVersions field being updated", async () => {
    assert(zTicketId);

    const jIssues = await jira.getJIRAs([testJira.key]);
    assert(jIssues[0]);
    const jIssue = jIssues[0];

    assert(jIssue.type === "Customer Support Request");
    assert(jIssue.fixVersions.length === 0);
    assert(jIssue.resolution === "Unresolved");

    // update the JIRA issue's fixVersion
    await jira.updateJira(testJira.key, JSON.stringify({
        fields: {
            fixVersions: testJira.fields.fixVersions
        }
    }));


    console.debug("waiting for zendesk ticket to sync to the jira update");
    await wait(80000);

    // get the Zendesk ticket again after X time and see if the fixVersions value was updated.
    const ticket = await zendesk.getTicket(zTicketId);
    // console.debug("Ticket:", ticket); //!
    expect(ticket.custom_fields?.find(cf => cf.id === zendesk.jiraFixVersionsFieldId)?.value).not.toBe("None");
    expect(ticket.custom_fields?.find(cf => cf.id === zendesk.jiraFixVersionsFieldId)?.value).toBe("1.0");

}, 90000);





