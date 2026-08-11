{ ... }:

{
  perSystem =
    { inputs', ... }:
    let
      compact-midnight = inputs'.flake-collection.packages.compact-midnight;
      compact-toolchain = inputs'.flake-collection.packages.compact-toolchain;
    in
    {
      packages = {
        inherit compact-midnight compact-toolchain;
      };
    };
}
