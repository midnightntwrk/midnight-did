# Guide

Use these pages when changing DID contract, package, API, runner, packaging, or documentation behavior.

1. Install dependencies with `npm ci`.
2. Run `compact update 0.30.0` if your local Compact toolchain is not already pinned.
3. Run `./run.sh --light --strict` before opening a PR.
4. Use focused targets such as `./run.sh core --strict` or `./run.sh api --light --strict` while iterating.
5. Use the split repositories for resolver/manager/secret-storage or VC work.

## Pages

- [Local Development](/guide/local-development)
- [Testing Strategy](/guide/testing-strategy)
- [DID Surface Change Discipline](/guide/did-surface-change-discipline)
- [Publishing](/guide/publishing)

## Source Documents

- [Repository README](/source/repository-overview)
- [Contract README](/source/contract-readme)
- [Domain README](/source/domain-readme)
- [DID README](/source/did-readme)
- [API README](/source/api-readme)
