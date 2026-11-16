{ ... }:

{
  perSystem =
    { inputs', pkgs, ... }:
    let
      compact-midnight = inputs'.flake-collection.packages.compact-midnight;
      compact-toolchain = pkgs.callPackage ./compact-toolchain-0.36.0.nix { };
    in
    {
      packages = {
        inherit compact-midnight compact-toolchain;
      };
    };
}
