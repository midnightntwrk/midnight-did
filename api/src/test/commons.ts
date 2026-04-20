import { spawnSync } from "node:child_process";

import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
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
const PROOF_SERVER_IMAGE =
  process.env.PROOF_SERVER_IMAGE ?? "midnightntwrk/proof-server:8.0.3";

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
  private container: StartedTestContainer | undefined;
  private walletCtx: api.MidnightDIDWalletContext | undefined;
  private testConfig: TestConfiguration;
  private composeFile = "standalone.yml";
  private composeProjectName = "";

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
      this.composeFile = process.env.COMPOSE_FILE ?? "standalone.yml";
      this.composeProjectName = `did-api-test-${Date.now()}`;
      this.logger.info(`Using compose file: ${this.composeFile}`);
      const dockerEnv = new DockerComposeEnvironment(
        currentDir,
        this.composeFile,
      )
        .withProjectName(this.composeProjectName)
        .withEnvironment({ MIDNIGHT_STACK_NAME: this.composeProjectName })
        .withWaitStrategy(
          "proof-server",
          Wait.forHttp("/version", 6300).withStartupTimeout(180000),
        )
        .withWaitStrategy(
          "indexer",
          Wait.forHealthCheck().withStartupTimeout(180000),
        );
      this.env = await dockerEnv.up();

      this.testConfig.dappConfig = {
        ...this.testConfig.dappConfig,
        indexer: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.indexer,
          "indexer",
        ),
        indexerWS: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.indexerWS,
          "indexer",
        ),
        node: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.node,
          "node",
        ),
        proofServer: TestEnvironment.mapContainerPort(
          this.env,
          this.testConfig.dappConfig.proofServer,
          "proof-server",
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
    await new GenericContainer(PROOF_SERVER_IMAGE)
      .withExposedPorts(6300)
      .withCommand([`midnight-proof-server --network ${env}`])
      .withEnvironment({ RUST_BACKTRACE: "full" })
      .withWaitStrategy(
        Wait.forHttp("/version", 6300).withStartupTimeout(180000),
      )
      .start();

  shutdown = async () => {
    try {
      if (this.walletCtx !== undefined) {
        await this.walletCtx.wallet.stop();
      }
      if (this.env !== undefined) {
        this.logger.info("Test containers closing");
        await this.env.down({ removeVolumes: true, timeout: 30 });
      }
      if (this.container !== undefined) {
        this.logger.info("Test container closing");
        await this.container.stop();
      }
    } finally {
      if (this.composeProjectName !== "") {
        const result = spawnSync(
          "docker",
          [
            "compose",
            "-p",
            this.composeProjectName,
            "-f",
            this.composeFile,
            "down",
            "--volumes",
            "--remove-orphans",
          ],
          {
            cwd: currentDir,
            encoding: "utf8",
            timeout: 30_000,
            killSignal: "SIGKILL",
          },
        );
        if (result.status !== 0) {
          this.logger.warn(
            {
              projectName: this.composeProjectName,
              composeFile: this.composeFile,
              status: result.status,
              error: result.error?.message,
              stderr: result.stderr,
              stdout: result.stdout,
            },
            "Best-effort docker compose cleanup failed",
          );
        }
      }
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
