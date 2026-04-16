import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

import type { VerificationMethodRef } from "../../../credentials/src/managed/credentials/contract/index.js";

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodRef: VerificationMethodRef;
};

export type PartyRole = "issuer" | "holder" | "verifier";

export type DIDProfile = {
  readonly role: PartyRole;
  readonly label: string;
  readonly signer: Signer;
};
