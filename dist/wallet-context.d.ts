import { type Config } from "./config.js";
import { type MidnightDIDWalletContext, type MidnightWalletStateSnapshot } from "./types.js";
export declare const createWalletContext: (config: Config, seed: string, snapshot?: MidnightWalletStateSnapshot) => Promise<MidnightDIDWalletContext>;
