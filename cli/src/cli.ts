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

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';

import { FileSecretStore } from '@midnight-ntwrk/midnight-did-secret-storage';
import { type Logger } from 'pino';
import { type DockerComposeEnvironment, type StartedDockerComposeEnvironment } from 'testcontainers';

import { type DeployedDIDContract, type DIDProviders, type WalletContext } from './api';
import * as api from './api';
import { CliDidService } from './cli-api';
import { type Config, StandaloneConfig } from './config';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node.
 * Only used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const DEFAULT_SECRET_STORE_PATH = `${process.env.HOME ?? process.cwd()}/.midnight-did/cli-secrets.json`;
const DEFAULT_SESSION_STORE_PATH = `${process.env.HOME ?? process.cwd()}/.midnight-did/cli-session.json`;

type CliSessionEntry = {
  seed: string;
  contractAddress?: string;
  updatedAt: string;
};

type CliSessionStore = {
  version: 1;
  profiles: Record<string, CliSessionEntry>;
};

const profileIdForConfig = (config: Config): string => {
  const networkTag = config.constructor.name.replace(/Config$/, '').toLowerCase() || 'default';
  return `${networkTag}:${config.node}`;
};

const readSessionStore = async (location: string): Promise<CliSessionStore> => {
  try {
    const raw = await readFile(location, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CliSessionStore>;
    if (parsed.version !== 1 || typeof parsed.profiles !== 'object' || parsed.profiles === null) {
      return { version: 1, profiles: {} };
    }
    return { version: 1, profiles: parsed.profiles as Record<string, CliSessionEntry> };
  } catch {
    return { version: 1, profiles: {} };
  }
};

const writeSessionStore = async (location: string, store: CliSessionStore): Promise<void> => {
  await mkdir(path.dirname(location), { recursive: true });
  await writeFile(location, JSON.stringify(store, null, 2), 'utf8');
};

const upsertSessionEntry = async (
  location: string,
  profileId: string,
  update: { seed: string; contractAddress?: string },
): Promise<void> => {
  const store = await readSessionStore(location);
  store.profiles[profileId] = {
    seed: update.seed,
    contractAddress: update.contractAddress,
    updatedAt: new Date().toISOString(),
  };
  await writeSessionStore(location, store);
};

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
  Key Management:
    [1] Generate key                [2] Import key
    [3] List keys

  Verification Methods:
    [4] Add verification method      [5] Update verification method
    [6] Remove verification method

  Verification Method Relations:
    [7] Add relation                 [8] Remove relation

  Services:
    [9] Add service                 [10] Update service
   [11] Remove service

  Aliases:
   [12] Add alsoKnownAs             [13] Remove alsoKnownAs

  Other:
   [14] Display DID state           [15] Deactivate DID
   [16] Show next hints             [17] Exit
${'─'.repeat(62)}
> `;

// ─── Wallet Setup ───────────────────────────────────────────────────────────

const generateSeedHex = (): string => randomBytes(32).toString('hex');

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
  service: CliDidService,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedDIDContract | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const result = await api.withStatus('Deploying DID contract', () => service.deployDid());
          console.log(`  Contract deployed at: ${result.data?.contractAddress}\n`);
          await renderHints(service);
          return service.getDidContract();
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
          const contractAddress = await rli.question('Enter the contract address (hex): ');
          await api.withStatus('Joining DID contract', () => service.joinDid({ contractAddress }));
          await renderHints(service);
          return service.getDidContract();
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
const renderHints = async (service: CliDidService): Promise<void> => {
  const hints = await service.getNextActions();
  if (hints.length === 0) return;
  console.log('\n  Next action hints:');
  for (const hint of hints.slice(0, 5)) {
    console.log(`    • ${hint.action}: ${hint.reason}`);
  }
  console.log('');
};

const promptRelation = async (
  rli: Interface,
): Promise<'Authentication' | 'AssertionMethod' | 'KeyAgreement' | 'CapabilityInvocation' | 'CapabilityDelegation'> => {
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
  return relations[parseInt(relationType, 10) - 1] ?? 'Authentication';
};

const listKeys = async (service: CliDidService): Promise<void> => {
  const keys = await service.listKeys();
  console.log('\n  Stored keys');
  if (keys.length === 0) {
    console.log('    (none)\n');
    return;
  }
  for (const entry of keys) {
    console.log(`    • ${entry.keyRef} | ${entry.id} | ${entry.algorithm.kty}/${entry.algorithm.crv}`);
  }
  console.log('');
};

const generateKey = async (service: CliDidService, rli: Interface): Promise<void> => {
  console.log('\n  Generate key');
  const id = await rli.question('  Local key id (e.g., auth-main): ');
  const ktyChoice = await rli.question('  Key type [1=EC, 2=OKP]: ');
  const crvChoice = await rli.question('  Curve [1=Ed25519, 2=Jubjub, 3=P-256]: ');
  const purpose = await rli.question('  Purpose (optional): ');
  const did = await rli.question('  DID binding (optional): ');
  const kty = ktyChoice.trim() === '2' ? 'OKP' : 'EC';
  const curveMap = ['Ed25519', 'Jubjub', 'P-256'] as const;
  const crv = curveMap[parseInt(crvChoice, 10) - 1] ?? 'Ed25519';
  const generated = await service.generateKey({ id, kty, crv, purpose: purpose || undefined, did: did || undefined });
  console.log(`  ✓ Key generated. keyRef=${generated.keyRef}\n`);
};

const importKey = async (service: CliDidService, rli: Interface): Promise<void> => {
  console.log('\n  Import key');
  const id = await rli.question('  Local key id: ');
  const ktyChoice = await rli.question('  Key type [1=EC, 2=OKP]: ');
  const crvChoice = await rli.question('  Curve [1=Ed25519, 2=Jubjub, 3=P-256]: ');
  const privateKeyHex = await rli.question('  Private key bytes (hex): ');
  const kty = ktyChoice.trim() === '2' ? 'OKP' : 'EC';
  const curveMap = ['Ed25519', 'Jubjub', 'P-256'] as const;
  const crv = curveMap[parseInt(crvChoice, 10) - 1] ?? 'Ed25519';
  const imported = await service.importKey({
    id,
    kty,
    crv,
    privateKey: Buffer.from(privateKeyHex.trim(), 'hex'),
  });
  console.log(`  ✓ Key imported. keyRef=${imported.keyRef}\n`);
};

/**
 * Main interaction loop. Once a contract is deployed/joined, the user
 * can perform various DID operations.
 */
const mainLoop = async (
  service: CliDidService,
  providers: DIDProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<void> => {
  const didContract = await deployOrJoin(service, walletCtx, rli);
  if (didContract === null) {
    return;
  }

  await renderHints(service);

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(didMenu(dustLabel));
    try {
      switch (choice.trim()) {
        case '1': // Generate key
          await generateKey(service, rli);
          break;
        case '2': // Import key
          await importKey(service, rli);
          break;
        case '3': // List keys
          await listKeys(service);
          break;
        case '4': {
          // Add verification method
          console.log('\n  Add Verification Method');
          const methodId = await rli.question('  Method ID (e.g., #key-1): ');
          const keyRef = await rli.question('  keyRef from secret store: ');
          await api.withStatus('Adding verification method', () =>
            service.addVerificationMethodFromKey({ methodId, keyRef }),
          );
          break;
        }
        case '5': {
          // Update verification method
          console.log('\n  Update Verification Method');
          const methodId = await rli.question('  Method ID to update: ');
          const keyRef = await rli.question('  New keyRef from secret store: ');
          await api.withStatus('Updating verification method', () =>
            service.updateVerificationMethodFromKey({ methodId, keyRef }),
          );
          break;
        }
        case '6': {
          // Remove verification method
          console.log('\n  Remove Verification Method');
          const methodId = await rli.question('  Method ID to remove: ');
          await api.withStatus('Removing verification method', () => service.removeVerificationMethod({ methodId }));
          break;
        }
        case '7': {
          // Add relation
          console.log('\n  Add Verification Method Relation');
          const methodId = await rli.question('  Method ID: ');
          const relation = await promptRelation(rli);
          await api.withStatus('Adding relation', () => service.addRelation({ methodId, relation }));
          break;
        }
        case '8': {
          // Remove relation
          console.log('\n  Remove Verification Method Relation');
          const methodId = await rli.question('  Method ID: ');
          const relation = await promptRelation(rli);
          await api.withStatus('Removing relation', () => service.removeRelation({ methodId, relation }));
          break;
        }
        case '9': {
          // Add service
          console.log('\n  Add Service');
          const id = await rli.question('  Service ID (e.g., #service-1): ');
          const type = await rli.question('  Service type (e.g., MessagingService): ');
          const endpoint = await rli.question('  Service endpoint (URL): ');
          await api.withStatus('Adding service', () => service.addService({ id, type, serviceEndpoint: endpoint }));
          break;
        }
        case '10': {
          // Update service
          console.log('\n  Update Service');
          const id = await rli.question('  Service ID to update: ');
          const type = await rli.question('  New service type: ');
          const endpoint = await rli.question('  New service endpoint (URL): ');
          await api.withStatus('Updating service', () =>
            service.updateService({ id, type, serviceEndpoint: endpoint }),
          );
          break;
        }
        case '11': {
          // Remove service
          console.log('\n  Remove Service');
          const id = await rli.question('  Service ID to remove: ');
          await api.withStatus('Removing service', () => service.removeService({ id }));
          break;
        }
        case '12': {
          // Add alsoKnownAs
          console.log('\n  Add AlsoKnownAs');
          const value = await rli.question('  Alias value (e.g., did:example:alternative-id): ');
          await api.withStatus('Adding alsoKnownAs', () => service.addAlsoKnownAs({ value }));
          break;
        }
        case '13': {
          // Remove alsoKnownAs
          console.log('\n  Remove AlsoKnownAs');
          const value = await rli.question('  Alias value to remove: ');
          await api.withStatus('Removing alsoKnownAs', () => service.removeAlsoKnownAs({ value }));
          break;
        }
        case '14': // Display DID state
          await api.displayDIDState(providers, didContract);
          break;
        case '15': {
          // Deactivate DID
          console.log('\n  Deactivate DID');
          const confirm = await rli.question('  Are you sure? This action cannot be undone [y/N]: ');
          if (confirm.toLowerCase() === 'y') {
            await api.withStatus('Deactivating DID', () => service.deactivateDid());
          } else {
            console.log('  Cancelled\n');
          }
          break;
        }
        case '16': // Show next hints
          await renderHints(service);
          break;
        case '17': // Exit
          return;
        default:
          console.log(`  Invalid choice: ${choice}`);
      }
      if (choice.trim() !== '14' && choice.trim() !== '16') {
        await renderHints(service);
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
 *   4. Enter the contract deploy/join and DID interaction loop
 *   5. Clean up: close wallet, readline, and docker environment
 */
export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);

  // Print the title banner
  console.log(BANNER);

  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;
  const sessionStorePath = process.env.CLI_SESSION_FILE_PATH ?? DEFAULT_SESSION_STORE_PATH;
  const profileId = profileIdForConfig(config);
  const sessionStore = await readSessionStore(sessionStorePath);
  const existingSession = sessionStore.profiles[profileId];
  let activeSeed: string | null = null;

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

    // Step 2: Build wallet (create new, restore, or reuse stored seed)
    let walletCtx: WalletContext | null = null;
    let shouldRestoreContract = false;
    if (config instanceof StandaloneConfig) {
      activeSeed = GENESIS_MINT_WALLET_SEED;
      walletCtx = await api.buildWalletAndWaitForFunds(config, activeSeed);
      await upsertSessionEntry(sessionStorePath, profileId, {
        seed: activeSeed,
        contractAddress: existingSession?.contractAddress,
      });
    } else if (existingSession?.seed) {
      const resumeChoice = await rli.question(
        `${DIVIDER}\n  Stored session found for ${profileId}\n${DIVIDER}\n  [1] Reuse stored wallet seed\n  [2] Create a new wallet\n  [3] Restore wallet from another seed\n  [4] Exit\n${'─'.repeat(62)}\n> `,
      );
      if (resumeChoice.trim() === '1') {
        activeSeed = existingSession.seed;
        shouldRestoreContract = true;
        walletCtx = await api.buildWalletAndWaitForFunds(config, activeSeed);
      } else if (resumeChoice.trim() === '2') {
        activeSeed = generateSeedHex();
        console.log(`\n  Generated wallet seed: ${activeSeed}\n`);
        walletCtx = await api.buildWalletAndWaitForFunds(config, activeSeed);
      } else if (resumeChoice.trim() === '3') {
        activeSeed = (await rli.question('Enter your wallet seed: ')).trim();
        walletCtx = await api.buildWalletAndWaitForFunds(config, activeSeed);
      } else {
        return;
      }
    } else {
      while (true) {
        const choice = await rli.question(
          `${DIVIDER}\n  Wallet Setup\n${DIVIDER}\n  [1] Create a new wallet\n  [2] Restore wallet from seed\n  [3] Exit\n${'─'.repeat(62)}\n> `,
        );
        if (choice.trim() === '1') {
          activeSeed = generateSeedHex();
          console.log(`\n  Generated wallet seed: ${activeSeed}\n`);
          walletCtx = await api.buildWalletAndWaitForFunds(config, activeSeed);
          break;
        }
        if (choice.trim() === '2') {
          activeSeed = (await rli.question('Enter your wallet seed: ')).trim();
          walletCtx = await api.buildWalletAndWaitForFunds(config, activeSeed);
          break;
        }
        if (choice.trim() === '3') {
          return;
        }
        console.log(`  Invalid choice: ${choice}`);
      }
    }

    if (walletCtx === null) return;
    if (activeSeed !== null) {
      await upsertSessionEntry(sessionStorePath, profileId, {
        seed: activeSeed,
        contractAddress: shouldRestoreContract ? existingSession?.contractAddress : undefined,
      });
    }

    try {
      // Step 3: Configure midnight-js providers
      const providers = await api.withStatus('Configuring providers', () => api.configureProviders(walletCtx, config));
      const secretStore = new FileSecretStore();
      const secretStorePath = process.env.CLI_SECRET_FILE_PATH ?? DEFAULT_SECRET_STORE_PATH;
      const secretStorePassphrase = process.env.CLI_SECRET_PASSPHRASE ?? 'midnight-dev-passphrase';
      await secretStore.initialize({
        location: secretStorePath,
        passphrase: secretStorePassphrase,
      });
      const service = new CliDidService({
        providers,
        secretStorage: secretStore,
      });
      console.log('');

      // Restore last joined/deployed contract if session has one.
      if (shouldRestoreContract && existingSession?.contractAddress) {
        try {
          await api.withStatus('Restoring previous DID contract session', () =>
            service.joinDid({ contractAddress: existingSession.contractAddress! }),
          );
          console.log(`  ✓ Restored DID contract: ${existingSession.contractAddress}\n`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ⚠ Failed to restore previous contract (${existingSession.contractAddress}): ${msg}\n`);
        }
      }

      // Step 4: Enter the contract interaction loop
      await mainLoop(service, providers, walletCtx, rli);

      // Persist latest session state for resume.
      const contractAddress = service.getDidContract()?.deployTxData.public.contractAddress;
      if (activeSeed !== null || existingSession?.seed) {
        await upsertSessionEntry(sessionStorePath, profileId, {
          seed: activeSeed ?? existingSession!.seed,
          contractAddress: contractAddress ?? existingSession?.contractAddress,
        });
      }
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
