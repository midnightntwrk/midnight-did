{ self, ... }:

{
  perSystem =
    { pkgs, ... }:
    let
      compact-midnight = pkgs.callPackage ./compact-midnight.nix { };
      compact-toolchain = pkgs.callPackage ./compact-toolchain.nix { };
    in
    {
      packages = {
        inherit compact-midnight compact-toolchain;
      };
    };
}
