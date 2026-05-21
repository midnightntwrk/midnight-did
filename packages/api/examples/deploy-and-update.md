# Deploy and Update a Midnight DID

This package-level example uses only `@midnight-ntwrk/midnight-did-api` exports. It does not depend on the resolver service, DID manager UI, or shared secret-storage code owned by `midnight-did-resolver`.

```ts
import {
  StandaloneConfig,
  addService,
  buildWalletAndWaitForFunds,
  configureProviders,
  createDID,
  initPrivateState,
  resolve,
  updateService,
} from "@midnight-ntwrk/midnight-did-api";
import { createService } from "@midnight-ntwrk/midnight-did-domain";

const seed = process.env.MIDNIGHT_WALLET_SEED;
if (seed === undefined) throw new Error("MIDNIGHT_WALLET_SEED is required");

const walletContext = await buildWalletAndWaitForFunds(StandaloneConfig, seed);
const providers = await configureProviders(walletContext, StandaloneConfig);
const privateState = await initPrivateState(providers);
const didContract = await createDID(providers, privateState);

const service = createService({
  id: "#agent",
  type: "DIDCommMessaging",
  serviceEndpoint: "https://agent.example.com/didcomm",
});

await addService(didContract, service);
await updateService(
  didContract,
  createService({
    ...service,
    serviceEndpoint: "https://agent.example.com/v2/didcomm",
  }),
);

const result = await resolve(providers, didContract);
console.log(result?.didDocument.id);
```

For an already deployed DID contract, replace `createDID` with `joinContract(providers, contractAddress)` and then call the same update helpers.
