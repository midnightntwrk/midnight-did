import type { WalletBridge } from "../bridge/wallet-bridge.js";
import type { CryptoTransferReceipt, InvestmentDecision } from "../types.js";
import type { CryptoWalletStub } from "./crypto-wallet.js";
import type { InvestmentVerifierContractStub } from "./investment-verifier.js";

export type InvestmentFlowResult = {
  readonly decision: InvestmentDecision;
  readonly receipt?: CryptoTransferReceipt;
};

export class MidnightPassportDapp {
  constructor(
    private readonly verifier: InvestmentVerifierContractStub,
    private readonly walletBridge: WalletBridge,
    private readonly cryptoWallet: CryptoWalletStub,
  ) {}

  requestDisclosureSummary(): readonly string[] {
    const product = this.verifier.requirements();
    return [
      `Age is at least ${product.minimumAgeYears.toString()}`,
      "Sanctions screening result is PASS",
      "PEP flag is false",
      `Compliance screening is not older than ${product.maxScreeningAgeDays.toString()} days`,
      "National ID and compliance credentials belong to the same hidden holder",
    ];
  }

  submitApprovedProof(): InvestmentFlowResult {
    const proof = this.walletBridge.createInvestmentProof(this.verifier);
    const decision = this.verifier.verify(proof, this.walletBridge.profile());
    return {
      decision,
      receipt: decision.approved
        ? this.verifier.settle({ decision, wallet: this.cryptoWallet })
        : undefined,
    };
  }
}
