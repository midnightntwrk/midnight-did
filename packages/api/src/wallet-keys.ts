import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import {
  createKeystore,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { Buffer } from "buffer";

import { parseSeed } from "./seed.js";

export const deriveMidnightWalletKeys = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(parseSeed(seed), "hex"));
  if (hdWallet.type !== "seedOk") {
    throw new Error("Failed to initialize HDWallet from seed");
  }
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== "keysDerived") {
    throw new Error("Failed to derive keys");
  }
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

type MidnightWalletKeys = ReturnType<typeof deriveMidnightWalletKeys>;

export const createUnshieldedKeystoreFromKeys = (
  keys: MidnightWalletKeys,
): UnshieldedKeystore => {
  return createKeystore(keys[Roles.NightExternal], getNetworkId());
};

export const createUnshieldedKeystoreFromSeed = (
  seed: string,
): UnshieldedKeystore =>
  createUnshieldedKeystoreFromKeys(deriveMidnightWalletKeys(seed));

export const deriveUnshieldedAddressFromSeed = (seed: string): string =>
  createUnshieldedKeystoreFromSeed(seed).getBech32Address().toString();
