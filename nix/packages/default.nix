{
  perSystem =
    { pkgs, ... }:
    {
      packages = {
        compact-midnight = pkgs.callPackage ./compact-midnight.nix { };
      };
    };
}
