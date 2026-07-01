import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import pino from "pino";
import pinoPretty from "pino-pretty";
export const BigIntReplacer = (_key, value) => typeof value === "bigint" ? value.toString() : value;
export const createLogger = async (logPath) => {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    const pretty = pinoPretty({
        colorize: true,
        sync: true,
    });
    const level = process.env.DEBUG_LEVEL !== undefined &&
        process.env.DEBUG_LEVEL !== null &&
        process.env.DEBUG_LEVEL !== ""
        ? process.env.DEBUG_LEVEL
        : "info";
    return pino({
        level,
        depthLimit: 20,
    }, pino.multistream([
        { stream: pretty, level },
        { stream: createWriteStream(logPath), level },
    ]));
};
//# sourceMappingURL=logger-utils.js.map