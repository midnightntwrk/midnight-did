import { type Logger } from "pino";

const defaultLogger = {
  info: () => undefined,
} as unknown as Logger;

let logger: Logger = defaultLogger;

export const getLogger = (): Logger => logger;

export function setLogger(_logger: Logger): void {
  logger = _logger;
}
