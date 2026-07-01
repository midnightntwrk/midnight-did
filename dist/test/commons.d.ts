import type { Logger } from "pino";
import { type StartedDockerComposeEnvironment, type StartedTestContainer } from "testcontainers";
import { type Config, StandaloneConfig } from "../config.js";
import * as api from "../index.js";
export interface TestConfiguration {
    seed: string;
    entrypoint: string;
    dappConfig: Config;
    psMode: string;
    cacheFileName: string;
}
export declare class LocalTestConfig implements TestConfiguration {
    seed: string;
    entrypoint: string;
    psMode: string;
    cacheFileName: string;
    dappConfig: StandaloneConfig;
}
export declare function parseArgs(required: string[]): TestConfiguration;
export declare class TestEnvironment {
    private readonly logger;
    private env;
    private container;
    private walletCtx;
    private testConfig;
    private composeFile;
    private composeProjectName;
    private composeResolved;
    constructor(logger: Logger);
    start: () => Promise<TestConfiguration>;
    static mapContainerPort: (env: StartedDockerComposeEnvironment, url: string, containerName: string) => string;
    static getProofServerContainer: (env: string) => Promise<StartedTestContainer>;
    shutdown: () => Promise<void>;
    private resolveComposeFile;
    getWallet: () => Promise<api.MidnightDIDWalletContext>;
}
