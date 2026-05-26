{
  lib,
  buildNpmPackage,
  nodejs_24,
  turbo,
  compact-midnight,
  compact-toolchain,
  midnight-circuit-params,
  src,
}:

buildNpmPackage {
  pname = "midnight-did-npm-artifacts";
  version = "0.1.0";

  inherit src;

  patches = [ ./package-lock-resolved.patch ];

  nodejs = nodejs_24;

  npmDepsHash = "sha256-Lh7Fq7FY41HHrvoaOBB/RhUqGFjzZ6Z8UoZCs82nEIQ=";
  npmDepsFetcherVersion = 2;

  nativeBuildInputs = [
    compact-midnight
    compact-toolchain
    turbo
  ];

  buildPhase = ''
    runHook preBuild

    export COMPACT_DIRECTORY=${compact-toolchain}
    export HOME=$TMPDIR

    # Pre-populate zkir circuit parameters (required for compact compile in offline sandbox)
    mkdir -p $HOME/.cache/midnight/zk-params
    cp -r ${midnight-circuit-params}/* $HOME/.cache/midnight/zk-params/

    npm run build:all

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out

    # Pack each artifact workspace, matching the order from did-workspace-catalog.mjs
    for workspace in packages/jubjub-schnorr packages/contract packages/domain packages/did packages/api; do
      npm pack --pack-destination $out -w "$workspace"
    done

    runHook postInstall
  '';

  meta = with lib; {
    description = "All midnight-did npm artifact tarballs";
    homepage = "https://github.com/midnight-ntwrk/midnight-did";
    license = lib.licenses.asl20;
    platforms = compact-toolchain.meta.platforms;
  };
}