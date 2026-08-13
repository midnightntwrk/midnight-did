{
  description = "Midnight DID - self-contained Nix development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";

    # Compact toolchain (compactc + compact devtool) is consumed from this
    # reusable flake rather than vendored locally. It fetches the same official
    # midnightntwrk/compact release binaries (verified by hash) and additionally
    # fixes the compactc-via-symlink wrapper quirk.
    flake-collection.url = "github:MediaNoxLabs/flake-collection";
    flake-collection.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        ./nix/packages
        ./nix/devshells
      ];
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        { system, ... }:
        {
          _module.args.pkgs = import inputs.nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };
        };
    };
}
