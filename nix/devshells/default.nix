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
          if [ -f .pi/settings.json ]; then
            # gh conventionally exports GH_TOKEN; retain compatibility with
            # GITHUB_TOKEN and the historical GH_TOKENS spelling as well.
            if [ -z "''${GITHUB_TOKEN:-}" ]; then
              if [ -n "''${GH_TOKEN:-}" ]; then
                export GITHUB_TOKEN="''${GH_TOKEN}"
              elif [ -n "''${GH_TOKENS:-}" ]; then
                export GITHUB_TOKEN="''${GH_TOKENS}"
              fi
            fi

            if [ -n "''${GITHUB_TOKEN:-}" ]; then
              agent_review_spec="$(grep -Eo 'npm:@input-output-hk/agent-review-pi@[^" ]+' .pi/settings.json | head -n 1 || true)"
              agent_review_package_json=".pi/npm/node_modules/@input-output-hk/agent-review-pi/package.json"
              agent_review_installed_version=""
              if [ -f "$agent_review_package_json" ]; then
                agent_review_installed_version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^" ]*\)".*/\1/p' "$agent_review_package_json" | head -n 1 || true)"
              fi
              agent_review_requested_version="''${agent_review_spec##*@}"

              if [ -n "$agent_review_spec" ] && [ "$agent_review_installed_version" != "$agent_review_requested_version" ]; then
                echo "Installing project-local agent-peer-review Pi package ($agent_review_spec)..."
                pi install "$agent_review_spec" --local --approve
              fi
            fi
          fi
        '';
      };
    };
}
