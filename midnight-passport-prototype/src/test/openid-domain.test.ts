import {
  createSanctionScreeningFixture,
  encodeSanctionScreeningPresentation,
  encodeSanctionScreeningProof,
} from "@midnight-ntwrk/midnight-did-credentials-compliance";
import {
  assertPresentationSubmissionMatchesDefinition,
  createCredentialRequest,
  createCredentialResponse,
  createMidnightCompactDescriptor,
  createPreAuthorizedCredentialOffer,
  createPreAuthorizedTokenRequest,
  createPresentationDefinition,
  createVpAuthorizationRequest,
  createVpAuthorizationResponse,
} from "@midnight-ntwrk/midnight-did-credentials-openid";
import {
  createSecretPassportCredentialFixture,
  encodeSecretPassportCredential,
  encodeSecretPassportPresentation,
  encodeSecretPassportProof,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";
import { describe, expect, it } from "vitest";

import { runHappyPathPrototype } from "../flow.js";

describe("Midnight Passport OpenID-shaped domain envelopes", () => {
  it("wraps issuance and presentation around existing Midnight credential payloads", () => {
    const passportFixture = createSecretPassportCredentialFixture();
    const complianceFixture = createSanctionScreeningFixture();
    const offer = createPreAuthorizedCredentialOffer({
      credentialIssuer: "https://national-id-issuer.example",
      credentialConfigurationIds: ["passport_proxy_v1"],
      preAuthorizedCode: "alice-preauth-code",
    });
    const tokenRequest = createPreAuthorizedTokenRequest({ offer });
    const credentialRequest = createCredentialRequest({
      credential_configuration_id: "passport_proxy_v1",
      format: "midnight_compact_vc",
      midnight: {
        holderBinding: {
          method: "blinded_secret_commitment",
          challenge: "0xa11ce001",
          blindedCommitment: "0xb11nded001",
          verifierDomain: "national-id-issuer.example",
        },
        requestedClaims: ["ageOver18", "notExpired"],
      },
    });
    const issuedHolderBinding = credentialRequest.midnight?.holderBinding;
    if (!issuedHolderBinding) {
      throw new Error("Expected Midnight holder binding in credential request");
    }
    const credentialResponse = createCredentialResponse({
      credential: {
        format: "midnight_compact_vc",
        credentialFamily: "passport-secret",
        schemaId: "passport-proxy:v1",
        schemaVersion: "1.0",
        credential: encodeSecretPassportCredential(passportFixture.credential),
        credentialProof: encodeSecretPassportProof(
          passportFixture.credentialProof,
        ),
        holderBinding: issuedHolderBinding,
      },
    });

    const result = runHappyPathPrototype();
    const definition = createPresentationDefinition({
      id: "private-growth-note-requirements",
      input_descriptors: [
        {
          id: "passport-age-over-18",
          constraints: { fields: [{ path: ["$.body.ageThresholdYears"] }] },
        },
        {
          id: "compliance-pass",
          constraints: { fields: [{ path: ["$.body.screeningResult"] }] },
        },
      ],
    });
    const authorizationRequest = createVpAuthorizationRequest({
      response_type: "vp_token",
      client_id: "did:midnight:verifier:private-growth-note",
      response_mode: "direct_post",
      nonce: "private-growth-note-nonce",
      state: result.product.id,
      presentation_definition: definition,
      midnight: {
        verifierDomain: "private-growth-note.example",
        challenge: "0xcafe01",
        acceptedCredentialFamilies: ["passport-secret", "compliance"],
        requireSameHolder: true,
        predicateHints: [
          "midnight:predicate:age-over",
          "midnight:predicate:screening-pass",
        ],
      },
    });
    const submission = {
      id: "alice-submission-1",
      definition_id: authorizationRequest.presentation_definition.id,
      descriptor_map: [
        createMidnightCompactDescriptor({
          id: "passport-age-over-18",
          path: "$.vp_token[0]",
        }),
        createMidnightCompactDescriptor({
          id: "compliance-pass",
          path: "$.vp_token[1]",
        }),
      ],
    };
    const authorizationResponse = createVpAuthorizationResponse({
      state: authorizationRequest.state,
      vp_token: [
        {
          format: "midnight_compact_vp",
          presentationFamily: "passport-secret",
          schemaId: "passport-presentation:v1",
          schemaVersion: "1.0",
          presentation: encodeSecretPassportPresentation(
            passportFixture.presentation,
          ),
          credentialProof: encodeSecretPassportProof(
            passportFixture.credentialProof,
          ),
        },
        {
          format: "midnight_compact_vp",
          presentationFamily: "compliance",
          schemaId: "compliance-presentation:v1",
          schemaVersion: "1.0",
          presentation: encodeSanctionScreeningPresentation(
            complianceFixture.presentation,
          ),
          credentialProof: encodeSanctionScreeningProof(
            complianceFixture.credentialProof,
          ),
        },
      ],
      presentation_submission: submission,
    });

    assertPresentationSubmissionMatchesDefinition({ definition, submission });
    expect(tokenRequest["pre-authorized_code"]).toBe("alice-preauth-code");
    expect(credentialResponse.credential).toMatchObject({
      credentialFamily: "passport-secret",
    });
    expect(authorizationRequest.midnight?.requireSameHolder).toBe(true);
    expect(authorizationResponse.state).toBe("private-growth-note");
  });
});
