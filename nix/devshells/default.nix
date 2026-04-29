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
          self'.packages.compact-midnight
        ];

        shellHook = ''
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
        '';
      };
    };
}
