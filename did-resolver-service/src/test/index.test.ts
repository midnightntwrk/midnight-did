import { beforeEach, describe, expect, it, vi } from "vitest";

const listenMock = vi.fn();
const createAppMock = vi.fn();
const loadConfigMock = vi.fn();
const resolverCtorMock = vi.fn();

vi.mock("../app", () => ({
  createApp: (...args: unknown[]) => createAppMock(...args),
}));

vi.mock("../config", () => ({
  loadConfig: () => loadConfigMock(),
}));

vi.mock("../service", () => ({
  ResolverService: class {
    constructor(options: unknown) {
      resolverCtorMock(options);
    }
  },
}));

import { start } from "../index";

describe("did-resolver-service startup", () => {
  beforeEach(() => {
    listenMock.mockReset();
    createAppMock.mockReset();
    loadConfigMock.mockReset();
    resolverCtorMock.mockReset();
  });

  it("builds resolver service and listens with config values", async () => {
    loadConfigMock.mockReturnValue({
      host: "0.0.0.0",
      port: 13001,
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      expectedNetwork: "preprod",
      debug: true,
    });
    createAppMock.mockResolvedValue({ listen: listenMock });
    listenMock.mockResolvedValue(undefined);

    await start();

    expect(resolverCtorMock).toHaveBeenCalledWith({
      indexerHttpUrl: "http://indexer.example/api/v3/graphql",
      indexerWsUrl: "ws://indexer.example/api/v3/graphql/ws",
      expectedNetwork: "preprod",
      debug: true,
      logger: expect.objectContaining({
        error: expect.any(Function),
      }),
    });
    expect(listenMock).toHaveBeenCalledWith({
      host: "0.0.0.0",
      port: 13001,
    });
  });
});
