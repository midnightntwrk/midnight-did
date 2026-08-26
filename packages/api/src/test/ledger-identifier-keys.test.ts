import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, describe, expect, it } from "vitest";

import { getDidSubject } from "../did-subject.js";
import {
  findExistingServiceLedgerId,
  findExistingVerificationMethodLedgerIdentifier,
  ledgerIdentifier,
  requireExistingVerificationMethodLedgerId,
} from "../ledger-identifier-keys.js";
import { type DeployedMidnightDIDContract } from "../types.js";

let previousNetworkId: string | undefined;
try {
  previousNetworkId = getNetworkId();
} catch {
  previousNetworkId = undefined;
}
setNetworkId("undeployed");
afterAll(() => {
  if (previousNetworkId !== undefined) setNetworkId(previousNetworkId);
});

const didContract = {
  deployTxData: {
    public: {
      contractAddress:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
} as DeployedMidnightDIDContract;

const ledgerMap = (ids: readonly string[]) => ({
  member: (id: string) => ids.includes(id),
});

const ledgerState = ({
  verificationMethods = [],
  schnorrJubjubVerificationMethods = [],
  services = [],
}: {
  verificationMethods?: readonly string[];
  schnorrJubjubVerificationMethods?: readonly string[];
  services?: readonly string[];
}) =>
  ({
    verificationMethods: ledgerMap(verificationMethods),
    schnorrJubjubVerificationMethods: ledgerMap(
      schnorrJubjubVerificationMethods,
    ),
    services: ledgerMap(services),
  }) as any;

describe("ledger identifier compatibility", () => {
  const did = getDidSubject(didContract);

  it("derives a legacy key only for an exact current-subject fragment identity", () => {
    expect(ledgerIdentifier(didContract, `${did}#key-1`)).toEqual({
      canonical: `${did}#key-1`,
      legacy: "#key-1",
    });
    expect(ledgerIdentifier(didContract, `${did}/keys#key-1`)).toEqual({
      canonical: `${did}/keys#key-1`,
    });
    expect(ledgerIdentifier(didContract, `${did}?key=1#key-1`)).toEqual({
      canonical: `${did}?key=1#key-1`,
    });
    expect(
      ledgerIdentifier(didContract, "https://example.com/service#one"),
    ).toEqual({ canonical: "https://example.com/service#one" });
  });

  it("selects the sole canonical or legacy service key", () => {
    const identifier = ledgerIdentifier(didContract, `${did}#service-1`);
    expect(
      findExistingServiceLedgerId(
        ledgerState({ services: [`${did}#service-1`] }),
        identifier,
      ),
    ).toBe(`${did}#service-1`);
    expect(
      findExistingServiceLedgerId(
        ledgerState({ services: ["#service-1"] }),
        identifier,
      ),
    ).toBe("#service-1");
  });

  it("fails closed when canonical and legacy service keys coexist", () => {
    const identifier = ledgerIdentifier(didContract, `${did}#service-1`);
    expect(() =>
      findExistingServiceLedgerId(
        ledgerState({ services: [`${did}#service-1`, "#service-1"] }),
        identifier,
      ),
    ).toThrow(/Ambiguous service identifier/);
  });

  it("selects legacy verification methods across the shared map namespace", () => {
    const identifier = ledgerIdentifier(didContract, `${did}#key-1`);
    expect(
      findExistingVerificationMethodLedgerIdentifier(
        ledgerState({ verificationMethods: ["#key-1"] }),
        identifier,
      ),
    ).toEqual({ id: "#key-1", kind: "opaque" });
    expect(
      requireExistingVerificationMethodLedgerId(
        ledgerState({ schnorrJubjubVerificationMethods: ["#key-1"] }),
        identifier,
        "schnorrJubjub",
      ),
    ).toBe("#key-1");
  });

  it("fails closed for duplicate aliases and map-kind mismatches", () => {
    const identifier = ledgerIdentifier(didContract, `${did}#key-1`);
    expect(() =>
      findExistingVerificationMethodLedgerIdentifier(
        ledgerState({
          verificationMethods: ["#key-1"],
          schnorrJubjubVerificationMethods: [`${did}#key-1`],
        }),
        identifier,
      ),
    ).toThrow(/Ambiguous verification method identifier/);
    expect(() =>
      requireExistingVerificationMethodLedgerId(
        ledgerState({ schnorrJubjubVerificationMethods: ["#key-1"] }),
        identifier,
        "opaque",
      ),
    ).toThrow(/stored as schnorrJubjub/);
  });
});
