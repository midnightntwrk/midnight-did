import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

import type { Ledger } from "./managed/demo/contract/index.js";

export type CredentialsDemoPrivateState = {
  readonly holderBirthDateDays: bigint;
  readonly holderBirthDateOpening: Uint8Array;
};

export const witnesses = {
  holderBirthDateDays: ({
    privateState,
  }: WitnessContext<Ledger, CredentialsDemoPrivateState>): [
    CredentialsDemoPrivateState,
    bigint,
  ] => [privateState, privateState.holderBirthDateDays],
  holderBirthDateOpening: ({
    privateState,
  }: WitnessContext<Ledger, CredentialsDemoPrivateState>): [
    CredentialsDemoPrivateState,
    Uint8Array,
  ] => [privateState, privateState.holderBirthDateOpening],
};
