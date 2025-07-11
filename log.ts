const env = Bun.env.NODE_ENV || Bun.env.BUN_ENV;
const isDev = env === "development" || env === "test";
const logPrefix = isDev ? "dev-" : "";
let writer: any;
try {
    const logFile = Bun.file(`./logs/${logPrefix}sync-${(new Date()).toISOString()}.log`);
    writer = logFile.writer();
} catch (err) {
    console.error("Failed to create log file or writer:", err);
    writer = null;
}

// Ensure logs directory exists using shell command as fallback for Bun
try {
    Bun.spawnSync(["mkdir", "-p", "./logs"]);
} catch (err) {
    console.error("Failed to create logs directory via shell:", err);
}

export default function log(...args: any[]) {
    const prefix = "[" + (new Date()).toISOString() + " UTC]:";
    console.log(prefix, ...args);
    // append to sync.log
    const message = prefix + " " + JSON.stringify(args) + "\n";
    if (writer) {
        try {
            writer.write(message);
        } catch (err) {
            console.error("Failed to write to log file:", err);
        }
    }
}
