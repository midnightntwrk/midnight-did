import { ProvableCircuitId } from "@midnight-ntwrk/compact-js";

import type { MidnightDIDCircuits, MidnightDIDContract } from "./types";

export const MIDNIGHT_DID_CONTRACT_NAME = "did" as const;

type GeneratedCircuitName = Extract<
  keyof MidnightDIDContract["circuits"],
  string
>;
type GeneratedProofCircuitName = Extract<
  keyof MidnightDIDContract["provableCircuits"],
  string
>;
type GeneratedPureCircuitName = Exclude<
  GeneratedCircuitName,
  GeneratedProofCircuitName
>;

// Pure circuits are callable without prover/verifier key assets.
export const MIDNIGHT_DID_PURE_CIRCUIT_NAMES = [
  "publicKey",
] as const satisfies readonly GeneratedPureCircuitName[];

// Proof circuits must have matching prover/verifier key assets.
export const MIDNIGHT_DID_PROOF_CIRCUIT_NAMES = [
  "addAlsoKnownAs",
  "removeAlsoKnownAs",
  "addVerificationMethod",
  "updateVerificationMethod",
  "removeVerificationMethod",
  "addVerificationMethodRelation",
  "removeVerificationMethodRelation",
  "addService",
  "updateService",
  "removeService",
  "deactivate",
] as const satisfies readonly GeneratedProofCircuitName[];

export const MIDNIGHT_DID_CIRCUIT_NAMES = [
  ...MIDNIGHT_DID_PURE_CIRCUIT_NAMES,
  ...MIDNIGHT_DID_PROOF_CIRCUIT_NAMES,
] as const satisfies readonly GeneratedCircuitName[];

export type MidnightDIDPureCircuitName =
  (typeof MIDNIGHT_DID_PURE_CIRCUIT_NAMES)[number];
export type MidnightDIDProofCircuitName =
  (typeof MIDNIGHT_DID_PROOF_CIRCUIT_NAMES)[number];
export type MidnightDIDCircuitName =
  (typeof MIDNIGHT_DID_CIRCUIT_NAMES)[number];

type AssertNoMissingCircuits<MissingCircuits extends never> = MissingCircuits;

/** @internal Compile-time guard: all generated pure circuits are registered. */
export type MidnightDIDPureCircuitRegistryIsComplete = AssertNoMissingCircuits<
  Exclude<GeneratedPureCircuitName, MidnightDIDPureCircuitName>
>;
/** @internal Compile-time guard: all generated proof circuits are registered. */
export type MidnightDIDProofCircuitRegistryIsComplete = AssertNoMissingCircuits<
  Exclude<GeneratedProofCircuitName, MidnightDIDProofCircuitName>
>;
/** @internal Compile-time guard: every generated circuit is registered. */
export type MidnightDIDCircuitRegistryIsComplete = AssertNoMissingCircuits<
  Exclude<GeneratedCircuitName, MidnightDIDCircuitName>
>;

export const midnightDIDProofCircuitId = (
  circuitName: MidnightDIDProofCircuitName,
): MidnightDIDCircuits => ProvableCircuitId<MidnightDIDContract>(circuitName);

export const MIDNIGHT_DID_PROOF_CIRCUIT_IDS: Readonly<
  Record<MidnightDIDProofCircuitName, MidnightDIDCircuits>
> = Object.freeze(
  Object.fromEntries(
    MIDNIGHT_DID_PROOF_CIRCUIT_NAMES.map((circuitName) => [
      circuitName,
      midnightDIDProofCircuitId(circuitName),
    ]),
  ) as Record<MidnightDIDProofCircuitName, MidnightDIDCircuits>,
);
