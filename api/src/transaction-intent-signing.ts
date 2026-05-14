import * as ledger from "@midnight-ntwrk/ledger-v8";

type TransactionIntentSegment = {
  serialize: () => Uint8Array;
};

type TransactionWithIntents = {
  intents?: Map<number, TransactionIntentSegment>;
};

type UnshieldedOfferWithSignatures = {
  inputs: readonly unknown[];
  signatures: {
    at: (index: number) => ledger.Signature | undefined;
  };
  addSignatures: (
    signatures: ledger.Signature[],
  ) => UnshieldedOfferWithSignatures;
};

export type SignableTransactionIntent = TransactionIntentSegment & {
  signatureData: (segment: number) => Uint8Array;
  fallibleUnshieldedOffer?: UnshieldedOfferWithSignatures;
  guaranteedUnshieldedOffer?: UnshieldedOfferWithSignatures;
};

export type TransactionIntentDeserializer = (
  serializedIntent: Uint8Array,
  proofMarker: "proof" | "pre-proof",
) => SignableTransactionIntent;

const deserializeLedgerIntent: TransactionIntentDeserializer = (
  serializedIntent,
  proofMarker,
) =>
  ledger.Intent.deserialize(
    "signature",
    proofMarker,
    "pre-binding",
    serializedIntent,
  ) as SignableTransactionIntent;

const signaturesForOffer = (
  offer: UnshieldedOfferWithSignatures,
  signature: ledger.Signature,
): ledger.Signature[] =>
  offer.inputs.map((_input, index) => offer.signatures.at(index) ?? signature);

// SDK v8 currently leaves some unshielded intent signatures unset after
// balancing. Keep the workaround isolated and covered until the SDK boundary is
// fixed upstream.
export const signTransactionIntents = (
  tx: TransactionWithIntents,
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
  deserializeIntent: TransactionIntentDeserializer = deserializeLedgerIntent,
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = deserializeIntent(intent.serialize(), proofMarker);
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      cloned.fallibleUnshieldedOffer =
        cloned.fallibleUnshieldedOffer.addSignatures(
          signaturesForOffer(cloned.fallibleUnshieldedOffer, signature),
        );
    }

    if (cloned.guaranteedUnshieldedOffer) {
      cloned.guaranteedUnshieldedOffer =
        cloned.guaranteedUnshieldedOffer.addSignatures(
          signaturesForOffer(cloned.guaranteedUnshieldedOffer, signature),
        );
    }

    tx.intents.set(segment, cloned);
  }
};
