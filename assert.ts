export default function assert(truthy: any, ...message: string[]): asserts truthy {
    if (truthy) return;
    if (message.length === 0) throw `${truthy} is not truthy`;
    throw message.join(" ");
}