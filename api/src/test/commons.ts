import { unshieldedToken } from "@midnight-ntwrk/ledger-v7";
import type { Logger } from "pino";
import * as Rx from "rxjs";
import {
  DockerComposeEnvironment,
  GenericContainer,
  type StartedDockerComposeEnvironment,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { expect } from "vitest";

import * as api from "..";
import {
  type Config,
  currentDir,
  StandaloneConfig,
  TestnetRemoteConfig,
} from "../config";

const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

export interface TestConfiguration {
  seed: string;
  entrypoint: string;
  dappConfig: Config;
  psMode: string;
  cacheFileName: string;
}

export class LocalTestConfig implements TestConfiguration {
  seed = GENESIS_MINT_WALLET_SEED;
  entrypoint = "dist/standalone.js";
  psMode = "undeployed";
  cacheFileName = "";
  dappConfig = new StandaloneConfig();
}

export function parseArgs(required: string[]): TestConfiguration {
  let entry = "";
  if (required.includes("entry")) {
    if (process.env.TEST_ENTRYPOINT !== undefined) {
      entry = process.env.TEST_ENTRYPOINT;
    } else {
      throw new Error("TEST_ENTRYPOINT environment variable is not defined.");
    }
  }

  let seed = "";
  if (required.includes("seed")) {
    if (process.env.TEST_WALLET_SEED !== undefined) {
      seed = process.env.TEST_WALLET_SEED;
    } else {
      throw new Error("TEST_WALLET_SEED environment variable is not defined.");
    }
  }

  let cfg: Config = new TestnetRemoteConfig();
  let env = "";
  let psMode = "undeployed";
  let cacheFileName = "";
  if (required.includes("env")) {
    if (process.env.TEST_ENV !== undefined) {
      env = process.env.TEST_ENV;
    } else {
      throw new Error("TEST_ENV environment variable is not defined.");
    }
    switch (env) {
      case "testnet":
        cfg = new TestnetRemoteConfig();
        psMode = "testnet";
        cacheFileName = `${seed.substring(0, 7)}-${psMode}.state`;
        break;
      default:
        throw new Error(`Unknown env value=${env}`);
    }
  }

  return {
    seed,
    entrypoint: entry,
    dappConfig: cfg,
    psMode,
    cacheFileName,
  };
}

export class TestEnvironment {
  private readonly logger: Logger;
  private env: StartedDockerComposeEnvironment | undefined;
  private dockerEnv: DockerComposeEnvironment | undefined;
  private container: StartedTestContainer | undefined;
  private walletCtx: api.MidnightDIDWalletContext | undefined;
  private testConfig: TestConfiguration;

  constructor(logger: Logger) {
    this.logger = logger;
    this.testConfig = new LocalTestConfig();
  }

  start = async (): Promise<TestConfiguration> => {
    if (process.env.RUN_ENV_TESTS === "true") {
      this.testConfig = parseArgs(["seed", "env"]);
      this.logger.info(`Test wallet seed: ${this.testConfig.seed}`);
      this.logger.info("Proof server starting...");
      this.container = await TestEnvironment.getProofServerContainer(
        this.testConfig.psMode,
      );
      this.testConfig.dappConfig = {
        ...this.testConfig.dappConfig,
        proofServer: `http://${this.container.getHost()}:${this.container.getMappedPort(6300).toString()}`,
      };
    } else {
      this.testConfig = new LocalTestConfig();
      this.logger.info("Test containers starting...");
      const composeFile = process.env.COMPOSE_FILE ?? "standalone.yml";
      this.logger.info(`Using compose file: ${composeFile}`);
      this.dockerEnv = new DockerComposeEnvironment(currentDir, composeFile)
        .withWaitStrategy(
          "did-proof-server",
          Wait.forLogMessage(
            "Actix runtime found; starting in Actix runtime",
            1,
          ),
        )
        .withWaitStrategy(
          "did-indexer",
          Wait.forHealthCheck().withStartupTimeout(180000),
        );
      this.env = await this.dockerEnv.up();

      this.testConfig.dappConfig = {
        ...this.testConfig.dappConfig,
        indexer: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.indexer,
          "did-indexer",
        ),
        indexerWS: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.indexerWS,
          "did-indexer",
        ),
        node: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.node,
          "did-node",
        ),
        proofServer: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.proofServer,
          "did-proof-server",
        ),
      };
    }
    this.logger.info(`Configuration:${JSON.stringify(this.testConfig)}`);
    this.logger.info("Test containers started");
    return this.testConfig;
  };

  static mapContainerPort = (
    env: StartedDockerComposeEnvironment,
    url: string,
    containerName: string,
  ) => {
    const mappedUrl = new URL(url);
    const container = env.getContainer(containerName);
    mappedUrl.port = String(container.getFirstMappedPort());
    return mappedUrl.toString().replace(/\/+$/, "");
  };

  static getProofServerContainer = async (env: string) =>
    await new GenericContainer("midnightntwrk/proof-server:7.0.0")
      .withExposedPorts(6300)
      .withCommand([`midnight-proof-server --network ${env}`])
      .withEnvironment({ RUST_BACKTRACE: "full" })
      .withWaitStrategy(
        Wait.forLogMessage(
          "Actix runtime found; starting in Actix runtime",
          1000000,
        ),
      )
      .start();

  shutdown = async () => {
    if (this.walletCtx !== undefined) {
      await this.walletCtx.wallet.stop();
    }
    if (this.env !== undefined) {
      this.logger.info("Test containers closing");
      await this.env.down();
    }
    if (this.container !== undefined) {
      this.logger.info("Test container closing");
      await this.container.stop();
    }
  };

  getWallet = async () => {
    this.logger.info("Setting up wallet");
    this.walletCtx = await api.buildWalletAndWaitForFunds(
      this.testConfig.dappConfig,
      this.testConfig.seed,
    );
    expect(this.walletCtx).not.toBeNull();

    const state = await Rx.firstValueFrom(this.walletCtx.wallet.state());
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    expect(balance).toBeGreaterThan(0n);

    // Register for dust generation
    await api.registerForDustGeneration(
      this.walletCtx.wallet,
      this.walletCtx.unshieldedKeystore,
    );

    return this.walletCtx;
  };
}
