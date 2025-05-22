
const logFile = Bun.file(`./logs/sync-${(new Date()).toISOString()}.log`);
const writer = logFile.writer();

export default function log(...args: any[]) {
    const prefix = "[" + (new Date()).toISOString() + " UTC]:";
    console.log(prefix, ...args);
    // append to sync.log
    const message = prefix + " " + JSON.stringify(args) + "\n";
    writer.write(message);
}
