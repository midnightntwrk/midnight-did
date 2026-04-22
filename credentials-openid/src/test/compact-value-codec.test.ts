import {
  type CompactType,
  CompactTypeBoolean,
  CompactTypeBytes,
  CompactTypeUnsignedInteger,
  type Value,
} from "@midnight-ntwrk/compact-runtime";
import { describe, expect, it } from "vitest";

import {
  COMPACT_VALUE_ENCODING,
  compactValueFromBytes,
  compactValueToBytes,
  decodeCompactPayload,
  decodeCompactValue,
  encodeCompactPayload,
  encodeCompactValue,
} from "../index.js";

type ExampleCredential = {
  readonly version: bigint;
  readonly claimRoot: Uint8Array;
  readonly active: boolean;
};

const uint16 = new CompactTypeUnsignedInteger(65_535n, 2);
const bytes32 = new CompactTypeBytes(32);

const exampleCredentialDescriptor: CompactType<ExampleCredential> = {
  alignment: () =>
    uint16
      .alignment()
      .concat(bytes32.alignment().concat(CompactTypeBoolean.alignment())),
  fromValue: (value: Value): ExampleCredential => ({
    version: uint16.fromValue(value),
    claimRoot: bytes32.fromValue(value),
    active: CompactTypeBoolean.fromValue(value),
  }),
  toValue: (value: ExampleCredential): Value =>
    uint16
      .toValue(value.version)
      .concat(
        bytes32
          .toValue(value.claimRoot)
          .concat(CompactTypeBoolean.toValue(value.active)),
      ),
};

const createBytes = (seed: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);

describe("Compact value transport codec", () => {
  it("frames and unframes runtime Value chunks without JSON conversion", () => {
    const runtimeValue = [createBytes(1), createBytes(2)];

    expect(compactValueFromBytes(compactValueToBytes(runtimeValue))).toEqual(
      runtimeValue,
    );
  });

  it("base64url-encodes framed runtime Value chunks", () => {
    const encoded = encodeCompactValue([createBytes(9)]);

    expect(encoded.encoding).toBe(COMPACT_VALUE_ENCODING);
    expect(decodeCompactValue(encoded)).toEqual([createBytes(9)]);
  });

  it("round-trips typed Compact values through a descriptor", () => {
    const credential = {
      version: 1n,
      claimRoot: createBytes(10),
      active: true,
    };

    const encoded = encodeCompactPayload(
      exampleCredentialDescriptor,
      credential,
    );

    expect(decodeCompactPayload(exampleCredentialDescriptor, encoded)).toEqual(
      credential,
    );
  });

  it("rejects malformed framed payloads", () => {
    const bytes = compactValueToBytes([createBytes(1)]);
    bytes[0] = 0;

    expect(() => compactValueFromBytes(bytes)).toThrow(/magic header/);
  });

  it("rejects invalid base64url transport payloads", () => {
    expect(() =>
      decodeCompactValue({
        encoding: COMPACT_VALUE_ENCODING,
        payload: "not+base64url",
      }),
    ).toThrow(/base64url/);
  });
});
