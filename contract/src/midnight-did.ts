// This file is part of midnightntwrk/example-counter.
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

import { z } from "zod/v4-mini";

import { DIDStringSchema } from "./did-document";

export enum MidnightNetwork {
  Undeployed = "undeployed",
  DevNet = "devnet",
  Testnet = "testnet",
  Mainnet = "mainnet"
}

const NETWORKS = [
  MidnightNetwork.Undeployed,
  MidnightNetwork.DevNet,
  MidnightNetwork.Testnet,
  MidnightNetwork.Mainnet
] as const;

const HEX_MIDNIGHT_ADD_REGEX = /^[0-9a-f]{68}$/; //TODO: claify with the Midnight team

export const ContractAddressSchema = z
  .string()
  .check(
    z.regex(HEX_MIDNIGHT_ADD_REGEX, {
      error: "Invalid contract address: must be 68 lowercase hex characters"
    })
  )
  .brand("ContractAddress");

export type ContractAddress = z.infer<typeof ContractAddressSchema>;

/**
 * Schema that validates and parses Midnight DIDs.
 * Format:
 * - did:midnight:<network>:<id>
 */
export const MidnightDIDStringSchema = DIDStringSchema.check(
  z.refine(
    (val) => val.startsWith("did:midnight:") && val.split(":").length == 4,
    {
      error:
        "Invalid MidnightDID string, expected format 'did:midnight:<network>:<id>",
      abort: true
    }
  ),
  z.refine(
    (val) => {
      const parts = val.split(":");
      const [, , network, id] = parts;
      const contractAddress = ContractAddressSchema.parse(id);
      return NETWORKS.includes(network as MidnightNetwork);
    },
    { error: "Invalid MidnightDID string" }
  )
).brand("MidnightDIDString");

export type MidnightDIDString = z.infer<typeof MidnightDIDStringSchema>;

export function parseMidnightDIDString(input: unknown): MidnightDIDString {
  return MidnightDIDStringSchema.parse(input as string);
}

export const MidnightDIDSchema = z.pipe(
  MidnightDIDStringSchema,
  z.transform((raw) => {
    const parts = raw.split(":");
    const network = parts[2];
    const id = parts[3];
    return {
      raw,
      network,
      id
    };
  })
);

export type MidnightDID = z.infer<typeof MidnightDIDSchema>;

export function parseContractAddress(input: unknown): ContractAddress {
  return ContractAddressSchema.parse(input as string);
}

export function parseMidnightDID(input: unknown): MidnightDID {
  return MidnightDIDSchema.parse(input as string);
}

export function createMidnightDIDString(
  id: ContractAddress,
  network: MidnightNetwork
): MidnightDIDString {
  return MidnightDIDStringSchema.parse(`did:midnight:${network}:${id}`);
}
