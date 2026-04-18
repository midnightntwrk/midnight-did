{
  perSystem =
    { pkgs, self', ... }:
    {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          # Core tools
          docker
          git
          just
          nix
          nodejs_24
          # Compact compiler from Midnight Network (v0.5.1)
          self'.packages.compact-midnight
        ];

        shellHook = ''
          export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
        '';
      };
    };
}
