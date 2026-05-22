import { type Logger } from "pino";

let logger: Logger;

export const getLogger = (): Logger => logger;

export function setLogger(_logger: Logger): void {
  logger = _logger;
}
