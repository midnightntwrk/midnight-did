# Issue #241 Schnorr reduction documentation retrospective

Date: 2026-09-10
Canonical tracker: [midnightntwrk/midnight-did#241](https://github.com/midnightntwrk/midnight-did/issues/241)
Release-readiness context: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443)

## What prompted the work

The Jubjub Schnorr package README said that the `Uint<7>` type and `q < 116`
assertion prevent every field-modulus wrap-around witness with a different
remainder. Issue #241 shows that this is stronger than the circuit establishes:
a narrow overlap of BLS12-381 challenge values admits two bounded `(q, r)`
decompositions even though the bound covers every honest quotient.

The first release-readiness change for issue #443 was deliberately limited to
correcting that claim. It does not alter the protocol, circuit, generated
artifacts, signing behavior, or release state.

## What worked

- The correction distinguishes three separate facts: honest integer division
  produces `q` in `0..115`, the circuit rejects `q = 116`, and those constraints
  do not prove decomposition uniqueness for every transcript.
- The host witness remains unambiguous operationally: integer division and
  modulo select the canonical honest `(q, r)` used by the signer.
- Linking the package documentation directly to issue #241 keeps the narrow
  two-decomposition overlap and its analysis discoverable without overstating
  its practical impact.
- A focused textual assertion and the repository documentation, verification,
  and strict validation lanes protect the corrected wording and confirm that
  this remains a documentation-only change.

## Friction and decisions

- The previous wording combined an accurate quotient bound with an inaccurate
  uniqueness conclusion. The replacement preserves the bound while explicitly
  separating host witness construction from what the in-circuit field equation
  proves.
- No signature forgery has been demonstrated. The documentation therefore does
  not convert the known non-uniqueness into a stronger exploit claim.
- No property test or circuit change was added because either would exceed this
  behavior-neutral first PR and require cryptographic and Compact review.
- Cryptographic analysis, circuit remediation, formal justification, and the
  overlap property test remain separately reviewed 0.7 work or part of a
  coordinated upstream Jubjub integration. This deferral is a scope decision,
  not a claim that issue #241 is resolved.
- No configuration drift or process failure was observed during this narrow
  documentation correction. Exact-head validation and routed review remain
  required before acceptance.

## Validation and review evidence

The PR records the focused wording assertion, documentation tests and builds,
visual documentation check, mandatory repository verification, full strict run
with the available proof-server image, docs-only classifier result, signed/DCO
commit evidence, exact-head self-review, hosted CI, and routed review state.

## Follow-ups

Keep issue #241 open for the separately reviewed 0.7/upstream decision. That
follow-up must choose and justify a cryptographic/circuit/formal remedy and add
the overlap property coverage appropriate to that remedy. It must not treat
this documentation correction as evidence that the in-circuit decomposition is
unique.
