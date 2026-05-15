import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MIDNIGHT_DID_CIRCUIT_NAMES,
  MIDNIGHT_DID_PROOF_CIRCUIT_IDS,
  MIDNIGHT_DID_PROOF_CIRCUIT_NAMES,
  MIDNIGHT_DID_PURE_CIRCUIT_NAMES,
  midnightDIDCircuitId,
} from "../did-circuits";

type ContractInfoCircuit = {
  name: string;
  pure: boolean;
  proof: boolean;
};

type ContractInfo = {
  circuits: ContractInfoCircuit[];
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const managedDidDir = join(
  currentDir,
  "..",
  "..",
  "..",
  "contract",
  "src",
  "managed",
  "did",
);
const contractInfoPath = join(managedDidDir, "compiler", "contract-info.json");
const keysDir = join(managedDidDir, "keys");

const sorted = (values: readonly string[]): string[] => [...values].sort();

const readContractInfo = (): ContractInfo =>
  JSON.parse(readFileSync(contractInfoPath, "utf8")) as ContractInfo;

const generatedCircuitNames = ({
  proof,
  pure,
}: {
  proof?: boolean;
  pure?: boolean;
}): string[] =>
  readContractInfo()
    .circuits.filter((circuit) => {
      if (proof != null && circuit.proof !== proof) return false;
      if (pure != null && circuit.pure !== pure) return false;
      return true;
    })
    .map((circuit) => circuit.name)
    .sort();

const generatedKeyNames = (extension: ".prover" | ".verifier"): string[] =>
  readdirSync(keysDir)
    .filter((fileName) => fileName.endsWith(extension))
    .map((fileName) => fileName.slice(0, -extension.length))
    .sort();

describe("Midnight DID circuit registry", () => {
  it("matches generated Compact contract metadata", () => {
    expect(sorted(MIDNIGHT_DID_CIRCUIT_NAMES)).toEqual(
      generatedCircuitNames({}),
    );
    expect(sorted(MIDNIGHT_DID_PURE_CIRCUIT_NAMES)).toEqual(
      generatedCircuitNames({ pure: true, proof: false }),
    );
    expect(sorted(MIDNIGHT_DID_PROOF_CIRCUIT_NAMES)).toEqual(
      generatedCircuitNames({ pure: false, proof: true }),
    );
  });

  it("matches generated prover and verifier key assets", () => {
    const proofCircuitNames = sorted(MIDNIGHT_DID_PROOF_CIRCUIT_NAMES);

    expect(generatedKeyNames(".prover")).toEqual(proofCircuitNames);
    expect(generatedKeyNames(".verifier")).toEqual(proofCircuitNames);
  });

  it("exposes stable typed prover-key identifiers", () => {
    expect(sorted(Object.keys(MIDNIGHT_DID_PROOF_CIRCUIT_IDS))).toEqual(
      sorted(MIDNIGHT_DID_PROOF_CIRCUIT_NAMES),
    );
    expect(MIDNIGHT_DID_PROOF_CIRCUIT_IDS.addVerificationMethod).toBe(
      "addVerificationMethod",
    );
    expect(midnightDIDCircuitId("deactivate")).toBe("deactivate");
  });
});
