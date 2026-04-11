# Sign & Verify Workspace

Sign & Verify is the cryptographic workspace for detached payload signing and verification in the DID Manager.

## Concept in 30 seconds

- Sign `string`, `json`, or `bytes` payloads with a local private key.
- Require that the signing key is already published in the active DID document.
- Use all supported key curves: `Ed25519`, `Jubjub`, and `P-256`.
- Verify with one of three sources:
  - local `keyRef`
  - explicit `publicJwk`
  - absolute Midnight DID `verificationMethodId`
- Normalize JSON with RFC 8785 before signing or verifying.

## Why this page exists

It separates payload-proof workflows from DID CRUD:

- signing is local private-key usage
- verification can be cross-profile and read-only
- DID document resolution is the trust anchor for remote verification methods

## Sign payload panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Available local keys` | Pick an existing local key | Sourced from Secret Storage |
| `keyRef` | Explicit local key reference | Can be entered manually |
| `Payload type` | Select `string`, `json`, or `bytes` | Affects normalization |
| `Payload` | Raw payload input | `bytes` expects hex |
| `Sign payload` | Produce detached signature | Requires active joined DID and published method |
| `Copy sign result to verify` | Reuse sign output in verify flow | Convenience action for demos |

## Verify payload panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Verification source` | Choose trust source | `Midnight DID verification method`, `Local key`, or `Public JWK` |
| `verificationMethodId` | Resolve public key from DID document | Must be an absolute DID URL with fragment |
| `keyRef` | Verify with active local key | Requires active secret store session |
| `publicJwk JSON` | Verify with explicit public key | Useful for offline or exported verification |
| `Payload type` | Select `string`, `json`, or `bytes` | Must match the signed payload |
| `Signature (base64url)` | Detached signature input | Output from sign step |

## Supported key types

| Curve | Key type | Signature format | Typical verify source |
| --- | --- | --- | --- |
| `Ed25519` | `OKP` | raw Ed25519 signature | DID document |
| `Jubjub` | `EC` | raw 96-byte signature | public JWK |
| `P-256` | `EC` | DER-encoded ECDSA signature | local key or DID document |

## Normalization rules

| Payload type | Normalization |
| --- | --- |
| `string` | UTF-8 bytes of the exact string |
| `json` | RFC 8785 canonical JSON |
| `bytes` | Hex-decoded byte sequence |

This means equivalent JSON objects verify even if field order differs, but `string` and `bytes` are exact-value operations.

## Preconditions

1. Signing requires an active wallet session.
2. Signing requires a joined DID contract.
3. The signing key must already appear in the active DID document as a verification method.
4. DID-document verification works across profiles as long as the verification method id belongs to the active network setup.

## Cross-profile verification

Cross-profile verification is intentional:

1. Sign a payload in profile A.
2. Copy the detached signature, payload, and absolute `verificationMethodId`.
3. Close the session or switch to profile B.
4. Open `Sign & Verify`.
5. Choose `Midnight DID verification method`.
6. Verify with the same payload and signature.

This works because the public key is resolved from the Midnight DID document, not from the original local key store.

## API examples

### Sign a JSON payload

```bash
curl -X POST http://127.0.0.1:3010/api/signatures/sign \
  -H 'content-type: application/json' \
  -d '{
    "keyRef": "961fe66b-39c6-4e39-b890-0f4e3ea18ed6",
    "payloadType": "json",
    "payload": "{\"z\":1,\"a\":2}"
  }'
```

### Verify with a Midnight DID verification method

```bash
curl -X POST http://127.0.0.1:3010/api/signatures/verify \
  -H 'content-type: application/json' \
  -d '{
    "payloadType": "string",
    "payload": "hello midnight",
    "signatureBase64Url": "<signature>",
    "verificationMethodId": "did:midnight:preprod:<contract>#auth-main"
  }'
```

### Verify with an explicit public JWK

```bash
curl -X POST http://127.0.0.1:3010/api/signatures/verify \
  -H 'content-type: application/json' \
  -d '{
    "payloadType": "json",
    "payload": "{\"a\":2,\"z\":1}",
    "signatureBase64Url": "<signature>",
    "publicJwk": {
      "kty": "EC",
      "crv": "Jubjub",
      "x": "<x-coordinate>",
      "y": "<y-coordinate>"
    }
  }'
```

## Related docs

- [DID Manager Getting Started](/guide/getting-started-did-manager)
- [Wallet Setup workspace](/services/wallet-setup)
- [Secret Storage workspace](/services/secret-storage-workspace)
- [DID Management workspace](/services/did-management-workspace)
- [DID Manager architecture](/architecture/did-manager-service)
