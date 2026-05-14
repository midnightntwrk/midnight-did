# University BDD Use-Case Packet

This packet contains the canonical artifacts used by reviews, CI sanity checks, and local demos for the university diploma BDD flow.

## Contents
- `university-bdd.fixture.json`
  - Core scenario fixture driving student, issuer, verifier, and mall behaviour.
- `sample-request-replies.json`
  - Deterministic request/reply examples for student-to-university issue transactions and downstream policy responses.
- `sample-replay.json`
  - Minimal replay artifact for stable step-level hashing and intent drift checks.
- `sample-report.json`
  - Deterministic full scenario report including timings and assertions for the default fixture.

## Synchronization checklist
Before any PR that changes `api/src/test/fixtures/university-diploma/university-bdd.fixture.json` or scenario logic:

- [ ] Update `university-bdd.fixture.json` if fixture contract changed.
- [ ] Rebuild packet with:
  - `npm run university-bdd:run -- --fixture docs/uc-bundles/university-bdd/university-bdd.fixture.json --artifact docs/uc-bundles/university-bdd/sample-report.json --replay-artifact docs/uc-bundles/university-bdd/sample-replay.json --summary /tmp/university-bdd-summary.txt --format summary`
- [ ] Replace `sample-request-replies.json` when transport logic or request/response shape changes.
- [ ] Validate replay/reports compare cleanly with `npm run university-bdd:run -- --assert-replay docs/uc-bundles/university-bdd/sample-replay.json --fixture docs/uc-bundles/university-bdd/university-bdd.fixture.json`.
- [ ] Update packet metadata (timestamps/version references) when report shape evolves.

## Notes
- Keep this packet stable; reviewers should be able to inspect deterministic snapshots without running the full API build.
