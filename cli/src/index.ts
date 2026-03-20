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

export * from './api';
export * from './cli';
export { CliDidService } from './cli-api/service';
export {
  type ActionHint,
  type AddMethodFromKeyInput,
  type AddRelationInput,
  type AddServiceInput,
  type AliasInput,
  CliDidState,
  type CliServiceOptions,
  type CommandResult,
  type GuardResult,
  type LedgerSnapshot,
  type RemoveRelationInput,
  type RemoveServiceInput,
  type StateContext,
  type UpdateMethodFromKeyInput,
  type UpdateServiceInput,
} from './cli-api/types';
export * from './config';
export {
  type DeriveKeyFromSeedInput,
  FileSecretStore,
  type GenerateKeyInput,
  type ImportKeyInput,
  type MidnightCurve,
  type MidnightKeyType,
  type PublicJwk,
  type SecretStorage,
  SigningNotSupportedError,
  type StoredKeyMeta,
  VeramoSecretStore,
} from '@midnight-ntwrk/midnight-did-secret-storage';
