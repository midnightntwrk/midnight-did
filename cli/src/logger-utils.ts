// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import pino from 'pino';
import pinoPretty from 'pino-pretty';

const SECRET_REDACTION_PATHS = [
  'seed',
  '*.seed',
  '*.*.seed',
  '*.*.*.seed',
  'mnemonic',
  '*.mnemonic',
  '*.*.mnemonic',
  '*.*.*.mnemonic',
  'secretKey',
  '*.secretKey',
  '*.*.secretKey',
  '*.*.*.secretKey',
  'privateKey',
  '*.privateKey',
  '*.*.privateKey',
  '*.*.*.privateKey',
  'password',
  '*.password',
  '*.*.password',
  '*.*.*.password',
] as const;

export const createLogger = async (logPath: string): Promise<pino.Logger> => {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const pretty: pinoPretty.PrettyStream = pinoPretty({
    colorize: true,
    sync: true,
  });
  const level =
    process.env.DEBUG_LEVEL !== undefined && process.env.DEBUG_LEVEL !== null && process.env.DEBUG_LEVEL !== ''
      ? process.env.DEBUG_LEVEL
      : 'info';
  return pino(
    {
      level,
      depthLimit: 20,
      redact: {
        paths: [...SECRET_REDACTION_PATHS],
        censor: '[Redacted]',
      },
    },
    pino.multistream([
      { stream: pretty, level },
      { stream: createWriteStream(logPath), level },
    ]),
  );
};
