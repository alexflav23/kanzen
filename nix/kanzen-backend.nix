# NixOS module — runs the Kanzen backend on an EC2 host (CLAUDE.md: EC2 autoscaling + NixOS; the host pulls the packaged
# Universal tarball from S3 `pkgs`). The release is NOT baked into the AMI: on start the host pulls the latest tarball
# from `s3://kanzen-${env}-pkgs/`, unpacks it, and renders a 0600 systemd EnvironmentFile from SSM (/kanzen/${env}/*) +
# Secrets Manager (kanzen/${env}/*). The env-var names match the `${?VAR}` fallbacks in the backend's reference.conf, so
# no application change is needed. Updating the app = publish a new tarball + restart (an ASG instance refresh).
#
# Validated by the CI `nixos-validate` job (a Linux Nix builder evaluates this module); the backend it runs is the
# sandbox-complete service unchanged.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.kanzen-backend;
in
{
  options.services.kanzen-backend = {
    enable = lib.mkEnableOption "the Kanzen backend service";
    env = lib.mkOption {
      type = lib.types.str;
      default = "staging";
      description = "Deployment env — the SSM/Secrets prefix and the S3 pkgs bucket suffix (kanzen-<env>-pkgs).";
    };
    region = lib.mkOption {
      type = lib.types.str;
      default = "eu-west-1";
      description = "AWS region for SSM / Secrets Manager / S3.";
    };
  };

  config = lib.mkIf cfg.enable {
    users.users.kanzen = {
      isSystemUser = true;
      group = "kanzen";
      home = "/var/lib/kanzen";
      createHome = true;
    };
    users.groups.kanzen = { };

    systemd.services.kanzen-backend = {
      description = "Kanzen backend (${cfg.env})";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      path = [ pkgs.awscli2 pkgs.gnutar pkgs.xz pkgs.jre_headless pkgs.coreutils pkgs.gawk ];
      environment = { AWS_DEFAULT_REGION = cfg.region; };

      preStart = ''
        set -euo pipefail
        umask 077
        cd /var/lib/kanzen

        # 1) pull the latest published release from S3 pkgs and unpack it
        latest=$(aws s3 ls "s3://kanzen-${cfg.env}-pkgs/" | awk '{print $4}' | grep '\.txz$' | sort | tail -1)
        test -n "$latest"
        aws s3 cp "s3://kanzen-${cfg.env}-pkgs/$latest" release.txz
        rm -rf app && mkdir -p app
        tar -xJf release.txz -C app --strip-components=1

        # 2) render the systemd EnvironmentFile from SSM (non-secret) + Secrets Manager (secret). The KEY names match the
        #    ${?VAR} fallbacks in reference.conf; systemd reads each value to end-of-line (no quoting needed).
        ssm() { aws ssm get-parameter --name "/kanzen/${cfg.env}/$1" --query 'Parameter.Value' --output text; }
        sec() { aws secretsmanager get-secret-value --secret-id "kanzen/${cfg.env}/$1" --query 'SecretString' --output text; }
        {
          echo "KANZEN_ENV=${cfg.env}"
          echo "PUBLIC_BASE_URL=$(ssm public-base-url)"
          echo "COGNITO_ISSUER=$(ssm cognito/issuer)"
          echo "COGNITO_AUDIENCE=$(ssm cognito/audience)"
          echo "COGNITO_JWKS_URI=$(ssm cognito/jwks-uri)"
          echo "S3_BUCKET=$(ssm s3/bucket)"
          echo "S3_REGION=$(ssm s3/region)"
          echo "DATABASE_URL=$(ssm db/url)"
          echo "DB_USER=$(ssm db/user)"
          echo "DB_PASSWORD=$(sec db-password)"
          echo "BLOB_SECRET=$(sec blob-secret)"
          # override the dev-only defaults so prod talks to real AWS S3 via the EC2 instance role (no static keys)
          echo "S3_ENDPOINT="
          echo "S3_ACCESS_KEY="
          echo "S3_SECRET_KEY="
        } > env
        chmod 600 env
      '';

      serviceConfig = {
        User = "kanzen";
        Group = "kanzen";
        WorkingDirectory = "/var/lib/kanzen";
        EnvironmentFile = "/var/lib/kanzen/env";
        ExecStart = "/var/lib/kanzen/app/bin/kanzen-backend";
        Restart = "on-failure";
        RestartSec = 5;
        # hardening
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        ReadWritePaths = [ "/var/lib/kanzen" ];
      };
    };
  };
}
