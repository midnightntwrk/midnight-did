{
  lib,
  stdenv,
  fetchurl,
}:

stdenv.mkDerivation rec {
  pname = "compact-midnight";
  version = "0.5.1";

  src = fetchurl {
    url = "https://github.com/midnightntwrk/compact/releases/download/compact-v${version}/compact-x86_64-unknown-linux-musl.tar.xz";
    sha256 = "sha256-aExrPS7vlISqu6egggwWauXBafOuzyjL6iB0hAJjumY=";
  };

  sourceRoot = "compact-x86_64-unknown-linux-musl";

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
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "compact";
  };
}
