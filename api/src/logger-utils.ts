import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import pino from "pino";
import pinoPretty from "pino-pretty";

export const BigIntReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

const SECRET_REDACTION_PATHS = [
  "seed",
  "*.seed",
  "*.*.seed",
  "*.*.*.seed",
  "mnemonic",
  "*.mnemonic",
  "*.*.mnemonic",
  "*.*.*.mnemonic",
  "secretKey",
  "*.secretKey",
  "*.*.secretKey",
  "*.*.*.secretKey",
  "privateKey",
  "*.privateKey",
  "*.*.privateKey",
  "*.*.*.privateKey",
  "password",
  "*.password",
  "*.*.password",
  "*.*.*.password",
] as const;

export const createLogger = async (logPath: string): Promise<pino.Logger> => {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const pretty: pinoPretty.PrettyStream = pinoPretty({
    colorize: true,
    sync: true,
  });
  const level =
    process.env.DEBUG_LEVEL !== undefined &&
    process.env.DEBUG_LEVEL !== null &&
    process.env.DEBUG_LEVEL !== ""
      ? process.env.DEBUG_LEVEL
      : "info";
  return pino(
    {
      level,
      depthLimit: 20,
      redact: {
        paths: [...SECRET_REDACTION_PATHS],
        censor: "[Redacted]",
      },
    },
    pino.multistream([
      { stream: pretty, level },
      { stream: createWriteStream(logPath), level },
    ]),
  );
};
