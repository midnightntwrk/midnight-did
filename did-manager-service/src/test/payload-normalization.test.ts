import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { normalizePayload } from "../signatures/payload-normalization.js";

describe("normalizePayload", () => {
  it("decodes hex bytes and normalizes them to canonical hex", () => {
    const normalized = normalizePayload("bytes", "48656C6C6F");

    expect(Buffer.from(normalized.bytes).toString("utf8")).toBe("Hello");
    expect(normalized.canonicalHex).toBe("48656c6c6f");
    expect(normalized.canonicalText).toBeNull();
  });

  it("accepts an empty bytes payload", () => {
    const normalized = normalizePayload("bytes", "");

    expect(normalized.bytes).toEqual(new Uint8Array());
    expect(normalized.canonicalHex).toBe("");
  });

  it("rejects invalid hex payloads", () => {
    expect(() => normalizePayload("bytes", "xyz")).toThrow(
      "Bytes payload must be a non-empty even-length hexadecimal string",
    );
    expect(() => normalizePayload("bytes", "abc")).toThrow(
      "Bytes payload must be a non-empty even-length hexadecimal string",
    );
  });

  it("encodes strings as exact UTF-8 bytes", () => {
    const normalized = normalizePayload("string", "Hello, Midnight!");

    expect(Buffer.from(normalized.bytes).toString("utf8")).toBe(
      "Hello, Midnight!",
    );
    expect(normalized.canonicalText).toBe("Hello, Midnight!");
  });

  it("canonicalizes equivalent JSON objects to identical bytes", () => {
    const left = normalizePayload("json", '{"b":2,"a":1}');
    const right = normalizePayload("json", '{"a":1,"b":2}');

    expect(left.canonicalText).toBe('{"a":1,"b":2}');
    expect(left.bytes).toEqual(right.bytes);
    expect(left.canonicalHex).toBe(right.canonicalHex);
  });

  it("canonicalizes nested JSON, arrays, and numeric formatting", () => {
    const normalized = normalizePayload(
      "json",
      '{"z":{"b":2,"a":1},"a":[3,2,1],"n":1.5,"m":1e30}',
    );

    expect(normalized.canonicalText).toBe(
      '{"a":[3,2,1],"m":1e+30,"n":1.5,"z":{"a":1,"b":2}}',
    );
  });

  it("preserves Unicode string data and escapes control characters canonically", () => {
    const normalized = normalizePayload(
      "json",
      '{"greeting":"สวัสดี","line":"a\\nb"}',
    );

    expect(normalized.canonicalText).toBe(
      '{"greeting":"สวัสดี","line":"a\\nb"}',
    );
  });

  it("rejects invalid JSON payloads", () => {
    expect(() => normalizePayload("json", "{oops")).toThrow(
      "JSON payload is invalid",
    );
  });
});
