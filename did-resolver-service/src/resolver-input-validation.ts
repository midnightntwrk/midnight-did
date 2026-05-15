import { ResolverInputError } from "./resolution-errors.js";

export const RESOLVER_DID_MAX_LENGTH = 96;
export const RESOLVER_DID_PATTERN =
  "^did:midnight:(undeployed|devnet|testnet|mainnet|preview|preprod):[0-9a-fA-F]{64}$";

const resolverDidRegex = new RegExp(RESOLVER_DID_PATTERN);

export const assertResolverDidInput = (did: string): void => {
  // Keep a cheap length guard before regex/schema parsing so oversized input
  // gets a stable diagnostic even though the regex is anchored and safe.
  if (did.length > RESOLVER_DID_MAX_LENGTH) {
    throw new ResolverInputError("Midnight DID exceeds maximum length");
  }

  if (!resolverDidRegex.test(did)) {
    throw new ResolverInputError("Invalid Midnight DID format");
  }
};
