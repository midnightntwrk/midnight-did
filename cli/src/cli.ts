// This file is part of midnightntwrk/example-counter.
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

import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';

import {
  createMidnightDIDString,
  createVerificationMethod,
  CurveType,
  DIDOperation,
  DIDOperationType,
  KeyType,
  MidnightDIDString,
  parseContractAddress,
  parseDIDURL,
  parseVerificationMethodRelation,
  VerificationMethod,
  VerificationMethodRelation,
  VerificationMethodType,
} from '@midnight-ntwrk/midnight-did-contract';
import { type Resource } from '@midnight-ntwrk/wallet';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import { type Logger } from 'pino';
import { type DockerComposeEnvironment, type StartedDockerComposeEnvironment } from 'testcontainers';

import * as api from './api';
import { type DeployedMidnightDIDContract, type MidnightDIDProviders } from './common-types';
import { type Config, StandaloneConfig } from './config';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node - only
 * used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const MAIN_LOOP_QUESTIONS = `
You can do one of the following:
  1. Create the MidnightDID
  2. Resolve the MidnightDID
  3. Update the existing MidnightDID
  4. Exit
Which would you like to do?`;

const mainLoop = async (providers: MidnightDIDProviders, rli: Interface): Promise<void> => {
  while (true) {
    const choice = await rli.question(MAIN_LOOP_QUESTIONS);
    switch (choice) {
      case '1': {
        const privateState = await api.initPrivateState(providers);
        await api.createDID(providers, privateState);
        logger.info('DID created successfully.');
        break;
      }
      case '2': {
        const contract = await findContractByAddress(providers, rli);
        const didDocument = await api.resolve(providers, contract);
        if (didDocument != null) logger.info('DID resolved successfully.');
        else logger.error('Failed to resolve the DID...');
        break;
      }
      case '3': {
        const contract = await findContractByAddress(providers, rli);
        await updateDIDLoop(providers, rli, contract);
        break;
      }
      case '4':
        logger.info('Exiting...');
        return;
      default:
        logger.error(`Invalid choice: ${choice}`);
        break;
    }
  }
};

const UPDATE_DID_QUESTIONS = `
You can do one of the following actions to update the DID:
  1. Add Verification Method
  2. Add Verification Relation
  3. Publish Patches
  4. Exit
Which would you like to do? `;

const updateDIDLoop = async (
  providers: MidnightDIDProviders,
  rli: Interface,
  contract: DeployedMidnightDIDContract,
): Promise<void> => {
  let pendingOperations: DIDOperation[] = [];
  const contractAddress = parseContractAddress(contract.deployTxData.public.contractAddress);
  const didStr = createMidnightDIDString(contractAddress, api.midnightNetwork);

  while (true) {
    const choice = await rli.question(UPDATE_DID_QUESTIONS);
    switch (choice) {
      case '1': {
        const verificationMethod = await promptForVerificationMethod(rli, didStr);
        if (verificationMethod == null) {
          logger.error('Invalid verification method input...');
        } else {
          pendingOperations.push({
            type: DIDOperationType.AddVerificationMethod,
            verificationMethod: verificationMethod,
          });
          logger.info('Verification method operation added to pending patches.');
        }
        break;
      }
      case '2': {
        const verificationMethodRelation = await promptForVerificationMethodRelation(rli);
        const methodId = await promptForVerificationMethodId(rli);

        if (verificationMethodRelation === null || methodId === null) {
          logger.error('Invalid input for verification method relation or id...');
        } else {
          pendingOperations.push({
            type: DIDOperationType.AddVerificationMethodRelation,
            methodId: methodId,
            relation: verificationMethodRelation,
          });
          logger.info('Verification relation operation added to pending patches.');
        }
        break;
      }
      case '3': {
        if (pendingOperations.length === 0) {
          logger.warn('No pending patches to publish. Please add operations first.');
        } else {
          try {
            await api.update(contract, pendingOperations);
            logger.info('Published patches to the DID contract successfully.');
            pendingOperations = [];
          } catch (e) {
            logger.error(`Failed to publish patches: ${e instanceof Error ? e.message : e}`);
          }
        }
        break;
      }
      case '4': {
        logger.info('Returning to main menu...');
        return;
      }
      default:
        logger.error(`Invalid choice: ${choice}`);
        break;
    }
  }
};

async function promptForVerificationMethod(rli: Interface, did: MidnightDIDString): Promise<VerificationMethod | null> {
  const id = await rli.question('Enter Verification Method id: ');
  let verificationMethodId = `${did}#${id.trim()}`;

  const verificationMethodTypeInput = await rli.question(`
Enter Verification Method type:'
 1. ${VerificationMethodType.JsonWebKey}
`);

  let verificationMethodType: VerificationMethodType = VerificationMethodType.Undefined;
  switch (verificationMethodTypeInput) {
    case '1':
      verificationMethodType = VerificationMethodType.JsonWebKey;
      break;
  }

  return createVerificationMethod({
    id: verificationMethodId,
    type: verificationMethodType,
    controller: did,
    publicKeyJwk: {
      kty: KeyType.EC,
      crv: CurveType.ed25519,
      x: 0n,
      y: 0n,
    },
  });
}

async function promptForVerificationMethodRelation(rli: Interface): Promise<VerificationMethodRelation | null> {
  const relationTypeInput = await rli.question('Enter relationType: ');
  let verificationRelationType = parseVerificationMethodRelation(relationTypeInput.trim());
  return verificationRelationType;
}

async function promptForVerificationMethodId(rli: Interface): Promise<string | null> {
  const methodIdInput = await rli.question('Enter methodId for relation: ');
  let methodId = parseDIDURL(methodIdInput.trim()); //did:midnight:mainnet:asdfg..asd#auth-0
  return methodId;
}

const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<Wallet & Resource> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await api.buildWalletAndWaitForFunds(config, seed, '');
};

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface): Promise<(Wallet & Resource) | null> => {
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED, '');
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);

  mappedUrl.port = String(container.getFirstMappedPort());

  return mappedUrl.toString().replace(/\/+$/, '');
};

export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);
  const rli = createInterface({ input, output, terminal: true });
  let env;
  if (dockerEnv !== undefined) {
    env = await dockerEnv.up();

    if (config instanceof StandaloneConfig) {
      config.indexer = mapContainerPort(env, config.indexer, 'counter-indexer');
      config.indexerWS = mapContainerPort(env, config.indexerWS, 'counter-indexer');
      config.node = mapContainerPort(env, config.node, 'counter-node');
      config.proofServer = mapContainerPort(env, config.proofServer, 'counter-proof-server');
    }
  }
  const wallet = await buildWallet(config, rli);
  try {
    if (wallet !== null) {
      const providers = await api.configureProviders(wallet, config);
      await mainLoop(providers, rli);
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(`Found error '${e.message}'`);
      logger.info('Exiting...');
      logger.debug(`${e.stack}`);
    } else {
      throw e;
    }
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logger.error(`Error closing readline interface: ${e}`);
    } finally {
      try {
        if (wallet !== null) {
          await wallet.close();
        }
      } catch (e) {
        logger.error(`Error closing wallet: ${e}`);
      } finally {
        try {
          if (env !== undefined) {
            await env.down();
            logger.info('Goodbye');
          }
        } catch (e) {
          logger.error(`Error shutting down docker environment: ${e}`);
        }
      }
    }
  }
};
async function findContractByAddress(providers: MidnightDIDProviders, rli: Interface) {
  const constractAddress: string = await rli.question(`Enter the MidnightDID contract address:`);
  const contract = await api.joinContract(providers, constractAddress);
  return contract;
}
