import {
  addService,
  addVerificationMethod,
  addVerificationMethodRelation,
  buildWalletAndWaitForFunds,
  configureProviders,
  joinContract,
  resolve,
  StandaloneConfig,
  updateService,
} from "@midnight-ntwrk/midnight-did-api";
import {
  createService,
  createVerificationMethod,
  CurveType,
  encodeFieldElement,
  KeyType,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";

const seed = process.env.MIDNIGHT_WALLET_SEED;
const contractAddress = process.env.MIDNIGHT_DID_CONTRACT_ADDRESS;

if (seed === undefined || seed.length === 0) {
  throw new Error("Set MIDNIGHT_WALLET_SEED to update a DID");
}
if (contractAddress === undefined || contractAddress.length === 0) {
  throw new Error("Set MIDNIGHT_DID_CONTRACT_ADDRESS to update a DID");
}

const bigintReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

const config = new StandaloneConfig();
const walletContext = await buildWalletAndWaitForFunds(config, seed);

try {
  const providers = await configureProviders(walletContext, config);
  const didContract = await joinContract(providers, contractAddress);
  const before = await resolve(providers, didContract);
  if (before === null) {
    throw new Error(`No DID contract found at ${contractAddress}`);
  }

  const did = before.didDocument.id;
  const verificationMethod = createVerificationMethod({
    id: "#example-key-1",
    type: VerificationMethodType.JsonWebKey,
    controller: did,
    publicKeyJwk: {
      kty: KeyType.OKP,
      crv: CurveType.Ed25519,
      x: encodeFieldElement(1n),
    },
  });

  await addVerificationMethod(didContract, verificationMethod);
  await addVerificationMethodRelation(
    didContract,
    providers,
    VerificationMethodRelationType.Authentication,
    verificationMethod.id,
  );

  const service = createService({
    id: "#didcomm",
    type: "DIDCommMessaging",
    serviceEndpoint: "https://example.com/didcomm",
  });
  await addService(didContract, service);
  await updateService(didContract, {
    ...service,
    serviceEndpoint: "https://example.com/didcomm/v2",
  });

  const after = await resolve(providers, didContract);
  console.log(JSON.stringify(after, bigintReplacer, 2));
} finally {
  await walletContext.wallet.stop();
}
