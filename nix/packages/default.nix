{ self, ... }:

{
  perSystem =
    { pkgs, ... }:
    let
      compact-midnight = pkgs.callPackage ./compact-midnight.nix { };
      compact-toolchain = pkgs.callPackage ./compact-toolchain.nix { };
      midnight-circuit-params = pkgs.callPackage ./midnight-circuit-params.nix { };
    in
    {
      packages = {
        inherit compact-midnight compact-toolchain midnight-circuit-params;
      };
    };
}
