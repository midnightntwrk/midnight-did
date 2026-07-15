//! Bootstrap an "issuer DID" with the two verification methods
//! the OID4VP/VCI flows need (Ed25519 authentication + Jubjub
//! assertionMethod), then write a JSON keystore consumable by
//! `IssuerDIDIT-mock/src/services/issuerDid.ts`.
//!
//! Lives in the api package's examples/ rather than in the
//! IssuerDIDIT-mock or the solution-examples workspace because:
//!
//! - midnight-did packages have intricate workspace deps
//!   (`jubjub-schnorr` etc.) that only resolve cleanly from
//!   inside *this* workspace. The IssuerDIDIT-mock package
//!   ships intentionally outside any workspace, so it can't pull
//!   the api in transitively.
//! - The midnight-identity-solution-examples parent workspace
//!   uses a custom `bootstrap-libs.sh`-assembled libs layout
//!   that drops `jubjub-schnorr` entirely.
//!
//! From this workspace's root:
//!
//! ```bash
//! ISSUER_BOOTSTRAP_SEED=0000…0001 \
//! ISSUER_KEYSTORE_OUT=/abs/path/to/issuer-keystore.json \
//! INDEXER_URL=http://127.0.0.1:8088/api/v3/graphql \
//! NODE_RPC_URL=http://127.0.0.1:9944 \
//! PROOF_SERVER_URL=http://127.0.0.1:6300 \
//! pnpm exec ts-node --esm packages/api/examples/bootstrap-issuer-did.ts
//! ```
//!
//! ## Output keystore JSON shape
//!
//! Matches what the Rust `did-bootstrap` CLI produces, so the
//! existing IssuerDIDIT-mock loader keeps working unchanged:
//!
//! ```json
//! {
//!   "did": "did:midnight:undeployed:...",
//!   "ed25519": { "kid": "did:midnight:...#key-auth",   "secret_hex": "..." },
//!   "jubjub":  { "kid": "did:midnight:...#key-assert", "secret_hex": "..." }
//! }
//! ```
//!
//! ## Determinism
//!
//! Wallet HD derivation comes from `@midnight-ntwrk/wallet-sdk-hd`
//! (the TS source of truth — Rust's wallet-core mirrors it; the
//! 2026-05-29 standalone bootstrap confirmed empirical parity by
//! pulling the genesis-mint DUST from the derived address).
//!
//! Ed25519/Jubjub DID-key secrets are 32 random bytes per
//! bootstrap (no determinism). Env-wipe between iterations
//! rotates the DID contract address anyway; deterministic key
//! bytes buys nothing user-visible. Match the Rust CLI's HKDF
//! scheme later if a future caller needs reproducible keystore
//! bytes across runs against the same env.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

import {
  createMidnightDIDString,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did/midnight";
import {
  addSchnorrJubjubVerificationMethod,
  addVerificationMethod,
  addVerificationMethodRelation,
  buildWalletAndWaitForFunds,
  configureProviders,
  createDID,
  getMidnightNetwork,
  initPrivateState,
  ProfileConfig,
  registerForDustGeneration,
  resolve,
} from "@midnight-ntwrk/midnight-did-api";
import {
  createVerificationMethod,
  CurveType,
  encodeBase64Url,
  KeyType,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { deriveJubjubPublicKeyFromSeed } from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
import { ed25519 } from "@noble/curves/ed25519";

// ── config from env ─────────────────────────────────────────────

const seedInput = process.env.ISSUER_BOOTSTRAP_SEED;
if (!seedInput || seedInput.length === 0) {
  console.error("Set ISSUER_BOOTSTRAP_SEED (hex 64 chars or any short string)");
  process.exit(2);
}

const outPath = process.env.ISSUER_KEYSTORE_OUT;
if (!outPath || outPath.length === 0) {
  console.error("Set ISSUER_KEYSTORE_OUT to an absolute path");
  process.exit(2);
}

const indexerUrl =
  process.env.INDEXER_URL ?? "http://127.0.0.1:8088/api/v3/graphql";
const nodeRpcUrl = process.env.NODE_RPC_URL ?? "http://127.0.0.1:9944";
const proofServerUrl = process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300";

if (existsSync(outPath)) {
  console.error(
    `Refusing to overwrite ${outPath}. Delete it manually to re-bootstrap.`,
  );
  process.exit(2);
}

// ── helpers ──────────────────────────────────────────────────────

const DUST_RETRY =
  /Not enough Dust generated to pay the fee|could not balance dust/i;
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

async function retryOnDustShortage<T>(
  label: string,
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 8_000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === retries || !DUST_RETRY.test(msg)) throw err;
      console.error(
        `[bootstrap] ${label} dust shortage on attempt ${attempt + 1}/${retries + 1}, sleeping ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function randomSecret32(): Uint8Array {
  return Uint8Array.from(randomBytes(32));
}

/// 64 hex chars (with optional `0x`) → decoded verbatim;
/// anything else → SHA-256-hashed to 32 bytes. Matches the Rust
/// CLI's `seed_to_bytes` normalisation exactly so the same
/// `ISSUER_BOOTSTRAP_SEED` value produces the same wallet seed
/// across both bootstrap paths.
function seedToHexString(seed: string): string {
  const stripped = seed.startsWith("0x") ? seed.slice(2) : seed;
  if (stripped.length === 64 && /^[0-9a-fA-F]+$/.test(stripped)) {
    return stripped.toLowerCase();
  }
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

// ── flow ─────────────────────────────────────────────────────────

const seedHex = seedToHexString(seedInput);
console.error(
  `[bootstrap] seed=${seedHex.slice(0, 8)}… (${seedInput === seedHex ? "verbatim hex" : "hashed"})`,
);

const indexer = new URL(indexerUrl);
const wsScheme = indexer.protocol === "https:" ? "wss:" : "ws:";
const indexerWS = `${wsScheme}//${indexer.host}${indexer.pathname}/ws`;

const dappConfig = new ProfileConfig("standalone", {
  indexer: indexerUrl,
  indexerWS,
  node: nodeRpcUrl,
  proofServer: proofServerUrl,
});
console.error(
  `[bootstrap] endpoints: indexer=${dappConfig.indexer} node=${dappConfig.node} proof=${dappConfig.proofServer}`,
);

console.error("[bootstrap] step 1/7 build wallet, wait for funds…");
const walletCtx = await buildWalletAndWaitForFunds(dappConfig, seedHex);

try {
  console.error("[bootstrap] step 2/7 register for dust generation…");
  await registerForDustGeneration(
    walletCtx.wallet,
    walletCtx.unshieldedKeystore,
  );

  console.error("[bootstrap] step 3/7 configure providers…");
  const providers = await configureProviders(walletCtx, dappConfig);

  console.error("[bootstrap] step 4/7 init DID private state…");
  const privateState = await initPrivateState(providers);

  console.error("[bootstrap] step 5/7 createDID (deploy contract)…");
  const contract = await retryOnDustShortage("createDID", () =>
    createDID(providers, privateState),
  );

  const contractAddress = parseContractAddress(
    contract.deployTxData.public.contractAddress,
  );
  const didString = createMidnightDIDString(
    contractAddress,
    getMidnightNetwork(),
  );
  console.error(`[bootstrap] DID deployed: ${didString}`);

  // Ed25519 authentication
  const edKid = `${didString}#key-auth`;
  const edSecret = randomSecret32();
  const edPublic = ed25519.getPublicKey(edSecret);
  const edVm = createVerificationMethod({
    id: edKid,
    type: VerificationMethodType.JsonWebKey,
    controller: didString,
    publicKeyJwk: {
      kty: KeyType.OKP,
      crv: CurveType.Ed25519,
      x: encodeBase64Url(edPublic),
    },
  });
  console.error(
    "[bootstrap] step 6/7 attach Ed25519 + authentication relation…",
  );
  await retryOnDustShortage("addVerificationMethod(ed25519)", () =>
    addVerificationMethod(contract, edVm),
  );
  await retryOnDustShortage(
    "addVerificationMethodRelation(authentication)",
    () =>
      addVerificationMethodRelation(
        contract,
        providers,
        VerificationMethodRelationType.Authentication,
        edKid,
      ),
  );

  // Jubjub assertion
  const jubKid = `${didString}#key-assert`;
  const jubSecret = randomSecret32();
  const jubPublic = deriveJubjubPublicKeyFromSeed(jubSecret);
  console.error(
    "[bootstrap] step 7/7 attach Jubjub + assertionMethod relation…",
  );
  await retryOnDustShortage("addSchnorrJubjubVerificationMethod", () =>
    addSchnorrJubjubVerificationMethod(contract, {
      id: jubKid,
      publicKey: jubPublic,
    }),
  );
  await retryOnDustShortage(
    "addVerificationMethodRelation(assertionMethod)",
    () =>
      addVerificationMethodRelation(
        contract,
        providers,
        VerificationMethodRelationType.AssertionMethod,
        jubKid,
      ),
  );

  // Verify. The relation arrays may contain bare fragment ids
  // (`#key-auth`) or full DID URLs depending on how the resolver
  // serialised them. We compare by fragment only — that's what
  // the api package's test suite does (`hasSameMethodFragment`
  // in `src/test/did.api.test.ts`).
  const toFragment = (s: string): string => {
    const trimmed = s.trim();
    const hash = trimmed.indexOf("#");
    return hash >= 0 ? trimmed.slice(hash) : `#${trimmed}`;
  };
  type VerificationMethodReference = string | { id: string };
  const referenceToFragment = (
    reference: VerificationMethodReference,
  ): string =>
    toFragment(typeof reference === "string" ? reference : reference.id);

  const resolution = await resolve(providers, contract);
  const doc = resolution?.didDocument;
  const authFragments = (doc?.authentication ?? []).map(referenceToFragment);
  const assertFragments = (doc?.assertionMethod ?? []).map(referenceToFragment);
  if (!authFragments.includes(toFragment(edKid))) {
    throw new Error(
      `Ed25519 kid ${edKid} (${toFragment(edKid)}) not in authentication relation — got ${JSON.stringify(authFragments)}`,
    );
  }
  if (!assertFragments.includes(toFragment(jubKid))) {
    throw new Error(
      `Jubjub kid ${jubKid} (${toFragment(jubKid)}) not in assertionMethod relation — got ${JSON.stringify(assertFragments)}`,
    );
  }

  const out = {
    did: didString,
    ed25519: {
      kid: edKid,
      secret_hex: Buffer.from(edSecret).toString("hex"),
    },
    jubjub: {
      kid: jubKid,
      secret_hex: Buffer.from(jubSecret).toString("hex"),
    },
  };
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`Issuer DID: ${didString}`);
} finally {
  await walletCtx.wallet.stop();
}
