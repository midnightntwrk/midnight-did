import type { VerificationMethodRef } from "../../../credentials/src/managed/credentials/contract/index.js";
import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

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
