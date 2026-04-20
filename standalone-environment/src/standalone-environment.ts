import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DockerComposeEnvironment,
  type StartedDockerComposeEnvironment,
  Wait,
} from "testcontainers";
import * as Rx from "rxjs";

import { StandaloneConfig } from "../../api/src/config.js";
import type {
  MidnightDIDProviders,
  MidnightDIDWalletContext,
} from "../../api/src/index.js";
import { getMidnightNetwork } from "../../api/src/index.js";
import { mapContainerPort } from "./docker-utils.js";
import { silenceLogs, setupWallet } from "./wallet-setup.js";
import { integrationPath } from "./standalone-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../");
const DEFAULT_COMPOSE_DIR = path.resolve(REPO_ROOT, "api");
const DEFAULT_COMPOSE_FILE = "standalone.yml";

export class StandaloneEnvironment {
  private env: StartedDockerComposeEnvironment | undefined;
  private walletCtx: MidnightDIDWalletContext | undefined;
  private _providers: MidnightDIDProviders | undefined;
  private readonly projectName: string;
  private readonly category: string;
  private readonly fsRoots: string[];

  constructor(category = "standalone") {
    this.category = category;
    this.projectName = `${category}-${Date.now()}`;
    this.fsRoots = [
      integrationPath(REPO_ROOT, category, "wallet"),
      integrationPath(REPO_ROOT, category, "issuer"),
      integrationPath(REPO_ROOT, category, "holder"),
      integrationPath(REPO_ROOT, category, "verifier"),
    ];
  }

  get providers(): MidnightDIDProviders {
    if (!this._providers) {
      throw new Error("StandaloneEnvironment.start() must be called first");
    }
    return this._providers;
  }

  get network(): string {
    return getMidnightNetwork().toString().toLowerCase();
  }

  async start(
    composePath = DEFAULT_COMPOSE_DIR,
    composeFile = DEFAULT_COMPOSE_FILE,
  ): Promise<MidnightDIDProviders> {
    silenceLogs();

    await Promise.all(
      this.fsRoots.map((root) =>
        fs.rm(root, { recursive: true, force: true }),
      ),
    );

    const baseConfig = new StandaloneConfig();
    const dockerEnv = new DockerComposeEnvironment(composePath, composeFile)
      .withProjectName(this.projectName)
      .withEnvironment({ MIDNIGHT_STACK_NAME: this.projectName })
      .withWaitStrategy(
        "proof-server",
        Wait.forHttp("/version", 6300).withStartupTimeout(180_000),
      )
      .withWaitStrategy(
        "indexer",
        Wait.forHealthCheck().withStartupTimeout(180_000),
      );

    this.env = await dockerEnv.up();

    const config = Object.assign(baseConfig, {
      indexer: mapContainerPort(this.env, baseConfig.indexer, "indexer"),
      indexerWS: mapContainerPort(
        this.env,
        baseConfig.indexerWS,
        "indexer",
      ),
      node: mapContainerPort(this.env, baseConfig.node, "node"),
      proofServer: mapContainerPort(
        this.env,
        baseConfig.proofServer,
        "proof-server",
      ),
      logDir: path.resolve(
        integrationPath(REPO_ROOT, this.category, "wallet"),
        "logs",
      ),
      midnightDbName: path.resolve(
        integrationPath(REPO_ROOT, this.category, "wallet"),
        "wallet-db",
      ),
    });

    console.info(`[${this.category}] compose is up`);
    const { walletCtx, providers } = await setupWallet(
      config as never,
      this.category,
    );
    this.walletCtx = walletCtx;
    this._providers = providers;
    return providers;
  }

  async waitForWalletSync(): Promise<void> {
    if (this.walletCtx === undefined) return;
    await Rx.firstValueFrom(
      this.walletCtx.wallet
        .state()
        .pipe(Rx.filter((state) => state.isSynced)),
    );
  }

  async shutdown(): Promise<void> {
    try {
      if (this.walletCtx !== undefined) {
        await this.walletCtx.wallet.stop();
      }
      if (this.env !== undefined) {
        await this.env.down({ removeVolumes: true, timeout: 30 });
      }
    } finally {
      await Promise.all(
        this.fsRoots.map((root) =>
          fs.rm(root, { recursive: true, force: true }),
        ),
      );
    }
  }
}
