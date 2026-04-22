import { describe, expect, it } from "vitest";

import {
  assertPresentationSubmissionMatchesDefinition,
  createFieldPath,
  createMidnightCompactDescriptor,
  createPresentationDefinition,
  createVpAuthorizationRequest,
  createVpAuthorizationResponse,
  presentationRequestUri,
} from "../index.js";

describe("OID4VP-inspired Midnight presentation schemas", () => {
  it("models a verifier request for multiple Midnight presentations", () => {
    const definition = createPresentationDefinition({
      id: "private-growth-note-requirements",
      name: "Private Growth Note eligibility",
      purpose: "Prove age and compliance without disclosing raw identity data.",
      input_descriptors: [
        {
          id: "passport-age-over-18",
          format: { midnight_compact_vp: {} },
          constraints: {
            limit_disclosure: "required",
            fields: [
              {
                path: [createFieldPath("body.disclosed.ageThresholdYears")],
                filter: { const: 18 },
              },
            ],
          },
        },
        {
          id: "compliance-pass",
          format: { midnight_compact_vp: {} },
          constraints: {
            fields: [
              {
                path: [createFieldPath("body.disclosed.screeningResult")],
                filter: { const: "PASS" },
              },
            ],
          },
        },
      ],
    });

    const request = createVpAuthorizationRequest({
      response_type: "vp_token",
      client_id: "did:midnight:verifier:private-growth-note",
      response_mode: "direct_post",
      nonce: "verifier-nonce-1",
      state: "checkout-123",
      presentation_definition: definition,
      midnight: {
        verifierDomain: "private-growth-note.example",
        challenge: "0xcafe01",
        acceptedCredentialFamilies: ["passport-secret", "compliance"],
        requireSameHolder: true,
        predicateHints: ["midnight:predicate:age-over", "midnight:predicate:screening-pass"],
      },
    });

    const submission = {
      id: "submission-1",
      definition_id: definition.id,
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
    const response = createVpAuthorizationResponse({
      state: request.state,
      vp_token: [
        { format: "midnight_compact_vp", presentationFamily: "passport-secret" },
        { format: "midnight_compact_vp", presentationFamily: "compliance" },
      ],
      presentation_submission: submission,
    });

    assertPresentationSubmissionMatchesDefinition({ definition, submission });
    expect(request.midnight?.requireSameHolder).toBe(true);
    expect(response.presentation_submission.descriptor_map).toHaveLength(2);
  });

  it("rejects presentation submissions that reference unknown descriptors", () => {
    const definition = createPresentationDefinition({
      id: "single-requirement",
      input_descriptors: [{ id: "known", constraints: { fields: [] } }],
    });

    expect(() =>
      assertPresentationSubmissionMatchesDefinition({
        definition,
        submission: {
          id: "submission-1",
          definition_id: definition.id,
          descriptor_map: [
            createMidnightCompactDescriptor({ id: "unknown", path: "$.vp_token" }),
          ],
        },
      }),
    ).toThrow(/unknown input descriptor/);
  });

  it("creates a request-uri launcher for wallet UX", () => {
    expect(
      presentationRequestUri({
        requestUri: "https://verifier.example/request/123",
        clientId: "did:midnight:verifier:1",
      }),
    ).toContain("openid4vp://authorize");
  });
});
