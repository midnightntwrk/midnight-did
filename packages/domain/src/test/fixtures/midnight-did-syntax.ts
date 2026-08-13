export const LEDGER_NETWORKS = [
  "undeployed",
  "devnet",
  "testnet",
  "mainnet",
  "preview",
  "preprod",
] as const;

export const VALID_IDENTIFIER =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export const validLedgerDids = LEDGER_NETWORKS.map(
  (network) => `did:midnight:${network}:${VALID_IDENTIFIER}`,
);

export const validOffchainShortDid = `did:midnight:offchain:${"a".repeat(64)}`;

export const validOffchainSyntacticLongDid = `${validOffchainShortDid}:AQIDBA`;

export const validOffchainSyntacticLongDidWithUrlSafeChars = `${validOffchainShortDid}:-_AQIDBA`;

export const invalidSyntaxFixtures = [
  {
    label: "invalid method name",
    did: `did:example:testnet:${VALID_IDENTIFIER}`,
    error: /Invalid input|Invalid Midnight DID/,
  },
  {
    label: "uppercase DID scheme",
    did: `DID:midnight:testnet:${VALID_IDENTIFIER}`,
    error: /Invalid input|Invalid Midnight DID/,
  },
  {
    label: "uppercase method name",
    did: `did:MIDNIGHT:testnet:${VALID_IDENTIFIER}`,
    error: /Invalid input|Invalid Midnight DID/,
  },
  {
    label: "missing network",
    did: `did:midnight::${VALID_IDENTIFIER}`,
    error: /Invalid Midnight DID format|Unknown network/,
  },
  {
    label: "unsupported network",
    did: `did:midnight:unknown:${VALID_IDENTIFIER}`,
    error: /Unknown network/,
  },
  {
    label: "leading whitespace",
    did: ` did:midnight:testnet:${VALID_IDENTIFIER}`,
    error: /Invalid input|Invalid Midnight DID/,
  },
  {
    label: "trailing whitespace",
    did: `did:midnight:testnet:${VALID_IDENTIFIER} `,
    error: /Invalid input|method-specific identifier/,
  },
  {
    label: "ledger identifier too short",
    did: `did:midnight:testnet:${VALID_IDENTIFIER.slice(0, -1)}`,
    error: /method-specific identifier/,
  },
  {
    label: "ledger identifier too long",
    did: `did:midnight:testnet:${VALID_IDENTIFIER}0`,
    error: /method-specific identifier/,
  },
  {
    label: "ledger identifier contains non-hex",
    did: `did:midnight:testnet:${VALID_IDENTIFIER.slice(0, -1)}g`,
    error: /method-specific identifier/,
  },
  {
    label: "offchain hash is too short",
    did: `did:midnight:offchain:${"a".repeat(63)}`,
    error: /method-specific identifier/,
  },
  {
    label: "offchain hash is too long",
    did: `did:midnight:offchain:${"a".repeat(65)}`,
    error: /method-specific identifier/,
  },
  {
    label: "offchain hash contains non-hex",
    did: `did:midnight:offchain:${"a".repeat(63)}g`,
    error: /method-specific identifier/,
  },
  {
    label: "offchain payload contains non-base64url characters",
    did: `${validOffchainShortDid}:not+base64url`,
    error: /state encoding/,
  },
  {
    label: "offchain payload has invalid unpadded length",
    did: `${validOffchainShortDid}:A`,
    error: /state encoding/,
  },
  {
    label: "offchain payload uses padding",
    did: `${validOffchainShortDid}:AQ==`,
    error: /state encoding/,
  },
  {
    label: "offchain long form has a trailing colon",
    did: `${validOffchainShortDid}:`,
    error: /state encoding/,
  },
  {
    label: "ledger DID has an extra component",
    did: `did:midnight:testnet:${VALID_IDENTIFIER}:extra`,
    error: /Invalid Midnight DID format/,
  },
  {
    label: "offchain DID has an extra component",
    did: `${validOffchainSyntacticLongDid}:extra`,
    error: /Invalid Midnight DID format/,
  },
  {
    label: "long-form offchain DID URL has a fragment",
    did: `${validOffchainSyntacticLongDid}#key-1`,
    error: /state encoding/,
  },
  {
    label: "long-form offchain DID URL has a query",
    did: `${validOffchainSyntacticLongDid}?service=profile`,
    error: /state encoding/,
  },
  {
    label: "long-form offchain DID URL has a path",
    did: `${validOffchainSyntacticLongDid}/resource`,
    error: /state encoding/,
  },
  {
    label: "DID URL has a fragment",
    did: `did:midnight:testnet:${VALID_IDENTIFIER}#key-1`,
    error: /Invalid Midnight DID format|method-specific identifier/,
  },
  {
    label: "DID URL has a query",
    did: `did:midnight:testnet:${VALID_IDENTIFIER}?service=profile`,
    error: /Invalid Midnight DID format|method-specific identifier/,
  },
  {
    label: "DID URL has a path",
    did: `did:midnight:testnet:${VALID_IDENTIFIER}/resource`,
    error: /Invalid Midnight DID format|method-specific identifier/,
  },
  {
    label: "offchain DID URL has a fragment",
    did: `${validOffchainShortDid}#key-1`,
    error: /Invalid Midnight DID format|method-specific identifier/,
  },
  {
    label: "offchain DID URL has a query",
    did: `${validOffchainShortDid}?service=profile`,
    error: /Invalid Midnight DID format|method-specific identifier/,
  },
  {
    label: "offchain DID URL has a path",
    did: `${validOffchainShortDid}/resource`,
    error: /Invalid Midnight DID format|method-specific identifier/,
  },
] as const;
