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

          # The Pi extension is private on GitHub Packages, so install it at
          # shell entry using the caller's token rather than baking credentials
          # into the Nix store. The project settings remain the source of truth.
          if [ -f .pi/settings.json ] && [ -n "''${GITHUB_TOKEN:-}" ] && [ ! -d .pi/npm/node_modules/@input-output-hk/agent-review-pi ]; then
            echo "Installing project-local agent-peer-review Pi package..."
            pi install npm:@input-output-hk/agent-review-pi@0.4.0 --local --approve
          fi
        '';
      };
    };
}
