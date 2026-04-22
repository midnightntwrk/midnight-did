import type { CryptoTransferReceipt } from "../types.js";

export class CryptoWalletStub {
  constructor(
    public readonly address: string,
    private balance: bigint,
  ) {}

  getBalance(): bigint {
    return this.balance;
  }

  transfer({
    to,
    amount,
  }: {
    readonly to: string;
    readonly amount: bigint;
  }): CryptoTransferReceipt {
    if (amount <= 0n) {
      throw new Error("Transfer amount must be positive");
    }
    if (this.balance < amount) {
      throw new Error("Insufficient external wallet balance");
    }

    this.balance -= amount;
    return {
      from: this.address,
      to,
      amount,
      txId: `stub-tx-${this.address}-${to}-${amount}`,
    };
  }
}
