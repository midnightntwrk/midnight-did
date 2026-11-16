// SPDX-License-Identifier: Apache-2.0
import { MidnightNetwork } from "@midnight-ntwrk/midnight-did/midnight";
import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodRelationType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ledger-state.js", () => ({
  getMidnightDIDLedgerState: vi.fn(),
  requireDeployedMidnightDIDLedgerState: vi.fn(),
}));
vi.mock("../controller-authorization.js", () => ({
  asSchnorrJubjubDigest: (value: unknown) => value,
  createControllerAuthorization: vi.fn(async () => [
    { announcement: { x: 1n, y: 2n }, response: 3n },
    1n,
  ]),
}));

import { MainnetConfig, TestnetRemoteConfig } from "../config.js";
import { registerContractProviders } from "../contract-provider-registry.js";
import { getDidSubject, getMidnightNetwork } from "../did-subject.js";
import { ledgerIdentifier } from "../ledger-identifier-keys.js";
import {
  schnorrJubjubVerificationMethodToLedger,
  serviceToLedger,
  verificationMethodToLedger,
} from "../ledger-mappers.js";
import {
  getMidnightDIDLedgerState,
  requireDeployedMidnightDIDLedgerState,
} from "../ledger-state.js";
import {
  resolve,
  resolveDIDResolutionResult,
  resolveRepresentation,
} from "../resolution.js";
import {
  addService,
  removeService,
  updateService,
} from "../service-operations.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "../types.js";
import {
  addSchnorrJubjubVerificationMethod,
  addVerificationMethod,
  addVerificationMethodRelation,
  removeSchnorrJubjubVerificationMethod,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  updateSchnorrJubjubVerificationMethod,
  updateVerificationMethod,
  verifySchnorrJubjubDigestSignature,
} from "../verification-method-operations.js";

const address = "a".repeat(64);
const subject = `did:midnight:testnet:${address}`;
const providers = { config: { networkId: "testnet" } } as MidnightDIDProviders;
const callTx = Object.fromEntries(
  [
    "setService",
    "removeService",
    "setVerificationMethod",
    "removeVerificationMethod",
    "setSchnorrJubjubVerificationMethod",
    "removeSchnorrJubjubVerificationMethod",
    "setVerificationMethodRelation",
    "verifySchnorrJubjubDigestSignature",
  ].map((name) => [
    name,
    vi.fn(async (..._args: unknown[]) => ({ public: { txId: name } })),
  ]),
);
const contract = {
  deployTxData: { public: { contractAddress: address } },
  callTx,
} as unknown as DeployedMidnightDIDContract;
const map = (entries: [string, any][] = []) =>
  Object.assign(new Map(entries), {
    member: (id: string) => entries.some(([key]) => key === id),
    isEmpty: () => entries.length === 0,
    lookup: (id: string) => entries.find(([key]) => key === id)?.[1],
  });
const set = (ids: string[] = []) =>
  Object.assign(new Set(ids), {
    member: (id: string) => ids.includes(id),
    isEmpty: () => ids.length === 0,
  });
const jwk = {
  kty: KeyType.OKP,
  crv: CurveType.Ed25519,
  x: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
};
const opaque = (id = "#key") =>
  createVerificationMethod({
    id,
    controller: subject,
    type: VerificationMethodType.JsonWebKey,
    publicKeyJwk: jwk,
  });
const jubjub = (id = "#key") => ({ id, publicKey: { x: 1n, y: 2n } });
const service = (id = "#service") => ({
  id,
  type: "LinkedDomains",
  serviceEndpoint: "https://example.com",
});
const state = (id?: string, kind = "opaque", related = false): any => ({
  id: { bytes: new Uint8Array(32).fill(0xaa) },
  version: 1n,
  active: true,
  created: 1n,
  updated: 2n,
  operationCount: 1n,
  alsoKnownAs: set(),
  verificationMethods: map(
    id && kind === "opaque"
      ? [[id, { typ: 1, publicKeyJwk: { kty: 3, crv: 0, x: jwk.x, y: "" } }]]
      : [],
  ),
  schnorrJubjubVerificationMethods: map(
    id && kind === "schnorrJubjub" ? [[id, jubjub().publicKey]] : [],
  ),
  services: map(
    id && kind === "service"
      ? [
          [
            id,
            {
              id,
              typ: "LinkedDomains",
              serviceEndpoint: JSON.stringify("https://example.com"),
            },
          ],
        ]
      : [],
  ),
  authenticationRelation: set(related && id ? [id] : []),
  assertionMethodRelation: set(),
  keyAgreementRelation: set(),
  capabilityInvocationRelation: set(),
  capabilityDelegationRelation: set(),
});

beforeEach(() => {
  vi.clearAllMocks();
  new TestnetRemoteConfig();
  registerContractProviders(contract, providers);
  new MainnetConfig();
  vi.mocked(getMidnightDIDLedgerState).mockResolvedValue(state());
  vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(state());
});

describe("captured provider network after construction-default changes", () => {
  it("keeps real pure helpers following the default but maps explicit subjects on testnet", () => {
    expect(getMidnightNetwork()).toBe(MidnightNetwork.Mainnet);
    expect(getDidSubject(contract)).toBe(`did:midnight:mainnet:${address}`);
    expect(getDidSubject(contract, MidnightNetwork.Testnet)).toBe(subject);
    expect(
      verificationMethodToLedger(
        contract,
        opaque(`${subject}#key`),
        MidnightNetwork.Testnet,
      ).id,
    ).toBe(`${subject}#key`);
    expect(
      schnorrJubjubVerificationMethodToLedger(
        contract,
        jubjub(),
        MidnightNetwork.Testnet,
      ).id,
    ).toBe(`${subject}#key`);
    expect(
      serviceToLedger(contract, service(), MidnightNetwork.Testnet).id,
    ).toBe(`${subject}#service`);
    expect(
      serviceToLedger(
        contract,
        service("https://example.com/s#one"),
        MidnightNetwork.Testnet,
      ).id,
    ).toBe("https://example.com/s#one");
    expect(
      ledgerIdentifier(contract, `${subject}#key`, MidnightNetwork.Testnet),
    ).toEqual({ canonical: `${subject}#key`, legacy: "#key" });
    expect(
      ledgerIdentifier(
        contract,
        `${subject}/path#key`,
        MidnightNetwork.Testnet,
      ),
    ).toEqual({ canonical: `${subject}/path#key` });
    expect(
      ledgerIdentifier(contract, `${subject}?q=1#key`, MidnightNetwork.Testnet),
    ).toEqual({ canonical: `${subject}?q=1#key` });
    new TestnetRemoteConfig();
    expect(getDidSubject(contract)).toBe(subject);
    new TestnetRemoteConfig();
    expect(getMidnightNetwork()).toBe(MidnightNetwork.Testnet);
  });

  it("uses real resolver projection on all three wrappers, including existing absolute methods", async () => {
    for (const ledger of [state(), state(`${subject}#key`)]) {
      vi.mocked(getMidnightDIDLedgerState).mockResolvedValue(ledger);
      expect((await resolve(providers, contract))?.didDocument.id).toBe(
        subject,
      );
      const envelope = await resolveDIDResolutionResult(providers, contract);
      expect(envelope.didDocument?.id).toBe(subject);
      if (!ledger.verificationMethods.isEmpty()) {
        expect(envelope.didDocument?.verificationMethod?.[0]).toMatchObject({
          id: `${subject}#key`,
          controller: subject,
        });
      }
      const representation = await resolveRepresentation(providers, contract, {
        accept: "application/did+json",
      });
      expect(
        JSON.parse(new TextDecoder().decode(representation.didDocumentStream!))
          .id,
      ).toBe(subject);
    }
  });

  it.each([resolve, resolveDIDResolutionResult, resolveRepresentation])(
    "captures provider network once before a deferred resolution read",
    async (wrapper) => {
      new TestnetRemoteConfig();
      const networkId = vi.fn(() => "testnet");
      const captured = {
        config: {
          get networkId() {
            return networkId();
          },
        },
      } as MidnightDIDProviders;
      let release!: (value: any) => void;
      vi.mocked(getMidnightDIDLedgerState).mockImplementationOnce(
        () =>
          new Promise((r) => {
            release = r;
          }),
      );
      const pending = wrapper(captured, contract);
      new MainnetConfig();
      release(state());
      const result: any = await pending;
      const document =
        result.didDocument ??
        JSON.parse(new TextDecoder().decode(result.didDocumentStream));
      expect(document.id).toBe(subject);
      expect(networkId).toHaveBeenCalledOnce();
    },
  );

  it("retains null/notFound for missing ledger state", async () => {
    vi.mocked(getMidnightDIDLedgerState).mockResolvedValue(null);
    expect(await resolve(providers, contract)).toBeNull();
    expect(
      (await resolveDIDResolutionResult(providers, contract))
        .didResolutionMetadata.error,
    ).toBe("notFound");
    expect(
      (await resolveRepresentation(providers, contract)).didResolutionMetadata
        .error,
    ).toBe("notFound");
  });

  it("adds relative JWK, Jubjub and service ids on the captured network", async () => {
    await addVerificationMethod(contract, providers, opaque());
    await addSchnorrJubjubVerificationMethod(contract, providers, jubjub());
    await addService(contract, providers, service());
    expect(callTx.setVerificationMethod.mock.calls[0][0]).toMatchObject({
      id: `${subject}#key`,
    });
    expect(
      callTx.setSchnorrJubjubVerificationMethod.mock.calls[0][0],
    ).toMatchObject({ id: `${subject}#key` });
    expect(callTx.setService.mock.calls[0][0]).toMatchObject({
      id: `${subject}#service`,
    });
  });

  it.each(["canonical", "legacy"])(
    "mutates %s physical keys and relations on the captured network",
    async (kind) => {
      const key = kind === "legacy" ? "#key" : `${subject}#key`;
      const sid = kind === "legacy" ? "#service" : `${subject}#service`;
      vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(
        state(sid, "service"),
      );
      await updateService(contract, providers, service());
      await removeService(contract, providers, `${subject}#service`);
      expect(callTx.setService.mock.calls[0][0]).toMatchObject({ id: sid });
      expect(callTx.removeService.mock.calls[0][0]).toBe(sid);
      for (const k of ["opaque", "schnorrJubjub"]) {
        vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(
          state(key, k),
        );
        if (k === "opaque") {
          await updateVerificationMethod(contract, providers, opaque());
          await removeVerificationMethod(contract, providers, `${subject}#key`);
          expect(callTx.setVerificationMethod.mock.calls[0][0]).toMatchObject({
            id: key,
          });
          expect(callTx.removeVerificationMethod.mock.calls[0][0]).toBe(key);
        } else {
          await updateSchnorrJubjubVerificationMethod(
            contract,
            providers,
            jubjub(),
          );
          await removeSchnorrJubjubVerificationMethod(
            contract,
            providers,
            `${subject}#key`,
          );
          expect(
            callTx.setSchnorrJubjubVerificationMethod.mock.calls[0][0],
          ).toMatchObject({ id: key });
          expect(
            callTx.removeSchnorrJubjubVerificationMethod.mock.calls[0][0],
          ).toBe(key);
        }
        await addVerificationMethodRelation(
          contract,
          providers,
          VerificationMethodRelationType.Authentication,
          `${subject}#key`,
        );
        vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(
          state(key, k, true),
        );
        await removeVerificationMethodRelation(
          contract,
          providers,
          VerificationMethodRelationType.Authentication,
          `${subject}#key`,
        );
        expect(
          callTx.setVerificationMethodRelation.mock.calls.at(-1)?.[1],
        ).toBe(key);
      }
    },
  );

  it.each(["canonical", "legacy"])(
    "uses explicit and registered providers for %s signature lookups",
    async (kind) => {
      const key = kind === "legacy" ? "#key" : `${subject}#key`;
      vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(
        state(key, "schnorrJubjub"),
      );
      const digest = [1n, 2n, 3n, 4n] as [bigint, bigint, bigint, bigint];
      const signature = { announcement: { x: 1n, y: 2n }, response: 3n };
      await verifySchnorrJubjubDigestSignature(
        contract,
        providers,
        `${subject}#key`,
        digest,
        signature,
      );
      await verifySchnorrJubjubDigestSignature(
        contract,
        `${subject}#key`,
        digest,
        signature,
      );
      expect(callTx.verifySchnorrJubjubDigestSignature).toHaveBeenNthCalledWith(
        1,
        key,
        digest,
        signature,
      );
      expect(callTx.verifySchnorrJubjubDigestSignature).toHaveBeenNthCalledWith(
        2,
        key,
        digest,
        signature,
      );
    },
  );

  it("does not mix subjects when the default changes during a ledger await", async () => {
    new TestnetRemoteConfig();
    let release!: (value: any) => void;
    vi.mocked(requireDeployedMidnightDIDLedgerState).mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    const pending = updateService(contract, providers, service());
    new MainnetConfig();
    release(state("#service", "service"));
    await pending;
    expect(callTx.setService.mock.calls[0][0]).toMatchObject({
      id: "#service",
    });
  });

  it("rejects ambiguous aliases and foreign identities without a transaction", async () => {
    const ledger = state("#key", "schnorrJubjub");
    ledger.schnorrJubjubVerificationMethods = map([
      ["#key", jubjub().publicKey],
      [`${subject}#key`, jubjub().publicKey],
    ]);
    vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(ledger);
    await expect(
      removeSchnorrJubjubVerificationMethod(contract, providers, "#key"),
    ).rejects.toThrow(/Ambiguous/);
    await expect(
      removeVerificationMethod(
        contract,
        providers,
        `did:midnight:mainnet:${address}#key`,
      ),
    ).rejects.toThrow(/must match/);
    expect(callTx.removeVerificationMethod).not.toHaveBeenCalled();
    expect(callTx.removeSchnorrJubjubVerificationMethod).not.toHaveBeenCalled();
  });

  it("rejects missing provider config rather than using the construction default", async () => {
    await expect(resolve({} as MidnightDIDProviders, contract)).rejects.toThrow(
      /network/i,
    );
    expect(getMidnightDIDLedgerState).not.toHaveBeenCalled();
  });

  it.each(["unknown", undefined, "toString", null, 7])(
    "fails closed on invalid initialized network %s",
    async (networkId) => {
      const invalid = { config: { networkId } } as MidnightDIDProviders;
      await expect(resolve(invalid, contract)).rejects.toThrow(/network/i);
      await expect(
        resolveDIDResolutionResult(invalid, contract),
      ).rejects.toThrow(/network/i);
      await expect(resolveRepresentation(invalid, contract)).rejects.toThrow(
        /network/i,
      );
      await expect(addService(contract, invalid, service())).rejects.toThrow(
        /network/i,
      );
      registerContractProviders(contract, invalid);
      await expect(
        verifySchnorrJubjubDigestSignature(contract, "#key", [1n, 2n, 3n, 4n], {
          announcement: { x: 1n, y: 2n },
          response: 3n,
        }),
      ).rejects.toThrow(/network/i);
      expect(getMidnightDIDLedgerState).not.toHaveBeenCalled();
      expect(callTx.setService).not.toHaveBeenCalled();
    },
  );
});
