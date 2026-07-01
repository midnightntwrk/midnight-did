import { parseMidnightDID, parseMidnightDIDString, } from "@midnight-ntwrk/midnight-did-domain";
import { LedgerToDomain } from "./ledger-to-domain.js";
import { MidnightNetwork } from "./midnight.js";
export class MidnightDIDResolver {
    ledgerReader;
    expectedNetwork;
    constructor(options) {
        this.ledgerReader = options.ledgerReader;
        this.expectedNetwork = options.expectedNetwork ?? null;
    }
    async resolve(did) {
        const result = await this.resolveResult(did);
        if (result === null) {
            throw new Error(`DID not found: ${did}`);
        }
        return result.didDocument;
    }
    async resolveResult(did) {
        const parsed = parseMidnightDIDString(did);
        const { network, id } = parseMidnightDID(parsed);
        if (network === MidnightNetwork.Offchain) {
            throw new Error("Offchain Midnight DIDs must be resolved from their long-form encoded state, not through the ledger resolver");
        }
        if (this.expectedNetwork !== null && network !== this.expectedNetwork) {
            throw new Error(`Network mismatch: DID network is ${network}, expected ${this.expectedNetwork}`);
        }
        const contractAddress = id;
        const ledgerState = await this.ledgerReader(contractAddress);
        if (ledgerState === null)
            return null;
        return {
            didDocument: LedgerToDomain.ledgerStateToDIDDocument(ledgerState, network, contractAddress),
            didDocumentMetadata: LedgerToDomain.ledgerStateToMetadata(ledgerState),
        };
    }
}
//# sourceMappingURL=midnight-did-resolver.js.map