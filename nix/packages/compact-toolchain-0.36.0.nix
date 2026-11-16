{
  lib,
  stdenv,
  fetchzip,
  unzip,
}:

let
  platformInfo = {
    x86_64-linux = {
      compactPlatform = "x86_64-unknown-linux-musl";
      sha256 = "sha256-0GsThMw0zgKFNw+qSXcrmABIy6W4UW4J4Fhn3P64pdc=";
    };
    aarch64-darwin = {
      compactPlatform = "aarch64-darwin";
      sha256 = "sha256-qPVALpcrnoK/Rul3pQ60Y8UGDGlPita9G1R0lalFZmU=";
    };
  };

  currentPlatform = platformInfo.${stdenv.hostPlatform.system} or null;

  version = "0.36.0";
in
assert lib.asserts.assertMsg (currentPlatform != null) ''
  compact-toolchain does not support system ${stdenv.hostPlatform.system}.
  Supported systems: ${lib.concatStringsSep ", " (lib.attrNames platformInfo)}
'';

stdenv.mkDerivation rec {
  pname = "compact-toolchain";
  inherit version;

  src = fetchzip {
    url = "https://github.com/midnightntwrk/compact/releases/download/compactc-v${version}/compactc_v${version}_${currentPlatform.compactPlatform}.zip";
    sha256 = currentPlatform.sha256;
    stripRoot = false;
  };

  nativeBuildInputs = [ unzip ];

  # The compact devtool binary (compact-midnight) reads bin/compactc as a
  # symlink and resolves its target string to locate the compiler. It cannot
  # handle relative symlinks, so prevent Nix from auto-relativizing symlinks.
  dontRewriteSymlinks = true;

  installPhase = ''
    runHook preInstall

    compact_platform="${currentPlatform.compactPlatform}"
    compact_dir="$out/versions/${version}/$compact_platform"

    mkdir -p "$compact_dir"
    cp -r * "$compact_dir"/

    chmod +w "$compact_dir/compactc"
    substituteInPlace "$compact_dir/compactc" \
      --replace-fail 'thisdir="$(cd $(dirname $0) ; pwd -P)"' \
      "thisdir=\"$compact_dir\""

    mkdir -p $out/bin
    ln -s $compact_dir/compactc $out/bin/compactc
    ln -s $compact_dir/fixup-compact $out/bin/fixup-compact
    ln -s $compact_dir/format-compact $out/bin/format-compact

    runHook postInstall
  '';

  meta = with lib; {
    description = "Compact compiler toolchain v${version} providing COMPACT_DIRECTORY layout";
    homepage = "https://github.com/midnightntwrk/compact";
    license = lib.licenses.asl20;
    platforms = lib.attrNames platformInfo;
  };
}
