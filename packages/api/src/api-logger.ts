import pino, { type Logger } from "pino";

const defaultLogger: Logger = pino({ level: "silent" });

let logger: Logger = defaultLogger;

export const getLogger = (): Logger => logger;

export function setLogger(_logger: Logger): void {
  logger = _logger;
}
