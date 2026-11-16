# Temporary security compatibility boundaries

The Ledger9 migration uses Compact 0.36, runtime 0.21, Midnight JS 5,
wallet facade/Dust 5 and wallet components 4. These temporary dependency
resolutions do **not** replace that cohort or change DID authorization behavior.

## Reviewed workspace resolutions

| Boundary                             | Resolution                              | Compatibility obligation / removal condition                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| archiver-utils 5.0.2 → glob          | 14.0.2, with glob's minimatch 11.0.1    | Parent declares glob 10. The used synchronous expansion API is retained; fixture expansion/filter/mapping, archive output and abort behavior are regression-tested. Remove when an adopted parent supports the fixed chain.                                                                                                                                                                                                                              |
| typescript-estree 8.67.0 → minimatch | 11.0.1                                  | Parent declares 10; named `minimatch()` remains the used API. Project-service allowed/rejected input behavior is tested. Remove after an adopted supported parent release.                                                                                                                                                                                                                                                                               |
| TypeDoc 0.28.20 → minimatch          | 11.0.1 plus a version-pinned pnpm patch | Public `matchOne` was removed. Only directory-recursion matching is adapted to public partial matching, with parsed-pattern negation disabled; original file inclusion, empty/comment handling, node_modules and symlink/directory controls remain. Explicit fixtures were established on the original graph and compared with the patched graph. Remove the patch and override together after a supported upstream equivalent passes those regressions. |
| platform-js 3.0.0 → Effect platform  | 0.97.2, with effect 3.22.4              | The parent declares ^0.96.1. Prior static inspection found only its Error import, whose ESM/CJS/declarations matched the fixed version. This is limited compatibility evidence, **not** whole-program safety or exploitability proof. Remove after adopting a supported parent/cohort release and revalidating.                                                                                                                                          |

Overrides are exact and parent-scoped. Unaffected minimatch 3/5 consumers and
Archiver's separate readdir-glob path are not forced onto minimatch 11. A
blanket minimatch override under glob 10 is not safe: glob 10 expects the old
matcher representation. No advisory is ignored and no audit severity, release
age, provenance/trust policy or exotic-subdependency protection is disabled.

The TypeDoc traversal matcher also disables reinterpreting comments after the
original matcher has parsed negation. Its original empty/comment-set guard
still controls recursion, including relative paths such as `!#dir/**/*.ts`.

Regression limits are deliberate: cancellation observes directory-enumeration
requests, not every stat/read or already-inflight operation. Archive output
uses Archiver's separate unaffected traversal; direct archiver-utils expansion,
filter and mapping tests exercise the overridden edge. The parser check uses
real project service with a literal allowlist, not every glob policy. Normalized
Windows-like fixture inputs are not native Windows validation.

Mermaid 12.2.0 uses its supported KaTeX ^0.18 range, pinned to 0.18.2. The
existing renderer's `securityLevel: "strict"` and sanitization policy remain;
visual/diagram gates must pass without blindly updating expected baselines.

## Applications installing the libraries

**Workspace root overrides do not propagate to library consumers.** Until the
SDK publishes and the application adopts a supported parent fix, an application
using platform-js 3.0.0 needs an explicit interim choice in its own manifest.
For pnpm:

```json
{
  "pnpm": {
    "overrides": {
      "@midnight-ntwrk/platform-js@3.0.0>@effect/platform": "0.97.2"
    }
  }
}
```

For npm:

```json
{
  "overrides": {
    "@midnight-ntwrk/platform-js@3.0.0": {
      "@effect/platform": "0.97.2"
    }
  }
}
```

Keep compatible effect 3.22.4 and the approved SDK/runtime/wallet cohort; inspect
the application's actual resolved graph and audit it. Validate application
behavior, wallet persistence, signing and submission against that graph. This
configuration is not an automatic downstream fix, an audit exemption, or a
promise that every application path is safe. It must be removed/reconsidered
when the parent version changes.

The docs/tooling overrides and TypeDoc patch are workspace build concerns, not
instructions to force unrelated dependencies in downstream applications.
Current candidate consumer validation must install all five current local DID
tarballs with explicit app configuration; historical registry packages or
workspace symlinks do not establish that result. The isolated consumer and
12-circuit ZK HTTP/integrity checks are separate acceptance evidence, not
implied by a clean workspace audit.
