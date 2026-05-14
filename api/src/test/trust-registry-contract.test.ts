import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  applyTrustRoleTransition,
  assertTrustRoleActive,
  evaluateTrustRole,
  getTrustRoleHistory,
  loadTrustRegistryFromFile,
  trustRegistryFixturePath,
  type TrustRegistryState,
  type TrustRole,
  TrustRoleTransitionError,
} from "../trust-registry";

const TRUST_REGISTRY = loadTrustRegistryFromFile(
  trustRegistryFixturePath("trust-registry-baseline.json"),
);

describe("trust-registry contract scaffold", () => {
  it("supports issuer transition from grant to expiry-based inactivity", () => {
    const oneOffIssue: TrustRegistryState = applyTrustRoleTransition(
      TRUST_REGISTRY,
      {
        role: "issuer",
        partyDid: "did:midnight:issuer:university-beta",
        actorDid: "did:midnight:gov:registry-admin",
        action: "grant",
        effectiveAt: "2026-06-01T00:00:00.000Z",
        expiresAt: "2026-06-05T00:00:00.000Z",
        reason: "temporary accreditation for pilot cohort",
      },
    );

    const beforeExpiry = evaluateTrustRole(
      oneOffIssue,
      {
        role: "issuer" as TrustRole,
        partyDid: "did:midnight:issuer:university-beta",
      },
      "2026-06-03T00:00:00.000Z",
    );
    expect(beforeExpiry.isActive).toBe(true);
    expect(beforeExpiry.activeFrom).toBe("2026-06-01T00:00:00.000Z");
    expect(beforeExpiry.activeUntil).toBe("2026-06-05T00:00:00.000Z");

    const atExpiry = evaluateTrustRole(
      oneOffIssue,
      {
        role: "issuer" as TrustRole,
        partyDid: "did:midnight:issuer:university-beta",
      },
      "2026-06-05T00:00:00.000Z",
    );
    expect(atExpiry.isActive).toBe(false);
    expect(atExpiry.reason).toContain("grant expired");

    const afterExpiry = evaluateTrustRole(
      oneOffIssue,
      {
        role: "issuer" as TrustRole,
        partyDid: "did:midnight:issuer:university-beta",
      },
      "2026-06-07T00:00:00.000Z",
    );
    expect(afterExpiry.isActive).toBe(false);
    expect(afterExpiry.reason).toContain("grant expired");
  });

  it("supports verifier grant + revoke transition and exposes ordered history", () => {
    const grantVerifier: TrustRegistryState = applyTrustRoleTransition(
      TRUST_REGISTRY,
      {
        role: "verifier",
        partyDid: "did:midnight:verifier:acme-hiring-2",
        actorDid: "did:midnight:gov:registry-admin",
        action: "grant",
        effectiveAt: "2026-06-01T00:00:00.000Z",
        expiresAt: "2026-12-31T00:00:00.000Z",
      },
    );

    const activeBeforeRevoke = evaluateTrustRole(
      grantVerifier,
      {
        role: "verifier",
        partyDid: "did:midnight:verifier:acme-hiring-2",
      },
      "2026-06-02T00:00:00.000Z",
    );
    expect(activeBeforeRevoke.isActive).toBe(true);

    const revoked = applyTrustRoleTransition(grantVerifier, {
      role: "verifier",
      partyDid: "did:midnight:verifier:acme-hiring-2",
      actorDid: "did:midnight:gov:registry-admin",
      action: "revoke",
      effectiveAt: "2026-07-01T00:00:00.000Z",
      reason: "credential policy changed",
    });

    const afterRevoke = evaluateTrustRole(
      revoked,
      {
        role: "verifier",
        partyDid: "did:midnight:verifier:acme-hiring-2",
      },
      "2026-07-02T00:00:00.000Z",
    );
    expect(afterRevoke.isActive).toBe(false);
    expect(afterRevoke.reason).toContain("role revoked");

    const history = getTrustRoleHistory(revoked, {
      role: "verifier",
      partyDid: "did:midnight:verifier:acme-hiring-2",
    });
    expect(history).toHaveLength(2);
    expect(history[0].action).toBe("grant");
    expect(history[1].action).toBe("revoke");
  });

  it("assertTrustRoleActive fails fast on inactive roles with reasons", () => {
    expect(() =>
      assertTrustRoleActive(
        TRUST_REGISTRY,
        {
          role: "verifier",
          partyDid: "did:midnight:verifier:unlisted-party",
        },
        "2026-06-01T00:00:00.000Z",
      ),
    ).toThrowError(TrustRoleTransitionError);
  });

  it("normalizes loaded fixture updatedAt to the newest event timestamp", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trust-registry-"));
    const fixturePath = path.join(dir, "trust-registry.json");
    try {
      writeFileSync(
        fixturePath,
        JSON.stringify({
          registryId: "trust-registry:test",
          updatedAt: "2026-01-01T00:00:00.000Z",
          events: [
            {
              role: "issuer",
              partyDid: "did:midnight:issuer:university-beta",
              actorDid: "did:midnight:gov:registry-admin",
              action: "grant",
              effectiveAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        }),
      );

      expect(loadTrustRegistryFromFile(fixturePath).updatedAt).toBe(
        "2026-06-01T00:00:00.000Z",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
