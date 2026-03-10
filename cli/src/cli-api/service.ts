import { normalizePublicForLedger, type SecretStorage } from '@midnight-ntwrk/midnight-did-secret-storage';

import * as api from '../api';
import { CliTransitionError } from './errors';
import { buildHints } from './hints';
import { deriveLedgerSnapshot, deriveState } from './state';
import { guardTransition } from './transitions';
import {
  type AddMethodFromKeyInput,
  type AddRelationInput,
  type AddServiceInput,
  type AliasInput,
  CliDidState,
  type CliServiceOptions,
  type CommandResult,
  type DeriveKeyFromSeedInput,
  type GenerateKeyInput,
  type ImportKeyInput,
  type RemoveRelationInput,
  type RemoveServiceInput,
  type StateContext,
  type UpdateMethodFromKeyInput,
  type UpdateServiceInput,
} from './types';

export class CliDidService {
  private readonly providers: api.DIDProviders;
  private readonly secretStorage: SecretStorage;
  private didContract: api.DeployedDIDContract | null;

  constructor(options: CliServiceOptions) {
    this.providers = options.providers;
    this.secretStorage = options.secretStorage;
    this.didContract = options.didContract ?? null;
  }

  setDidContract(didContract: api.DeployedDIDContract | null): void {
    this.didContract = didContract;
  }

  getDidContract(): api.DeployedDIDContract | null {
    return this.didContract;
  }

  async refreshContext(): Promise<StateContext> {
    const hasContract = this.didContract !== null;
    if (!hasContract || this.didContract === null) {
      const state = CliDidState.NoContract;
      return {
        providers: this.providers,
        didContract: null,
        ledgerSnapshot: null,
        state,
        hints: buildHints(state, null),
      };
    }

    const ledger = await api.getDIDLedgerState(this.providers, this.didContract.deployTxData.public.contractAddress);
    const snapshot = ledger ? deriveLedgerSnapshot(ledger) : null;
    const state = deriveState(true, snapshot);

    return {
      providers: this.providers,
      didContract: this.didContract,
      ledgerSnapshot: snapshot,
      state,
      hints: buildHints(state, snapshot),
    };
  }

  async getCurrentState(): Promise<CliDidState> {
    return (await this.refreshContext()).state;
  }

  async getNextActions() {
    return (await this.refreshContext()).hints;
  }

  async listKeys() {
    return this.secretStorage.listKeys();
  }

  async generateKey(input: GenerateKeyInput) {
    return this.secretStorage.generateKey(input);
  }

  async deriveKeyFromSeed(input: DeriveKeyFromSeedInput) {
    return this.secretStorage.deriveKeyFromSeed(input);
  }

  async importKey(input: ImportKeyInput) {
    return this.secretStorage.importKey(input);
  }

  async deployDid(): Promise<CommandResult<{ contractAddress: string }>> {
    const ctx = await this.refreshContext();
    const guard = guardTransition(ctx.state, 'DeployContract');
    if (!guard.allowed) {
      throw new CliTransitionError(guard.reason, guard.fix);
    }

    const contract = await api.deploy(this.providers);
    this.didContract = contract;
    const next = await this.refreshContext();
    return {
      status: 'ok',
      message: 'DID contract deployed',
      data: { contractAddress: contract.deployTxData.public.contractAddress },
      hints: next.hints,
      state: next.state,
    };
  }

  async joinDid(input: { contractAddress: string }): Promise<CommandResult<{ contractAddress: string }>> {
    const ctx = await this.refreshContext();
    const guard = guardTransition(ctx.state, 'JoinContract');
    if (!guard.allowed) {
      throw new CliTransitionError(guard.reason, guard.fix);
    }

    const contract = await api.joinContract(this.providers, input.contractAddress);
    this.didContract = contract;
    const next = await this.refreshContext();
    return {
      status: 'ok',
      message: 'DID contract joined',
      data: { contractAddress: contract.deployTxData.public.contractAddress },
      hints: next.hints,
      state: next.state,
    };
  }

  async addVerificationMethodFromKey(input: AddMethodFromKeyInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'AddVerificationMethodFromKey');

    const publicJwk = await this.secretStorage.getPublicKey(input.keyRef);
    const ledgerKey = normalizePublicForLedger(publicJwk);
    await api.addVerificationMethod(didContract, input.methodId, ledgerKey);

    return this.successResult('Verification method added from keyRef');
  }

  async updateVerificationMethodFromKey(input: UpdateMethodFromKeyInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'UpdateVerificationMethodFromKey');

    const publicJwk = await this.secretStorage.getPublicKey(input.keyRef);
    const ledgerKey = normalizePublicForLedger(publicJwk);
    await api.updateVerificationMethod(didContract, input.methodId, ledgerKey);

    return this.successResult('Verification method updated from keyRef');
  }

  async removeVerificationMethod(input: { methodId: string }): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'RemoveVerificationMethod');
    await api.removeVerificationMethod(didContract, this.providers, input.methodId);
    return this.successResult('Verification method removed');
  }

  async addRelation(input: AddRelationInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'AddRelation');
    await api.addVerificationMethodRelation(didContract, this.providers, input.relation, input.methodId);
    return this.successResult('Relation added');
  }

  async removeRelation(input: RemoveRelationInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'RemoveRelation');
    await api.removeVerificationMethodRelation(didContract, this.providers, input.relation, input.methodId);
    return this.successResult('Relation removed');
  }

  async addService(input: AddServiceInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'AddService');
    await api.addService(didContract, input.id, input.type, input.serviceEndpoint);
    return this.successResult('Service added');
  }

  async updateService(input: UpdateServiceInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'UpdateService');
    await api.updateService(didContract, input.id, input.type, input.serviceEndpoint);
    return this.successResult('Service updated');
  }

  async removeService(input: RemoveServiceInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'RemoveService');
    await api.removeService(didContract, input.id);
    return this.successResult('Service removed');
  }

  async addAlsoKnownAs(input: AliasInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'AddAlsoKnownAs');
    await api.addAlsoKnownAs(didContract, input.value);
    return this.successResult('AlsoKnownAs added');
  }

  async removeAlsoKnownAs(input: AliasInput): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'RemoveAlsoKnownAs');
    await api.removeAlsoKnownAs(didContract, input.value);
    return this.successResult('AlsoKnownAs removed');
  }

  async deactivateDid(): Promise<CommandResult> {
    const didContract = this.requireContract();
    this.assertTransition((await this.refreshContext()).state, 'DeactivateDID');
    await api.deactivateDID(didContract);
    return this.successResult('DID deactivated');
  }

  async signPayload(input: { keyRef: string; payload: Uint8Array }): Promise<CommandResult<{ signature: Uint8Array }>> {
    this.assertTransition((await this.refreshContext()).state, 'SignPayload');
    const signed = await this.secretStorage.sign(input);
    const next = await this.refreshContext();
    return {
      status: 'ok',
      message: 'Payload signed',
      data: { signature: signed.signature },
      hints: next.hints,
      state: next.state,
    };
  }

  async verifyPayload(input: {
    keyRef?: string;
    publicJwk?: { kty: 'EC' | 'OKP'; crv: 'Ed25519' | 'Jubjub' | 'P-256'; x: string; y?: string };
    payload: Uint8Array;
    signature: Uint8Array;
  }): Promise<CommandResult<{ valid: boolean }>> {
    this.assertTransition((await this.refreshContext()).state, 'VerifyPayload');
    const valid = await this.secretStorage.verify(input);
    const next = await this.refreshContext();
    return {
      status: 'ok',
      message: valid ? 'Signature is valid' : 'Signature is invalid',
      data: { valid },
      hints: next.hints,
      state: next.state,
    };
  }

  private requireContract(): api.DeployedDIDContract {
    if (this.didContract === null) {
      throw new CliTransitionError('No DID contract is selected', 'Deploy or join a contract first.');
    }
    return this.didContract;
  }

  private assertTransition(state: CliDidState, event: Parameters<typeof guardTransition>[1]): void {
    const guard = guardTransition(state, event);
    if (!guard.allowed) {
      throw new CliTransitionError(guard.reason, guard.fix);
    }
  }

  private async successResult(message: string): Promise<CommandResult> {
    const next = await this.refreshContext();
    return {
      status: 'ok',
      message,
      hints: next.hints,
      state: next.state,
    };
  }
}
