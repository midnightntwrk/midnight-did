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

          # Provision the pinned project-local Pi packages from settings. Public
          # packages install without credentials; the private review package is
          # attempted only when a GitHub token is available.
          if [ -f .pi/settings.json ]; then
            if [ -z "''${GITHUB_TOKEN:-}" ]; then
              if [ -n "''${GH_TOKEN:-}" ]; then
                export GITHUB_TOKEN="''${GH_TOKEN}"
              elif [ -n "''${GH_TOKENS:-}" ]; then
                export GITHUB_TOKEN="''${GH_TOKENS}"
              fi
            fi

            while IFS=$'\t' read -r pi_spec pi_package pi_version; do
              [ -n "$pi_spec" ] || continue
              pi_package_json=".pi/npm/node_modules/$pi_package/package.json"
              pi_installed_version=""
              if [ -f "$pi_package_json" ]; then
                pi_installed_version="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version ?? "")' "$pi_package_json")"
              fi

              if [ -n "$pi_installed_version" ] && { [ -z "$pi_version" ] || [ "$pi_installed_version" = "$pi_version" ]; }; then
                continue
              fi

              if [ "$pi_package" = "@input-output-hk/agent-review-pi" ] && [ -z "''${GITHUB_TOKEN:-}" ]; then
                echo "Skipping private Pi package $pi_spec (set GITHUB_TOKEN, GH_TOKEN, or GH_TOKENS to install it)."
                continue
              fi

              echo "Installing project-local Pi package $pi_spec..."
              pi install "$pi_spec" --local --approve </dev/null
            done < <(node -e '
              const fs = require("fs");
              const settings = JSON.parse(fs.readFileSync(".pi/settings.json", "utf8"));
              for (const spec of settings.packages ?? []) {
                if (typeof spec !== "string" || !spec.startsWith("npm:")) continue;
                const ref = spec.slice(4);
                const at = ref.startsWith("@") ? ref.indexOf("@", 1) : ref.indexOf("@");
                const name = at === -1 ? ref : ref.slice(0, at);
                const version = at === -1 ? "" : ref.slice(at + 1);
                console.log([spec, name, version].join("\t"));
              }
            ')
          fi
        '';
      };
    };
}
