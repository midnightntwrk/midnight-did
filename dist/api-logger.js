import pino from "pino";
const defaultLogger = pino({ level: "silent" });
let logger = defaultLogger;
export const getLogger = () => logger;
export function setLogger(_logger) {
    logger = _logger;
}
//# sourceMappingURL=api-logger.js.map