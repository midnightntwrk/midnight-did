import {
  buildWalletAndWaitForFunds,
  configureProviders,
  createDID,
  initPrivateState,
  resolve,
  StandaloneConfig,
} from "@midnight-ntwrk/midnight-did-api";

const seed = process.env.MIDNIGHT_WALLET_SEED;
if (seed === undefined || seed.length === 0) {
  throw new Error("Set MIDNIGHT_WALLET_SEED to deploy a DID");
}

const bigintReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

const config = new StandaloneConfig();
const walletContext = await buildWalletAndWaitForFunds(config, seed);

try {
  const providers = await configureProviders(walletContext, config);
  const privateState = await initPrivateState(providers);
  const didContract = await createDID(providers, privateState);
  const resolution = await resolve(providers, didContract);

  console.log(
    JSON.stringify(
      {
        contractAddress: didContract.deployTxData.public.contractAddress,
        did: resolution?.didDocument.id,
        resolution,
      },
      bigintReplacer,
      2,
    ),
  );
} finally {
  await walletContext.wallet.stop();
}
