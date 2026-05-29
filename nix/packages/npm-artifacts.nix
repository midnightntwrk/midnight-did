{
  lib,
  stdenv,
  nodejs_24,
  pnpm_10,
  fetchPnpmDeps,
  pnpmConfigHook,
  turbo,
  compact-midnight,
  compact-toolchain,
  midnight-circuit-params,
  src,
}:

let
  pnpm = pnpm_10;
in
stdenv.mkDerivation (finalAttrs: {
  pname = "midnight-did-npm-artifacts";
  version = "0.1.0";

  inherit src;

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) src;
    inherit pnpm;
    pname = finalAttrs.pname;
    hash = "sha256-jPA40QnIcjyXcCd/aVu+KtuzL/k1VwgB761c+FW/2Uo=";
    fetcherVersion = 3;
  };

  nativeBuildInputs = [
    nodejs_24
    pnpm
    pnpmConfigHook
    compact-midnight
    compact-toolchain
    turbo
  ];

  preBuild = ''
    # Remove the packageManager field so pnpm doesn't try to self-install a specific version
    ${lib.getExe nodejs_24} -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      delete pkg.packageManager;
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
  '';

  buildPhase = ''
    runHook preBuild

    export COMPACT_DIRECTORY=${compact-toolchain}

    # Pre-populate zkir circuit parameters (required for compact compile in offline sandbox)
    # Note: HOME is already set by pnpmConfigHook (postConfigure); do not override it,
    # otherwise pnpm won't find the .npmrc with store-dir and other critical config.
    mkdir -p $HOME/.cache/midnight/zk-params
    cp -r ${midnight-circuit-params}/* $HOME/.cache/midnight/zk-params/

    pnpm run build:all

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out

    # Pack each artifact workspace, matching the order from did-workspace-catalog.mjs
    for workspace in packages/jubjub-schnorr packages/contract packages/domain packages/did packages/api; do
      pnpm --filter "./$workspace" pack --pack-destination $out
    done

    runHook postInstall
  '';

  meta = with lib; {
    description = "All midnight-did npm artifact tarballs";
    homepage = "https://github.com/midnight-ntwrk/midnight-did";
    license = lib.licenses.asl20;
    platforms = compact-toolchain.meta.platforms;
  };
})
