# Identity Examples Submodule Plan

## Purpose
Add external Midnight identity repositories as tracked Git submodules to reference Jubjub key creation, signing, and verification examples during CLI secret-storage and signing work.

## Approved Scope
- Add as real tracked submodules.
- Place under `research/identity-examples/`.
- Keep local build/cache artifacts ignored, but keep submodule paths tracked.

## Target Paths
- `research/identity-examples/midnight-identity-solution-examples`
- `research/identity-examples/midnight-identity-oracle-ssi`

## Repositories
1. `https://github.com/midnightntwrk/midnight-identity-solution-examples.git`
2. `https://github.com/midnightntwrk/midnight-identity-oracle-ssi`

## Execution Steps
1. Create parent directory:
   - `mkdir -p research/identity-examples`
2. Add submodule #1:
   - `git submodule add https://github.com/midnightntwrk/midnight-identity-solution-examples.git research/identity-examples/midnight-identity-solution-examples`
3. Add submodule #2:
   - `git submodule add https://github.com/midnightntwrk/midnight-identity-oracle-ssi.git research/identity-examples/midnight-identity-oracle-ssi`
4. Sync/init:
   - `git submodule sync --recursive`
   - `git submodule update --init --recursive`
5. Update `.gitignore` with artifact-only rules:
   - `research/identity-examples/**/node_modules/`
   - `research/identity-examples/**/dist/`
   - `research/identity-examples/**/build/`
   - `research/identity-examples/**/.env`
6. Verify:
   - `git status --short`
   - `cat .gitmodules`
   - `git submodule status --recursive`

## Expected Git Changes
- `.gitmodules` contains both new submodule entries.
- Two tracked gitlink paths under `research/identity-examples/`.
- `.gitignore` updated only for local artifacts (not submodule paths).

## Acceptance Criteria
- Both repositories available locally via submodule paths.
- Submodules are tracked and reproducible via `git submodule update --init --recursive`.
- Local artifacts from those repos are ignored.
