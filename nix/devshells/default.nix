{
  perSystem,
  pkgs,
  self',
  ...
}:

{
  perSystem =
    { pkgs, self', ... }:
    let
      playwright-browsers = pkgs.playwright-driver.browsers.override {
        withFirefox = false;
        withWebkit = false;
        withFfmpeg = false;
      };
    in
    {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          docker
          git
          gnutar
          just
          nodejs_24
          oras
          pi-coding-agent
          playwright-browsers
          turbo
          self'.packages.compact-midnight
          self'.packages.compact-toolchain
        ];

        shellHook = ''
          export PATH=${pkgs.gnutar}/bin:$PATH
          export PLAYWRIGHT_BROWSERS_PATH=${playwright-browsers}
          export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(find -L "$PLAYWRIGHT_BROWSERS_PATH" -type f \( -name chrome -o -name 'Google Chrome for Testing' \) -perm -u+x -print -quit)"
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          export COMPACT_DIRECTORY=${self'.packages.compact-toolchain}
        '';
      };
    };
}
