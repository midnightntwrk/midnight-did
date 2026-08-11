{ self, ... }:

{
  perSystem =
    { pkgs, inputs', ... }:
    let
      compact-midnight = inputs'.flake-collection.packages.compact-midnight;
      compact-toolchain = inputs'.flake-collection.packages.compact-toolchain;
      midnight-circuit-params = pkgs.callPackage ./midnight-circuit-params.nix { };
    in
    {
      packages = {
        inherit compact-midnight compact-toolchain midnight-circuit-params;
        npm-artifacts = pkgs.callPackage ./npm-artifacts.nix {
          inherit compact-midnight compact-toolchain midnight-circuit-params;
          src = self;
        };
      };
    };
}
