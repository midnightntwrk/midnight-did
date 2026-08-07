{
  perSystem,
  pkgs,
  self',
  ...
}:

{
  perSystem =
    { pkgs, self', ... }:
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
          playwright-driver.browsers
          turbo
          self'.packages.compact-midnight
          self'.packages.compact-toolchain
        ];

        shellHook = ''
          export PATH=${pkgs.gnutar}/bin:$PATH
          export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          export COMPACT_DIRECTORY=${self'.packages.compact-toolchain}

          # Provision the pinned project-local Pi packages from settings so
          # entering the Nix shell is sufficient to use the dev-loop extension.
          if [ -f .pi/settings.json ]; then
            while IFS=$'\t' read -r pi_spec pi_package pi_version; do
              [ -n "$pi_spec" ] || continue
              pi_package_json=".pi/npm/node_modules/$pi_package/package.json"
              pi_installed_version=""
              if [ -f "$pi_package_json" ]; then
                pi_installed_version="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version ?? "")' "$pi_package_json")"
              fi

              if [ "$pi_installed_version" = "$pi_version" ]; then
                continue
              fi

              echo "Installing project-local Pi package $pi_spec..."
              pi install "$pi_spec" --local --approve
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
