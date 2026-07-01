import { type MidnightProvider, type WalletProvider } from "@midnight-ntwrk/midnight-js-types";
import { type MidnightDIDWalletContext } from "./types.js";
export declare const createWalletAndMidnightProvider: (ctx: MidnightDIDWalletContext) => Promise<WalletProvider & MidnightProvider>;
