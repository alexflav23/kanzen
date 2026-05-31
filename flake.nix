{
  description = "Kanzen — household operations & asset-registry platform: NixOS deploy (EC2 AMI) + dev shell.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    nixos-generators = {
      url = "github:nix-community/nixos-generators";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, nixos-generators }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

      # The EC2 host: the standard amazon-image base + the Kanzen backend service module. `env`/`region` default to
      # staging and can be overridden per-deployment (a small override module / instance user-data).
      hostModule = { ... }: {
        imports = [
          "${nixpkgs}/nixos/modules/virtualisation/amazon-image.nix"
          ./nix/kanzen-backend.nix
        ];
        services.kanzen-backend.enable = true;
        system.stateVersion = "24.11";
      };
    in
    {
      # The NixOS system CI builds into the EC2 AMI that `terraform/kanzen` references as var.nixos_ami_id.
      nixosConfigurations.kanzen-backend = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [ hostModule ];
      };

      # The packaged AMI image — `nix build .#amazon-image`; CI publishes it and feeds the id into the tfvars.
      packages.${system}.amazon-image = nixos-generators.nixosGenerate {
        inherit system;
        format = "amazon";
        modules = [ hostModule ];
      };

      # Dev shell (CLAUDE.md: Nix + direnv) — the monorepo toolchain. `nix develop` or an `.envrc` with `use flake`.
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [ sbt jdk21 nodejs_22 flutter terraform awscli2 docker-compose ];
        shellHook = ''echo "Kanzen dev shell — sbt · node · flutter · terraform · aws · docker-compose"'';
      };

      # `nix flake check` builds the host's top-level derivation → validates the module + flake on a Linux Nix builder.
      checks.${system}.nixos-builds = self.nixosConfigurations.kanzen-backend.config.system.build.toplevel;
    };
}
