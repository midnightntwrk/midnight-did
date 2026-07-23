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
          just
          nodejs_24
          oras
          playwright-driver.browsers
          turbo
          self'.packages.compact-midnight
          self'.packages.compact-toolchain
        ];

        shellHook = ''
          export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
          export COMPACT_DIRECTORY=${self'.packages.compact-toolchain}
        '';
      };
    };
}
