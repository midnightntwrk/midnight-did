{
  lib,
  stdenv,
  fetchurl,
}:

let
  platformInfo = {
    x86_64-linux = {
      url_suffix = "compact-x86_64-unknown-linux-musl.tar.xz";
      sourceRoot = "compact-x86_64-unknown-linux-musl";
      sha256 = "sha256-aExrPS7vlISqu6egggwWauXBafOuzyjL6iB0hAJjumY=";
    };
    aarch64-darwin = {
      url_suffix = "compact-aarch64-apple-darwin.tar.xz";
      sourceRoot = "compact-aarch64-apple-darwin";
      sha256 = "sha256-TZBkfk6N4OyNIn62sBqxxYIjUS5ivPNrapNM7vgXmgg=";
    };
  };

  currentPlatform = platformInfo.${stdenv.hostPlatform.system} or null;
in

assert lib.asserts.assertMsg (currentPlatform != null) ''
  compact-midnight does not support system ${stdenv.hostPlatform.system}.
  Supported systems: ${lib.concatStringsSep ", " (lib.attrNames platformInfo)}
'';

stdenv.mkDerivation rec {
  pname = "compact-midnight";
  version = "0.5.1";

  src = fetchurl {
    url = "https://github.com/midnightntwrk/compact/releases/download/compact-v${version}/${currentPlatform.url_suffix}";
    sha256 = currentPlatform.sha256;
  };

  sourceRoot = currentPlatform.sourceRoot;

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp compact $out/bin/
    chmod +x $out/bin/compact

    runHook postInstall
  '';

  meta = with lib; {
    description = "Compact compiler from Midnight Network";
    homepage = "https://github.com/midnightntwrk/compact";
    license = lib.licenses.asl20;
    platforms = lib.attrNames platformInfo;
    mainProgram = "compact";
  };
}
