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

import { type WalletContext } from './api';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';
import { type StartedDockerComposeEnvironment, type DockerComposeEnvironment } from 'testcontainers';
import type { DIDProviders, DeployedDIDContract } from '@midnight-ntwrk/did-api';
import { type Config, StandaloneConfig } from './config';
import * as api from './api';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node.
 * Only used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

// ─── Display Helpers ────────────────────────────────────────────────────────

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              Midnight DID (Decentralized Identity)           ║
║              ──────────────────────────────────              ║
║              Privacy-preserving DID management               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const DIVIDER = '──────────────────────────────────────────────────────────────';

// ─── Menu Helpers ──────────────────────────────────────────────────────────

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${'─'.repeat(62)}
> `;

/** Build the contract actions menu, showing current DUST balance in the header. */
const contractMenu = (dustBalance: string) => `
${DIVIDER}
  Contract Actions${dustBalance ? `                    DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Deploy a new DID contract
  [2] Join an existing DID contract
  [3] Monitor DUST balance
  [4] Exit
${'─'.repeat(62)}
> `;

/** Build the DID operations menu, showing current DUST balance in the header. */
const didMenu = (dustBalance: string) => `
${DIVIDER}
  DID Operations${dustBalance ? `                       DUST: ${dustBalance}` : ''}
${DIVIDER}
  Verification Methods:
    [1] Add verification method      [2] Update verification method
    [3] Remove verification method

  Verification Method Relations:
    [4] Add relation                 [5] Remove relation

  Services:
    [6] Add service                  [7] Update service
    [8] Remove service

  Aliases:
    [9] Add alsoKnownAs             [10] Remove alsoKnownAs

  Other:
   [11] Display DID state           [12] Deactivate DID
   [13] Exit
${'─'.repeat(62)}
> `;

// ─── Wallet Setup ───────────────────────────────────────────────────────────

/** Prompt the user for a seed phrase and restore a wallet from it. */
const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await api.buildWalletAndWaitForFunds(config, seed);
};

/**
 * Wallet creation flow.
 * - Standalone configs skip the menu and use the genesis seed automatically.
 * - All other configs present a menu to create or restore a wallet.
 */
const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  // Standalone mode: use the pre-funded genesis wallet
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }

  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

// ─── Contract Interaction ───────────────────────────────────────────────────

/** Format dust balance for menu headers. */
const getDustLabel = async (wallet: api.WalletContext['wallet']): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.available.toLocaleString();
  } catch {
    return '';
  }
};

/** Prompt for a contract address and join an existing deployed contract. */
const joinContract = async (providers: DIDProviders, rli: Interface): Promise<DeployedDIDContract> => {
  const contractAddress = await rli.question('Enter the contract address (hex): ');
  return await api.joinContract(providers, contractAddress);
};

/**
 * Start the DUST monitor. Shows a live-updating balance display
 * that runs until the user presses Enter.
 */
const startDustMonitor = async (wallet: api.WalletContext['wallet'], rli: Interface): Promise<void> => {
  console.log('');
  // Use readline question to wait for Enter — the monitor will render above this line
  const stopPromise = rli.question('  Press Enter to return to menu...\n').then(() => {});
  await api.monitorDustBalance(wallet, stopPromise);
  console.log('');
};

/**
 * Deploy or join flow. Returns the contract handle, or null if the user exits.
 * Errors during deploy/join are caught and displayed — the user stays in the menu.
 */
const deployOrJoin = async (
  providers: DIDProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedDIDContract | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const contract = await api.withStatus('Deploying DID contract', () => api.deploy(providers));
          console.log(`  Contract deployed at: ${contract.deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  ✗ Deploy failed: ${msg}`);
          // Log the full cause chain to help debug WASM/ledger errors
          if (e instanceof Error && e.cause) {
            let cause: unknown = e.cause;
            let depth = 0;
            while (cause && depth < 5) {
              const causeMsg =
                cause instanceof Error
                  ? `${cause.message}\n      ${cause.stack?.split('\n').slice(1, 3).join('\n      ') ?? ''}`
                  : String(cause);
              console.log(`    cause: ${causeMsg}`);
              cause = cause instanceof Error ? cause.cause : undefined;
              depth++;
            }
          }
          if (msg.toLowerCase().includes('dust') || msg.toLowerCase().includes('no dust')) {
            console.log('    Insufficient DUST for transaction fees. Use option [3] to monitor your balance.');
          }
          console.log('');
        }
        break;
      case '2':
        try {
          return await joinContract(providers, rli);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to join contract: ${msg}\n`);
        }
        break;
      case '3':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '4':
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

// ─── DID Operation Helpers ─────────────────────────────────────────────────

/** Prompt user to add a verification method */
const addVerificationMethod = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Add Verification Method');
  const id = await rli.question('  Method ID (e.g., #key-1): ');
  const kty = await rli.question('  Key type [1=EC, 2=RSA, 3=oct, 4=OKP]: ');
  const crv = await rli.question('  Curve type [1=Ed25519, 2=Jubjub]: ');
  const x = await rli.question('  X coordinate (bigint): ');
  const y = await rli.question('  Y coordinate (bigint): ');

  const keyTypes = ['EC', 'RSA', 'oct', 'OKP'] as const;
  const curveTypes = ['Ed25519', 'Jubjub'] as const;

  const publicKeyJwk = {
    kty: keyTypes[parseInt(kty) - 1],
    crv: curveTypes[parseInt(crv) - 1],
    x: BigInt(x),
    y: BigInt(y),
  };

  await api.withStatus('Adding verification method', () => api.addVerificationMethod(didContract, id, publicKeyJwk));
  console.log('  ✓ Verification method added\n');
};

/** Prompt user to update a verification method */
const updateVerificationMethod = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Update Verification Method');
  const id = await rli.question('  Method ID to update: ');
  const kty = await rli.question('  New key type [1=EC, 2=RSA, 3=oct, 4=OKP]: ');
  const crv = await rli.question('  New curve type [1=Ed25519, 2=Jubjub]: ');
  const x = await rli.question('  New X coordinate (bigint): ');
  const y = await rli.question('  New Y coordinate (bigint): ');

  const keyTypes = ['EC', 'RSA', 'oct', 'OKP'] as const;
  const curveTypes = ['Ed25519', 'Jubjub'] as const;

  const publicKeyJwk = {
    kty: keyTypes[parseInt(kty) - 1],
    crv: curveTypes[parseInt(crv) - 1],
    x: BigInt(x),
    y: BigInt(y),
  };

  await api.withStatus('Updating verification method', () =>
    api.updateVerificationMethod(didContract, id, publicKeyJwk),
  );
  console.log('  ✓ Verification method updated\n');
};

/** Prompt user to remove a verification method */
const removeVerificationMethod = async (
  didContract: DeployedDIDContract,
  providers: api.DIDProviders,
  rli: Interface,
): Promise<void> => {
  console.log('\n  Remove Verification Method');
  const id = await rli.question('  Method ID to remove: ');
  await api.withStatus('Removing verification method', () => api.removeVerificationMethod(didContract, providers, id));
  console.log('  ✓ Verification method removed\n');
};

/** Prompt user to add a verification method relation */
const addRelation = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Add Verification Method Relation');
  const methodId = await rli.question('  Method ID: ');
  const relationType = await rli.question(
    '  Relation [1=Authentication, 2=AssertionMethod, 3=KeyAgreement, 4=CapabilityInvocation, 5=CapabilityDelegation]: ',
  );

  const relations = [
    'Authentication',
    'AssertionMethod',
    'KeyAgreement',
    'CapabilityInvocation',
    'CapabilityDelegation',
  ] as const;
  const relation = relations[parseInt(relationType) - 1];

  await api.withStatus('Adding relation', () => api.addVerificationMethodRelation(didContract, relation, methodId));
  console.log('  ✓ Relation added\n');
};

/** Prompt user to remove a verification method relation */
const removeRelation = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Remove Verification Method Relation');
  const methodId = await rli.question('  Method ID: ');
  const relationType = await rli.question(
    '  Relation [1=Authentication, 2=AssertionMethod, 3=KeyAgreement, 4=CapabilityInvocation, 5=CapabilityDelegation]: ',
  );

  const relations = [
    'Authentication',
    'AssertionMethod',
    'KeyAgreement',
    'CapabilityInvocation',
    'CapabilityDelegation',
  ] as const;
  const relation = relations[parseInt(relationType) - 1];

  await api.withStatus('Removing relation', () =>
    api.removeVerificationMethodRelation(didContract, relation, methodId),
  );
  console.log('  ✓ Relation removed\n');
};

/** Prompt user to add a service */
const addService = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Add Service');
  const id = await rli.question('  Service ID (e.g., #service-1): ');
  const type = await rli.question('  Service type (e.g., MessagingService): ');
  const endpoint = await rli.question('  Service endpoint (URL): ');

  await api.withStatus('Adding service', () => api.addService(didContract, id, type, endpoint));
  console.log('  ✓ Service added\n');
};

/** Prompt user to update a service */
const updateService = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Update Service');
  const id = await rli.question('  Service ID to update: ');
  const type = await rli.question('  New service type: ');
  const endpoint = await rli.question('  New service endpoint (URL): ');

  await api.withStatus('Updating service', () => api.updateService(didContract, id, type, endpoint));
  console.log('  ✓ Service updated\n');
};

/** Prompt user to remove a service */
const removeService = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Remove Service');
  const id = await rli.question('  Service ID to remove: ');
  await api.withStatus('Removing service', () => api.removeService(didContract, id));
  console.log('  ✓ Service removed\n');
};

/** Prompt user to add an alsoKnownAs value */
const addAlsoKnownAs = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Add AlsoKnownAs');
  const value = await rli.question('  Alias value (e.g., did:example:alternative-id): ');
  await api.withStatus('Adding alsoKnownAs', () => api.addAlsoKnownAs(didContract, value));
  console.log('  ✓ AlsoKnownAs added\n');
};

/** Prompt user to remove an alsoKnownAs value */
const removeAlsoKnownAs = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Remove AlsoKnownAs');
  const value = await rli.question('  Alias value to remove: ');
  await api.withStatus('Removing alsoKnownAs', () => api.removeAlsoKnownAs(didContract, value));
  console.log('  ✓ AlsoKnownAs removed\n');
};

/** Prompt user to deactivate the DID */
const deactivateDID = async (didContract: DeployedDIDContract, rli: Interface): Promise<void> => {
  console.log('\n  Deactivate DID');
  const confirm = await rli.question('  Are you sure? This action cannot be undone [y/N]: ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('  Cancelled\n');
    return;
  }

  await api.withStatus('Deactivating DID', () => api.deactivateDID(didContract));
  console.log('  ✓ DID deactivated\n');
};

/**
 * Main interaction loop. Once a contract is deployed/joined, the user
 * can perform various DID operations.
 */
const mainLoop = async (providers: DIDProviders, walletCtx: api.WalletContext, rli: Interface): Promise<void> => {
  const didContract = await deployOrJoin(providers, walletCtx, rli);
  if (didContract === null) {
    return;
  }

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(didMenu(dustLabel));
    try {
      switch (choice.trim()) {
        case '1': // Add verification method
          await addVerificationMethod(didContract, rli);
          break;
        case '2': // Update verification method
          await updateVerificationMethod(didContract, rli);
          break;
        case '3': // Remove verification method
          await removeVerificationMethod(didContract, providers, rli);
          break;
        case '4': // Add relation
          await addRelation(didContract, rli);
          break;
        case '5': // Remove relation
          await removeRelation(didContract, rli);
          break;
        case '6': // Add service
          await addService(didContract, rli);
          break;
        case '7': // Update service
          await updateService(didContract, rli);
          break;
        case '8': // Remove service
          await removeService(didContract, rli);
          break;
        case '9': // Add alsoKnownAs
          await addAlsoKnownAs(didContract, rli);
          break;
        case '10': // Remove alsoKnownAs
          await removeAlsoKnownAs(didContract, rli);
          break;
        case '11': // Display DID state
          await api.displayDIDState(providers, didContract);
          break;
        case '12': // Deactivate DID
          await deactivateDID(didContract, rli);
          break;
        case '13': // Exit
          return;
        default:
          console.log(`  Invalid choice: ${choice}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`\n  ✗ Operation failed: ${msg}`);
      if (msg.toLowerCase().includes('dust') || msg.toLowerCase().includes('no dust')) {
        console.log('    Insufficient DUST for transaction fees.');
      }
      if (msg.toLowerCase().includes('not active') || msg.toLowerCase().includes('inactive')) {
        console.log('    DID has been deactivated and cannot be modified.');
      }
      console.log('');
    }
  }
};

// ─── Docker Port Mapping ────────────────────────────────────────────────────

/** Map a container's first exposed port into the config URL. */
const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, '');
};

// ─── Entry Point ────────────────────────────────────────────────────────────

/**
 * Main entry point for the CLI.
 *
 * Flow:
 *   1. (Optional) Start Docker containers for proof server / node / indexer
 *   2. Build or restore a wallet and wait for it to be funded
 *   3. Configure midnight-js providers (proof server, indexer, wallet, private state)
 *   4. Enter the contract deploy/join and counter interaction loop
 *   5. Clean up: close wallet, readline, and docker environment
 */
export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);

  // Print the title banner
  console.log(BANNER);

  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    // Step 1: Start Docker environment if provided (e.g. local proof server)
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();

      // In standalone mode, remap ports to the dynamically assigned container ports
      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, 'did-indexer');
        config.indexerWS = mapContainerPort(env, config.indexerWS, 'did-indexer');
        config.node = mapContainerPort(env, config.node, 'did-node');
        config.proofServer = mapContainerPort(env, config.proofServer, 'did-proof-server');
      }
    }

    // Step 2: Build wallet (create new or restore from seed)
    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) {
      return;
    }

    try {
      // Step 3: Configure midnight-js providers
      const providers = await api.withStatus('Configuring providers', () => api.configureProviders(walletCtx, config));
      console.log('');

      // Step 4: Enter the contract interaction loop
      await mainLoop(providers, walletCtx, rli);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error: ${e.message}`);
        logger.debug(`${e.stack}`);
      } else {
        throw e;
      }
    } finally {
      // Step 5a: Stop the wallet
      try {
        await walletCtx.wallet.stop();
      } catch (e) {
        logger.error(`Error stopping wallet: ${e}`);
      }
    }
  } finally {
    // Step 5b: Close readline and Docker environment
    rli.close();
    rli.removeAllListeners();

    if (env !== undefined) {
      try {
        await env.down();
      } catch (e) {
        logger.error(`Error shutting down docker environment: ${e}`);
      }
    }

    logger.info('Goodbye.');
  }
};
