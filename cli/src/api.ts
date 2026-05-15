// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createHash, webcrypto } from 'node:crypto';

import { CompiledContract, type ProvableCircuitId as ProvableCircuitIdType } from '@midnight-ntwrk/compact-js';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { parseContractAddress } from '@midnight-ntwrk/midnight-did';
import {
  createMidnightProviders,
  createPrivateStatePasswordProvider,
  createStartedMidnightWalletContext,
  createWalletAndMidnightProvider as createSharedWalletAndMidnightProvider,
  isMissingPrivateStateContractAddressError,
  MIDNIGHT_DID_CONTRACT_NAME,
  MIDNIGHT_DID_PROOF_CIRCUIT_IDS,
  type MidnightWalletContext,
  waitForWalletFunds,
  waitForWalletSync,
} from '@midnight-ntwrk/midnight-did-api';
import { DIDContract, type DIDPrivateState, witnesses } from '@midnight-ntwrk/midnight-did-contract';
import {
  assertAbsoluteUri,
  type BoundIdField,
  normalizeBoundFragmentId as normalizeBoundFragmentIdWithSubject,
  serviceEndpointToLedger as serviceEndpointToLedgerValue,
  serviceTypeToLedger as serviceTypeToLedgerValue,
} from '@midnight-ntwrk/midnight-did-domain';
import {
  deployContract,
  type DeployedContract,
  findDeployedContract,
  type FoundContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { FinalizedTxData, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { type UnshieldedKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { Buffer } from 'buffer';
import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';

import { type Config, contractConfig } from './config';

export const DIDPrivateStateId = 'midnightDIDPrivateState' as const;
export type DIDContractType = DIDContract.Contract<DIDPrivateState>;
export type DIDCircuits = ProvableCircuitIdType<DIDContractType>;
export type DIDProviders = MidnightProviders<DIDCircuits, typeof DIDPrivateStateId, DIDPrivateState>;
export type DeployedDIDContract = DeployedContract<DIDContractType> | FoundContract<DIDContractType>;
export type VerificationMethod = DIDContract.VerificationMethod;
export type Service = DIDContract.Service;
export type Ledger = DIDContract.Ledger;
export const { VerificationMethodType, VerificationMethodRelation, KeyType, CurveType } = DIDContract;
type RelationName =
  | 'Authentication'
  | 'AssertionMethod'
  | 'KeyAgreement'
  | 'CapabilityInvocation'
  | 'CapabilityDelegation';

type ServiceEndpointInput = string | Record<string, unknown> | Array<string | Record<string, unknown>>;
const LedgerKeyTypeMap = {
  EC: KeyType.EC,
  RSA: KeyType.RSA,
  oct: KeyType.oct,
  OKP: KeyType.OKP,
} as const;
const LedgerCurveTypeMap = {
  Ed25519: CurveType.Ed25519,
  Jubjub: CurveType.Jubjub,
  'P-256': CurveType.P256,
} as const;

const expectedDidSubject = (didContract: DeployedDIDContract): string => {
  const networkId = String(getNetworkId()).toLowerCase();
  const contractAddress = parseContractAddress(didContract.deployTxData.public.contractAddress);
  return `did:midnight:${networkId}:${contractAddress}`;
};

const normalizeBoundFragmentId = (didContract: DeployedDIDContract, value: string, field: BoundIdField): string =>
  normalizeBoundFragmentIdWithSubject(value, field, expectedDidSubject(didContract));

const assertMidnightKeyProfile = (publicKeyJwk: {
  kty: 'EC' | 'RSA' | 'oct' | 'OKP';
  crv: 'Ed25519' | 'Jubjub' | 'P-256';
}): void => {
  if (publicKeyJwk.kty === 'OKP') {
    if (publicKeyJwk.crv !== 'Ed25519') {
      throw new Error('OKP keys must use Ed25519');
    }
    return;
  }
  if (publicKeyJwk.kty === 'EC') {
    if (publicKeyJwk.crv !== 'Jubjub' && publicKeyJwk.crv !== 'P-256') {
      throw new Error('EC keys must use Jubjub or P-256');
    }
    return;
  }
  throw new Error('Only OKP (Ed25519) and EC (Jubjub/P-256) keys are supported');
};

const serviceTypeToLedger = (type: string | string[]): string => serviceTypeToLedgerValue(type);

const serviceEndpointToLedger = (endpoint: ServiceEndpointInput): string => {
  try {
    return serviceEndpointToLedgerValue(endpoint);
  } catch {
    throw new Error('Invalid serviceEndpoint: could not serialize to JSON');
  }
};

const assertAliasUri = (value: string): string => assertAbsoluteUri(value, 'aliasUri');

let logger: Logger;

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const getPrivateStatePassword = createPrivateStatePasswordProvider();

const seedDisplayValue = (seed: string): string => {
  if (process.env.MIDNIGHT_DID_SHOW_SEED === 'true') {
    return seed;
  }
  const fingerprint = createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return `<redacted; sha256:${fingerprint}; set MIDNIGHT_DID_SHOW_SEED=true to print>`;
};

// Pre-compile the DID contract with ZK circuit assets
const didCompiledContract = CompiledContract.make(MIDNIGHT_DID_CONTRACT_NAME, DIDContract.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

const hashProverKey = async (proverKey: Uint8Array): Promise<Uint8Array> => {
  const hash = await webcrypto.subtle.digest('SHA-256', proverKey);
  return new Uint8Array(hash);
};

const setPrivateStateContractAddress = (providers: DIDProviders, contractAddress: ContractAddress): void => {
  providers.privateStateProvider.setContractAddress(contractAddress);
};

export const initPrivateState = async (providers: DIDProviders): Promise<DIDPrivateState> => {
  let providedPrivateState: DIDPrivateState | null = null;
  try {
    providedPrivateState = await providers.privateStateProvider.get(DIDPrivateStateId);
  } catch (error: unknown) {
    if (isMissingPrivateStateContractAddressError(error)) {
      logger.info('Private state restore skipped (contract address not set yet).');
    } else {
      throw error;
    }
  }
  if (
    providedPrivateState != null &&
    providedPrivateState.secretKey != null &&
    providedPrivateState.secretKey.buffer instanceof ArrayBuffer &&
    providedPrivateState.secretKey.BYTES_PER_ELEMENT === 1 &&
    providedPrivateState.secretKey.length === 32
  ) {
    logger.info('The private state is restored from the privateStateProvider');
    return providedPrivateState;
  }

  logger.info('Creating the new private state..');
  const proverKey = await providers.zkConfigProvider.getProverKey(MIDNIGHT_DID_PROOF_CIRCUIT_IDS.addVerificationMethod);
  const secretKey = await hashProverKey(proverKey);
  const privateState: DIDPrivateState = { secretKey };
  try {
    await providers.privateStateProvider.set(DIDPrivateStateId, privateState);
  } catch (error: unknown) {
    if (isMissingPrivateStateContractAddressError(error)) {
      logger.info('Private state save skipped (contract address not set yet).');
    } else {
      throw error;
    }
  }
  return privateState;
};

export type WalletContext = MidnightWalletContext;

export const getDIDLedgerState = async (
  providers: DIDProviders,
  contractAddress: ContractAddress,
): Promise<DIDContract.Ledger | null> => {
  logger.info('Checking contract ledger state...');
  assertIsContractAddress(contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress).then((contractState) => {
    if (contractState == null) return null;
    return DIDContract.ledger(contractState.data);
  });
  logger.info(`Ledger state: version=${state?.contractVersion}, active=${state?.active}`);
  return state;
};

export const joinContract = async (providers: DIDProviders, contractAddress: string): Promise<DeployedDIDContract> => {
  assertIsContractAddress(contractAddress);
  setPrivateStateContractAddress(providers, contractAddress);
  const initialPrivateState = await initPrivateState(providers);
  const didContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: didCompiledContract,
    privateStateId: DIDPrivateStateId,
    initialPrivateState,
  });
  logger.info(`Joined contract at address: ${didContract.deployTxData.public.contractAddress}`);
  return didContract;
};

export const deploy = async (providers: DIDProviders): Promise<DeployedDIDContract> => {
  logger.info('Deploying DID contract...');
  const initialPrivateState = await initPrivateState(providers);
  const didContract = await deployContract(providers, {
    compiledContract: didCompiledContract,
    privateStateId: DIDPrivateStateId,
    initialPrivateState,
  });
  logger.info(`Deployed contract at address: ${didContract.deployTxData.public.contractAddress}`);
  return didContract;
};

export const displayDIDState = async (
  providers: DIDProviders,
  didContract: DeployedDIDContract,
): Promise<{ didState: DIDContract.Ledger | null; contractAddress: string }> => {
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getDIDLedgerState(providers, contractAddress);

  if (didState === null) {
    console.log(`\n  ✗ No DID contract found at ${contractAddress}\n`);
    logger.info(`There is no DID contract deployed at ${contractAddress}.`);
    return { contractAddress, didState };
  }

  // Display comprehensive DID state
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        DID Document State                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`  Contract Address: ${contractAddress}`);
  console.log(`  Contract Version: ${didState.contractVersion}`);
  console.log(`  Status: ${didState.active ? '✓ Active' : '✗ Deactivated'}`);
  console.log(`  Document Version: ${didState.version}`);
  console.log(`  Operation Count: ${didState.operationCount}`);
  console.log(`  Created: ${didState.created}`);
  console.log(`  Updated: ${didState.updated}`);

  // Verification Methods
  console.log('\n  ─── Verification Methods ─────────────────────────────────────');
  if (didState.verificationMethods.isEmpty()) {
    console.log('    (none)');
  } else {
    for (const [id, vm] of didState.verificationMethods) {
      const keyTypeName = ['EC', 'RSA', 'oct', 'OKP'][vm.publicKeyJwk.kty] || vm.publicKeyJwk.kty;
      const curveTypeName = ['Ed25519', 'Jubjub', 'P-256'][vm.publicKeyJwk.crv] || vm.publicKeyJwk.crv;
      console.log(`    • ${id}`);
      console.log(`      Type: JsonWebKey`);
      console.log(`      Key: ${keyTypeName}/${curveTypeName}`);
      console.log(`      x: ${vm.publicKeyJwk.x}`);
      console.log(`      y: ${vm.publicKeyJwk.y}`);
    }
  }

  // Relations
  const relations = [
    { name: 'Authentication', set: didState.authenticationRelation },
    { name: 'AssertionMethod', set: didState.assertionMethodRelation },
    { name: 'KeyAgreement', set: didState.keyAgreementRelation },
    { name: 'CapabilityInvocation', set: didState.capabilityInvocationRelation },
    { name: 'CapabilityDelegation', set: didState.capabilityDelegationRelation },
  ];

  console.log('\n  ─── Verification Method Relations ────────────────────────────');
  let hasAnyRelations = false;
  for (const { name, set } of relations) {
    if (!set.isEmpty()) {
      hasAnyRelations = true;
      const members = Array.from(set).join(', ');
      console.log(`    ${name}: ${members}`);
    }
  }
  if (!hasAnyRelations) {
    console.log('    (none)');
  }

  // Services
  console.log('\n  ─── Services ─────────────────────────────────────────────────');
  if (didState.services.isEmpty()) {
    console.log('    (none)');
  } else {
    for (const [id, service] of didState.services) {
      console.log(`    • ${id}`);
      console.log(`      Type: ${service.typ}`);
      console.log(`      Endpoint: ${service.serviceEndpoint}`);
    }
  }

  // AlsoKnownAs
  console.log('\n  ─── AlsoKnownAs ──────────────────────────────────────────────');
  if (didState.alsoKnownAs.isEmpty()) {
    console.log('    (none)');
  } else {
    for (const alias of didState.alsoKnownAs) {
      console.log(`    • ${alias}`);
    }
  }

  console.log('\n' + '─'.repeat(62) + '\n');

  logger.info(`DID contract state: version=${didState.contractVersion}, active=${didState.active}`);
  return { contractAddress, didState };
};

export const createWalletAndMidnightProvider = createSharedWalletAndMidnightProvider;
export const waitForSync = waitForWalletSync;
export const waitForFunds = waitForWalletFunds;

/**
 * Formats a token balance for display (e.g. 1000000000 -> "1,000,000,000").
 */
const formatBalance = (balance: bigint): string => balance.toLocaleString();

/**
 * Runs an async operation with an animated spinner on the console.
 * Shows ⠋⠙⠹... while running, then ✓ on success or ✗ on failure.
 */
export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

/**
 * Register unshielded NIGHT UTXOs for dust generation.
 *
 * On Preprod/Preview, NIGHT tokens generate DUST over time, but only after
 * the UTXOs have been explicitly designated for dust generation via an on-chain
 * transaction. DUST is the non-transferable fee token used by the Midnight network.
 */
type CoinWithDustMeta = { meta?: { registeredForDustGeneration?: boolean } };

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  // Check if dust is already available (e.g. from a previous designation)
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  // Only register coins that haven't been designated yet
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin) => (coin as CoinWithDustMeta).meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    // All coins already registered — just wait for dust to generate
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  // Wait for dust to actually generate (balance > 0), not just for coins to appear
  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

/**
 * Prints a formatted wallet summary to the console, showing all three
 * wallet types (Shielded, Unshielded, Dust) with their addresses and balances.
 */
type WalletSummaryState = {
  unshielded: { balances: Record<string, bigint> };
  shielded: {
    coinPublicKey: { toHexString: () => string };
    encryptionPublicKey: { toHexString: () => string };
  };
  dust: { address: { toString: () => string } };
};

const printWalletSummary = (seed: string, state: WalletSummaryState, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  // Build the bech32m shielded address from coin + encryption public keys
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();

  const DIV = '──────────────────────────────────────────────────────────────';

  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed: ${seedDisplayValue(seed)}
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight

  Dust
  └─ Address: ${state.dust.address}

${DIV}`);
};

/**
 * Build (or restore) a wallet from a hex seed, then wait for the wallet
 * to sync and receive funds before returning.
 *
 * Steps:
 *   1. Derive HD keys (Zswap, NightExternal, Dust) from the seed
 *   2. Create the three sub-wallets (Shielded, Unshielded, Dust)
 *   3. Start the WalletFacade and wait for sync
 *   4. Display a wallet summary with all addresses
 *   5. If balance is zero, wait for incoming funds (e.g. from faucet)
 */
export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');

  const walletContext = await withStatus('Building wallet', () => createStartedMidnightWalletContext(config, seed));
  const { wallet, unshieldedKeystore } = walletContext;

  // Show seed and unshielded address immediately so user can fund via faucet while syncing
  const networkId = getNetworkId();
  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}
  Seed: ${seedDisplayValue(seed)}

  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}

  Fund your wallet with tNight from the Preprod faucet:
  https://faucet.preprod.midnight.network/
${DIV}
`);

  // Wait for the wallet to sync with the network
  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));

  // Display the full wallet summary with all addresses and balances
  printWalletSummary(seed, syncedState, unshieldedKeystore);

  // Check if wallet has funds; if not, wait for incoming tokens
  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  // Register NIGHT UTXOs for dust generation (required for tx fees on Preprod/Preview)
  await registerForDustGeneration(wallet, unshieldedKeystore);

  return walletContext;
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> =>
  await buildWalletAndWaitForFunds(config, toHex(Buffer.from(generateRandomSeed())));

/**
 * Configure all midnight-js providers needed for contract deployment and interaction.
 * This wires together the wallet, proof server, indexer, and private state storage.
 */
export const configureProviders = async (ctx: WalletContext, config: Config) => {
  return createMidnightProviders<DIDCircuits, typeof DIDPrivateStateId>({
    walletContext: ctx,
    config,
    zkConfigPath: contractConfig.zkConfigPath,
    privateStateStoreName: contractConfig.privateStateStoreName,
    privateStoragePasswordProvider: getPrivateStatePassword,
  });
};

/**
 * Get the current DUST balance from the wallet state.
 */
export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.balance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  // Sum pending coin initial values for a rough pending balance.
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};

/**
 * Monitor DUST balance with a live-updating display.
 * Prints a status line every 5 seconds showing balance, coins, and status.
 * Resolves when the user presses Enter (via the provided signal).
 */
export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => {
    stopped = true;
  });

  const sub = wallet
    .state()
    .pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
    )
    .subscribe((state) => {
      if (stopped) return;

      const now = new Date();
      const available = state.dust.balance(now);
      const availableCoins = state.dust.availableCoins.length;
      const pendingCoins = state.dust.pendingCoins.length;

      const registeredNight = state.unshielded.availableCoins.filter(
        (coin) => (coin as CoinWithDustMeta).meta?.registeredForDustGeneration === true,
      ).length;
      const totalNight = state.unshielded.availableCoins.length;

      let status = '';
      if (pendingCoins > 0 && availableCoins === 0) {
        status = '⚠ locked by pending tx';
      } else if (available > 0n) {
        status = '✓ ready to deploy';
      } else if (availableCoins > 0) {
        status = 'accruing...';
      } else if (registeredNight > 0) {
        status = 'waiting for generation...';
      } else {
        status = 'no NIGHT registered';
      }

      const time = now.toLocaleTimeString();
      console.log(
        `  [${time}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`,
      );
    });

  await stopSignal;
  sub.unsubscribe();
};

export function setLogger(_logger: Logger) {
  logger = _logger;
}

/**
 * DID Operations
 *
 * Direct functions to modify the DID document. Each function calls a single
 * circuit and increments the version counter.
 */

export const addVerificationMethod = async (
  didContract: DeployedDIDContract,
  id: string,
  publicKeyJwk: {
    kty: 'EC' | 'RSA' | 'oct' | 'OKP';
    crv: 'Ed25519' | 'Jubjub' | 'P-256';
    x: bigint;
    y: bigint;
  },
): Promise<FinalizedTxData> => {
  assertMidnightKeyProfile(publicKeyJwk);
  const normalizedId = normalizeBoundFragmentId(didContract, id, 'verificationMethod.id');
  logger.info(`Adding verification method: ${normalizedId}`);
  const result = await didContract.callTx.addVerificationMethod({
    id: normalizedId,
    typ: VerificationMethodType.JsonWebKey,
    publicKeyJwk: {
      kty: LedgerKeyTypeMap[publicKeyJwk.kty],
      crv: LedgerCurveTypeMap[publicKeyJwk.crv],
      x: publicKeyJwk.x,
      y: publicKeyJwk.y,
    },
  });
  logger.info('Verification method added successfully');
  return result.public;
};

export const updateVerificationMethod = async (
  didContract: DeployedDIDContract,
  id: string,
  publicKeyJwk: {
    kty: 'EC' | 'RSA' | 'oct' | 'OKP';
    crv: 'Ed25519' | 'Jubjub' | 'P-256';
    x: bigint;
    y: bigint;
  },
): Promise<FinalizedTxData> => {
  assertMidnightKeyProfile(publicKeyJwk);
  const normalizedId = normalizeBoundFragmentId(didContract, id, 'verificationMethod.id');
  logger.info(`Updating verification method: ${normalizedId}`);
  const result = await didContract.callTx.updateVerificationMethod({
    id: normalizedId,
    typ: VerificationMethodType.JsonWebKey,
    publicKeyJwk: {
      kty: LedgerKeyTypeMap[publicKeyJwk.kty],
      crv: LedgerCurveTypeMap[publicKeyJwk.crv],
      x: publicKeyJwk.x,
      y: publicKeyJwk.y,
    },
  });
  logger.info('Verification method updated successfully');
  return result.public;
};

/**
 * Remove a verification method and all its relations.
 * This operation is decomposed into multiple transactions:
 * 1. Query current state to find which relations the method belongs to
 * 2. Remove the method from each relation (one transaction per relation)
 * 3. Remove the verification method itself
 *
 * This approach allows the wallet to sync between each operation.
 */
export const removeVerificationMethod = async (
  didContract: DeployedDIDContract,
  providers: DIDProviders,
  id: string,
): Promise<FinalizedTxData> => {
  const normalizedId = normalizeBoundFragmentId(didContract, id, 'methodId');
  logger.info(`Removing verification method and its relations: ${normalizedId}`);
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getDIDLedgerState(providers, contractAddress);

  if (!didState) {
    throw new Error('Cannot query DID state');
  }

  const relationsToCheck: Array<{
    name: 'Authentication' | 'AssertionMethod' | 'KeyAgreement' | 'CapabilityInvocation' | 'CapabilityDelegation';
    member: boolean;
  }> = [
    {
      name: 'Authentication',
      member: didState.authenticationRelation.member(normalizedId),
    },
    {
      name: 'AssertionMethod',
      member: didState.assertionMethodRelation.member(normalizedId),
    },
    { name: 'KeyAgreement', member: didState.keyAgreementRelation.member(normalizedId) },
    {
      name: 'CapabilityInvocation',
      member: didState.capabilityInvocationRelation.member(normalizedId),
    },
    {
      name: 'CapabilityDelegation',
      member: didState.capabilityDelegationRelation.member(normalizedId),
    },
  ];

  for (const { name, member } of relationsToCheck) {
    if (member) {
      await didContract.callTx.removeVerificationMethodRelation(VerificationMethodRelation[name], normalizedId);
    }
  }

  const result = await didContract.callTx.removeVerificationMethod(normalizedId);
  logger.info('Verification method removed successfully');
  return result.public;
};

const relationSetFromState = (didState: DIDContract.Ledger, relation: RelationName) => {
  switch (relation) {
    case 'Authentication':
      return didState.authenticationRelation;
    case 'AssertionMethod':
      return didState.assertionMethodRelation;
    case 'KeyAgreement':
      return didState.keyAgreementRelation;
    case 'CapabilityInvocation':
      return didState.capabilityInvocationRelation;
    case 'CapabilityDelegation':
      return didState.capabilityDelegationRelation;
    default: {
      const unreachable: never = relation;
      throw new Error(`unsupported relation ${String(unreachable)}`);
    }
  }
};

export const addVerificationMethodRelation = async (
  didContract: DeployedDIDContract,
  providers: DIDProviders,
  relation: RelationName,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, 'methodId');
  logger.info(`Adding ${relation} relation to ${normalizedMethodId}`);
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error('Cannot query DID state');
  }
  const relationSet = relationSetFromState(didState, relation);
  if (relationSet.member(normalizedMethodId)) {
    throw new Error(`relation ${relation} already contains verification method ${normalizedMethodId}`);
  }
  const result = await didContract.callTx.addVerificationMethodRelation(
    VerificationMethodRelation[relation],
    normalizedMethodId,
  );
  logger.info('Verification method relation added successfully');
  return result.public;
};

export const removeVerificationMethodRelation = async (
  didContract: DeployedDIDContract,
  providers: DIDProviders,
  relation: RelationName,
  methodId: string,
): Promise<FinalizedTxData> => {
  const normalizedMethodId = normalizeBoundFragmentId(didContract, methodId, 'methodId');
  logger.info(`Removing ${relation} relation from ${normalizedMethodId}`);
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const didState = await getDIDLedgerState(providers, contractAddress);
  if (!didState) {
    throw new Error('Cannot query DID state');
  }
  const relationSet = relationSetFromState(didState, relation);
  if (!relationSet.member(normalizedMethodId)) {
    throw new Error(`relation ${relation} does not contain verification method ${normalizedMethodId}`);
  }
  const result = await didContract.callTx.removeVerificationMethodRelation(
    VerificationMethodRelation[relation],
    normalizedMethodId,
  );
  logger.info('Verification method relation removed successfully');
  return result.public;
};

export const addService = async (
  didContract: DeployedDIDContract,
  id: string,
  type: string | string[],
  serviceEndpoint: ServiceEndpointInput,
): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(didContract, id, 'service.id');
  logger.info(`Adding service: ${normalizedServiceId}`);
  const result = await didContract.callTx.addService({
    id: normalizedServiceId,
    typ: serviceTypeToLedger(type),
    serviceEndpoint: serviceEndpointToLedger(serviceEndpoint),
  });
  logger.info('Service added successfully');
  return result.public;
};

export const updateService = async (
  didContract: DeployedDIDContract,
  id: string,
  type: string | string[],
  serviceEndpoint: ServiceEndpointInput,
): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(didContract, id, 'service.id');
  logger.info(`Updating service: ${normalizedServiceId}`);
  const result = await didContract.callTx.updateService({
    id: normalizedServiceId,
    typ: serviceTypeToLedger(type),
    serviceEndpoint: serviceEndpointToLedger(serviceEndpoint),
  });
  logger.info('Service updated successfully');
  return result.public;
};

export const removeService = async (didContract: DeployedDIDContract, id: string): Promise<FinalizedTxData> => {
  const normalizedServiceId = normalizeBoundFragmentId(didContract, id, 'serviceId');
  logger.info(`Removing service: ${normalizedServiceId}`);
  const result = await didContract.callTx.removeService(normalizedServiceId);
  logger.info('Service removed successfully');
  return result.public;
};

export const addAlsoKnownAs = async (didContract: DeployedDIDContract, value: string): Promise<FinalizedTxData> => {
  const alias = assertAliasUri(value);
  logger.info(`Adding alsoKnownAs: ${value}`);
  const result = await didContract.callTx.addAlsoKnownAs(alias);
  logger.info('AlsoKnownAs added successfully');
  return result.public;
};

export const removeAlsoKnownAs = async (didContract: DeployedDIDContract, value: string): Promise<FinalizedTxData> => {
  const alias = assertAliasUri(value);
  logger.info(`Removing alsoKnownAs: ${value}`);
  const result = await didContract.callTx.removeAlsoKnownAs(alias);
  logger.info('AlsoKnownAs removed successfully');
  return result.public;
};

export const deactivateDID = async (didContract: DeployedDIDContract): Promise<FinalizedTxData> => {
  logger.info('Deactivating DID');
  const result = await didContract.callTx.deactivate();
  logger.info('DID deactivated successfully');
  return result.public;
};
