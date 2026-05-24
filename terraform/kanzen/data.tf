# RDS Postgres 16 (the double-entry ledger + all domain data, ADR-001) and the S3 buckets:
# documents (immutable source originals, F05) + pkgs (Universal tarball the NixOS hosts pull).

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier                = "${local.name}-pg"
  engine                    = "postgres"
  engine_version            = "16"
  instance_class            = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  storage_encrypted         = true
  db_name                   = "kanzen"
  username                  = "kanzen"
  password                  = var.db_password
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [aws_security_group.db.id]
  multi_az                  = local.is_prod
  backup_retention_period   = local.is_prod ? 30 : 7
  deletion_protection       = local.is_prod
  skip_final_snapshot       = !local.is_prod
  final_snapshot_identifier = local.is_prod ? "${local.name}-final" : null
  apply_immediately         = !local.is_prod
}

# Immutable source documents (F05). Versioned + encrypted; the agent files originals here,
# never to Drive (house rule). Object Lock backs F30 annual immutable snapshots.
resource "aws_s3_bucket" "documents" {
  bucket = "${local.name}-documents"
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Release packages (Universal/packageXzTarball) the NixOS hosts pull on deploy.
resource "aws_s3_bucket" "pkgs" {
  bucket = "${local.name}-pkgs"
}

resource "aws_s3_bucket_public_access_block" "pkgs" {
  bucket                  = aws_s3_bucket.pkgs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
