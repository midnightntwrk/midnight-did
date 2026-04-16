import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";

import { jubjubPointX, jubjubPointY } from "@midnight-ntwrk/compact-runtime";
import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

import type {
  DeployedMidnightDIDContract,
  MidnightDIDProviders,
} from "../../api/src/index.js";
import {
  addVerificationMethod,
  addVerificationMethodRelation,
  createDID,
  initPrivateState,
  resolve,
} from "../../api/src/index.js";
import { encodeFieldElement } from "../../domain/src/crypto-codecs.js";
import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "../../domain/src/index.js";
import { TIMEOUTS } from "./standalone-config.js";

type Role = "issuer" | "holder" | "verifier";

export interface ProtocolDidProfile {
  readonly role: Role;
  readonly didString: string;
  readonly contractAddress: string;
  readonly contract: DeployedMidnightDIDContract;
  readonly verificationMethodRef: string;
  readonly verificationMethodRefValue: {
    didContractAddress: { bytes: Uint8Array };
    methodId: Uint8Array;
  };
}

export const verifierChallengeForProfile = (
  didString: string,
  purpose: string,
): Uint8Array =>
  new Uint8Array(
    createHash("sha256")
      .update(`midnight:vc:verifier:${didString}:${purpose}`)
      .digest(),
  );

const hexToBytes = (value: string): Uint8Array =>
  Uint8Array.from(Buffer.from(value, "hex"));

const padText = (value: string, length = 32): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length >= length) return bytes.subarray(0, length);
  const padded = new Uint8Array(length);
  padded.set(bytes);
  return padded;
};

const methodJwkFromSigner = (publicKey: JubjubPoint) => ({
  kty: KeyType.EC,
  crv: CurveType.Jubjub,
  x: encodeFieldElement(jubjubPointX(publicKey)),
  y: encodeFieldElement(jubjubPointY(publicKey)),
});

const createDidWithDustRetry = async (
  providers: MidnightDIDProviders,
  retries = TIMEOUTS.didCreationRetries,
  delayMs = TIMEOUTS.didCreationRetryDelay,
): Promise<DeployedMidnightDIDContract> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await createDID(providers, await initPrivateState(providers));
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === retries ||
        !/Not enough Dust generated to pay the fee|could not balance dust/i.test(
          message,
        )
      ) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

/**
 * Deploy a DID contract, register a verification method, and return
 * the complete profile with on-chain verification method reference.
 */
export const provisionDidProfile = async (
  providers: MidnightDIDProviders,
  role: Role,
  signer: { publicKey: JubjubPoint },
  logPrefix: string,
): Promise<ProtocolDidProfile> => {
  console.info(`[${logPrefix}] deploying ${role} DID`);
  const contract = await createDidWithDustRetry(providers);

  console.info(`[${logPrefix}] resolving ${role} DID`);
  const resolutionBeforeMethod = await resolve(providers, contract);
  const didString = resolutionBeforeMethod?.didDocument.id;
  if (didString === undefined) {
    throw new Error(`Failed to resolve ${role} DID after deployment`);
  }

  const verificationMethodRef = `${didString}#${role}-key-1`;
  console.info(`[${logPrefix}] publishing verification method for ${role}`);
  await addVerificationMethod(
    contract,
    createVerificationMethod({
      id: verificationMethodRef,
      type: VerificationMethodType.JsonWebKey,
      controller: didString,
      publicKeyJwk: methodJwkFromSigner(signer.publicKey),
    }),
  );

  await addVerificationMethodRelation(
    contract,
    providers,
    role === "issuer"
      ? VerificationMethodRelationType.AssertionMethod
      : VerificationMethodRelationType.Authentication,
    verificationMethodRef,
  );

  console.info(`[${logPrefix}] re-resolving ${role} DID`);
  const resolution = await resolve(providers, contract);
  if (!resolution) {
    throw new Error(`Failed to re-resolve ${role} DID after adding method`);
  }

  const methodFound = resolution.didDocument.verificationMethod?.some(
    (method) => method.id === verificationMethodRef,
  );
  if (!methodFound) {
    throw new Error(
      `Verification method ${verificationMethodRef} not found in resolved DID document`,
    );
  }

  return {
    role,
    didString,
    contractAddress: contract.deployTxData.public.contractAddress,
    contract,
    verificationMethodRef,
    verificationMethodRefValue: {
      didContractAddress: {
        bytes: hexToBytes(contract.deployTxData.public.contractAddress),
      },
      methodId: padText(verificationMethodRef.slice(didString.length)),
    },
  };
};
