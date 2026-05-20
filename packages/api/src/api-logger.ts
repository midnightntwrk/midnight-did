import { type Logger } from "pino";

import { setLightweightLogger } from "./lightweight.js";

let logger: Logger;

export const getLogger = (): Logger => logger;

export function setLogger(_logger: Logger): void {
  logger = _logger;
  setLightweightLogger(_logger);
}
