# Trust and release-age exceptions

Temporary parent-API compatibility resolutions are documented separately in
[Security compatibility boundaries](security-compatibility-overrides.md). They
are not trust/release-age waivers and do not disable the defaults below.

This repository allows only exact `package@version` exceptions. Each entry was
added only after an actual pnpm failure and registry metadata review. Default
`minimumReleaseAge: 10080`, `trustPolicy: no-downgrade`, and
`blockExoticSubdeps: true` remain in force.

## Release-age exceptions (Ledger9/SDK5 cohort)

| Package | Version | Published (UTC) | Integrity (SHA-512) | Upstream source | Rationale |
|---|---|---|---|---|---|
| `@midnight-ntwrk/midnight-js-level-private-state-provider` | `5.0.0` | 2026-11-06T00:08:48.799Z | `sha512-Oic7SW8pcTV243K8eIBCyHTLN1qjWR0vIiGwue16hMSzvsh7wCmd0ujZC6kuSeXryj5liiSA+1qORM7U/HSSnQ==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | First observed blocker; required SDK5 private-state provider. |
| `@midnight-ntwrk/compact-js` | `3.0.0` | 2026-11-05T17:45:42.178Z | `sha512-W7uZjICxfVDQJeeNpLYEIey93yuujFlK2377Eo7VrNLTUKp/CVpV8cs1ytyICHhkC8LYtFZMYVZ0ddCS9pXYPQ==` | git+https://github.com/midnightntwrk/compact-js.git | SDK5 ledger9 contract wrapper; required by API manifest. |
| `@midnight-ntwrk/midnight-js-indexer-public-data-provider` | `5.0.0` | 2026-11-06T00:08:43.072Z | `sha512-I2LHUiv2YCexTjIcZ0yfvcSfXk2wmMYiG08iqsPplmSbCh1N+ffzq8oRHwleCGNIDMLmWDi1yjATK/r8PUAx5A==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 indexer provider; required for Ledger9 reads. |
| `@midnight-ntwrk/midnight-js-node-zk-config-provider` | `5.0.0` | 2026-11-06T00:09:03.760Z | `sha512-4A8KSVqIs7K6zN0GP0vaIX501TKqA6N3JftPLajNkyYFnbRQ4IpCTusknxbcOFw0f1EwCL9dnJsxq76rWu1M/w==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 ZK artifact provider; required for artifact runtime-era checks. |
| `@midnight-ntwrk/midnight-js-utils` | `5.0.0` | 2026-11-06T00:09:35.394Z | `sha512-/hrcn+9kYH1hed9QspMUmGiisTauJ7aVSzXmHwci2LD9icIfh045mKkFw8zRQCnWq9dYZ1CMj//aaBPyIp3MjA==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 utility package; required by API source. |
| `@midnight-ntwrk/midnight-js-types` | `5.0.0` | 2026-11-06T00:10:17.458Z | `sha512-RN5y4h5ZXEih2xlsVH1+2/3ThRBfe/qGJUjHuxTY4VyhqjZaJ8i9ycArm66a9sLFb6psdkYCREnsopEdvFibrA==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 provider/era types; required by API source. |
| `@midnightntwrk/ledger-v9` | `1.0.0` | 2026-11-04T19:45:55.509Z | `sha512-0o45+ypO1Yo2PRcP6fqp9YgqTwceNEyl+o9X81VIVWVjZNOIbK0z7ztVKxrECiPQq/WgpQWrrVu66GfLvjZZww==` | git+https://github.com/midnightntwrk/midnight-ledger.git | Exact Ledger9 pin used by `midnight-js-protocol@5.0.0`; do not mix a second Ledger9 copy. |
| `@midnight-ntwrk/midnight-js-fetch-zk-config-provider` | `5.0.0` | 2026-11-06T00:07:57.832Z | `sha512-S3C76aceRo8FDHe66QaZWjMO+K1snMWnhNlsXsBCx7ljy65Cg3LGGKz3AhV1++YKx56Qv3cQ34NUc4DyW/h1ww==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 dev dependency for fetch-based ZK config. |
| `@midnight-ntwrk/midnight-js-http-client-proof-provider` | `5.0.0` | 2026-11-06T00:08:08.825Z | `sha512-UKYCKyRlkSq38hxVEh9idUnpRoC7qmCGiEH55NsAOJYOkMn9T+C0cu4DPGPPDXkslXkp/rxf8BC9RG3K3rwd9w==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 proof provider; required by API provider wiring. |
| `@midnight-ntwrk/wallet-sdk-hd` | `4.0.0` | 2026-11-05T22:35:39.929Z | `sha512-TPDjg+k98wJbcdu2xicCSXC6giO+2LROkVtaELdWvW3k3sWfzQ208VzM71kO+0d4RLr2EUp6P5870SX2LlPhWg==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade-family HD wallet; required by API wallet context. |
| `@midnight-ntwrk/midnight-js-contracts` | `5.0.0` | 2026-11-06T00:08:13.867Z | `sha512-zh4XVEMjzuQ31xSv6PLHCcHZ9UigUfsSYAMvNWJt5lAKdQp8fZBQu93Yy04QIocKChdu/4lw1Hm03kOGHJty4A==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 contract lifecycle APIs; required by API deploy/find paths. |
| `@midnight-ntwrk/wallet-sdk-dust-wallet` | `5.0.0` | 2026-11-05T22:34:40.676Z | `sha512-J02iG4z1TQ/TvuGqbDC+Z6+DlnXL/EpOASU9V6dWRiHpAAkfF24xWcLiwzxcYDhMfj7DWaVS0VxM9GccLTsJyA==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade-family dust wallet; required by API wallet context. |
| `@midnight-ntwrk/wallet-sdk-unshielded-wallet` | `4.0.0` | 2026-11-05T22:35:16.933Z | `sha512-Vh2CEOrZuP2cR/GAXpPc8YFpij9gRs5meJswfO+TY/C1NbUadPaDBneFZD1z5Ry8P1pxmGGzM6r6OSamALwQiQ==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade-family unshielded wallet; required by API wallet context. |
| `@midnight-ntwrk/wallet-sdk-address-format` | `4.0.0` | 2026-11-05T22:34:29.465Z | `sha512-ZeoVu/eNsBqvEwp4fnwB8AoJ93zkwCu2u+t5JQ9wTvGfqYEPSwaM1AzerWQpKC6uxg9NVk7juwyQe9L8az0img==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade-family address codec; required by wallet/keystore paths. |
| `@midnight-ntwrk/wallet-sdk-shielded` | `4.0.0` | 2026-11-05T22:36:03.352Z | `sha512-wjLIozD2ujhQn0OZdQd0IgU0xBON99LQLGo33RdD5N7uLRBEGsxQ+cY0FSB41SO8CkpmOY7VhrwhLLrx78UUww==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade-family shielded wallet; required by API wallet context. |
| `@midnight-ntwrk/wallet-sdk-facade` | `5.0.0` | 2026-11-05T22:35:35.224Z | `sha512-d2wf8wTsxX3d24yKRlFd/RaiuPUvxYIVah/ZftZHbm9hjOIezwUT6AGNLqZTucFnkPsvQrM1CH2fmErlhzvbiA==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade wallet integration; required by API wallet context. |
| `@midnightntwrk/onchain-runtime-v4` | `4.0.0` | 2026-11-04T19:48:05.276Z | `sha512-JpsmaZ2/OSDCkQ8o2321f1n1B0B95acogA/HWSgR6zvRrsRMj+wjh6OebE5LD7JnUj8xVoloZysMjaTTpaQYlQ==` | git+https://github.com/midnightntwrk/midnight-ledger.git | Exact Ledger9 on-chain runtime pinned by `midnight-js-protocol@5.0.0`. |
| `@midnight-ntwrk/midnight-js-protocol` | `5.0.0` | 2026-11-06T00:10:10.603Z | `sha512-Z73hYQ8zfYJlaVaWuPjfRxBvBaRsKzrAtMVmwPTZzstOu/YTzv5FsQdTtNCYUxrGANrcUX1fiftg/qRXj4KVzA==` | git+ssh://git@github.com/midnight-ntwrk/artifacts.git | SDK5 protocol package carrying the Ledger9/Ledger8 runtime bindings. |
| `@midnight-ntwrk/wallet-sdk-abstractions` | `3.0.0` | 2026-11-05T22:34:25.688Z | `sha512-uRgKIrWcpedIz2wVqnKzs1/8MZEXKusMZNCYFAC1Pv7DttSfyU8HRyJaqUTeZN3ayu1nmNnlGGVBZdYx0Y0HEQ==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 facade-family shared abstractions. |
| `@midnight-ntwrk/wallet-sdk-runtime` | `2.0.0` | 2026-11-05T22:34:46.277Z | `sha512-COgA1dT1zpKk+SIjHptmV94DYnflr7ycGFIstcV830rHRKQhmPiPZMWfFHIAxzs7W/tWPlFFQMLZWFNBgiNlkw==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 wallet runtime dependency. |
| `@midnight-ntwrk/wallet-sdk-utilities` | `1.3.0` | 2026-11-05T22:36:43.180Z | `sha512-xrTKy2XkCMoVU+p9DQNtGxR8767smRU7zfeepd4zz46ORAeYHiCCgpXZOckt4TIEECMpEiqjWkjS5P9V6Bgc2w==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 wallet utility dependency. |
| `@midnight-ntwrk/wallet-sdk-indexer-client` | `2.0.0` | 2026-11-05T22:36:15.763Z | `sha512-rYfT3sXGPoRF7yS47n2RuluTPEeppXv6P0j3bZVVw9uAjt6dMnqe6sorEInik8TBRb1AtVwF7+BY5zUbWYGivQ==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 wallet indexer client dependency. |
| `@midnight-ntwrk/wallet-sdk-capabilities` | `4.0.0` | 2026-11-05T22:35:25.848Z | `sha512-hJ+gF+d+d17lyiWpinfwsWl9RTDY5UF9GWdFMPpG72EDt4B5JSaPBNKeW+7uX8KKkCIFewJfM+Nf1fYA/AnsiQ==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 wallet capability dependency. |
| `@midnightntwrk/wallet-sdk-address-format` | `4.0.0` | 2026-11-05T22:33:11.474Z | `sha512-EwDK+aEocpVk/jHwcjuFxK+0VKRUwqfmXdkTooyeOPfoep9DYYAD3m2fZH+60oy8P+VdLZ0bFeB2e+146l82ug==` | git+https://github.com/midnightntwrk/midnight-wallet.git | SDK5 address codec under the no-hyphen scope; distinct required package, not a duplicate alias. |
| `@midnightntwrk/zkir-v2` | `2.2.0` | 2026-11-04T19:50:37.469Z | `sha512-bF96JgzZtzf3HLLEeoHwuCjofNUZThAEnQTVZRLJKNHui9dyENwpjUup7/xryZCBR+z1EETYA4G/lSO6eFWEcg==` | git+https://github.com/midnightntwrk/midnight-ledger.git | SDK5 proving dependency (ZKIR v2 compatibility). |
| `@midnight-ntwrk/wallet-sdk-node-client` | `2.0.0` | 2026-11-05T22:37:49.827Z | `sha512-xiYr+Kn3Y/FLh3SXT7NudpF0LRf/8SKLHeoS87o9rVWbenKTTpzWKjzb3TuHl/VU4ZFX0l9pP+/kTcHLV/Aa7w==` | git+https://github.com/midnightntwrk/midnight-wallet.git (packages/node-client) | SDK5 wallet node client dependency. |
| `@midnight-ntwrk/wallet-sdk-prover-client` | `2.0.0` | 2026-11-05T22:35:22.921Z | `sha512-k/LVHhyr5rrdRRGYC7JpyNQrv4ReXarnXPkiKqB6sioXM3kb12OoEqf85dH33/kbX6Gn1RVmoz+tw0KBv/AUCA==` | git+https://github.com/midnightntwrk/midnight-wallet.git (packages/prover-client) | SDK5 wallet prover client dependency. |

## Exact trust-policy exceptions

| Package@version | Registry SHA-512 | Baseline lock match | Evidence |
|---|---|---|---|
| `semver@6.3.1` | `sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==` | yes | no provenance; earlier `7.5.1` has provenance; maintainer-approved exact exception |
| `undici-types@6.21.0` | `sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==` | yes | type-only via protobufjs/@types/node; earlier `6.13.0` has provenance; maintainer-approved exact exception |

The full audit snapshot and limitations are kept with the issue work; this file
records the committed rationale for the exact exceptions in
`pnpm-workspace.yaml`.

## Build scripts

`onlyBuiltDependencies` lists only the native packages required by this
repository's tests and docs. Native builds are run explicitly with
`pnpm rebuild classic-level esbuild tree-sitter tree-sitter-bash unrs-resolver`;
no build-all bypass is used.
