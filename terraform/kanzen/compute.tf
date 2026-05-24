# Backend: an autoscaling group of NixOS EC2 hosts behind the shared ALB. Each host pulls the
# packaged release (Universal tarball) from the pkgs bucket; config from SSM, secrets from
# Secrets Manager (CLAUDE.md). ALB terminates HTTPS and forwards to the API on :8080; health
# checks hit the admin server on :9990 /health.

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${local.name}-app"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "ReadPackages"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.pkgs.arn, "${aws_s3_bucket.pkgs.arn}/*"]
  }
  statement {
    sid       = "DocumentStore"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]
  }
  statement {
    sid       = "ConfigAndSecrets"
    actions   = ["ssm:GetParameter", "ssm:GetParametersByPath", "secretsmanager:GetSecretValue"]
    resources = ["arn:aws:ssm:${var.region}:*:parameter/kanzen/${local.env}/*", "arn:aws:secretsmanager:${var.region}:*:secret:kanzen/${local.env}/*"]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${local.name}-app"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.name}-app"
  role = aws_iam_role.app.name
}

resource "aws_launch_template" "app" {
  name_prefix            = "${local.name}-"
  image_id               = var.nixos_ami_id
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile { arn = aws_iam_instance_profile.app.arn }

  metadata_options {
    http_tokens   = "required" # IMDSv2 only
    http_endpoint = "enabled"
  }

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${local.name}-app" }
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_lb" "main" {
  name               = local.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "app" {
  name     = "${local.name}-app"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path     = "/health"
    port     = "9990" # admin server
    matcher  = "200"
    interval = 15
    timeout  = 5
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${local.name}-app"
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size
  desired_capacity    = var.asg_min_size
  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name}-app"
    propagate_at_launch = true
  }
  lifecycle { create_before_destroy = true }
}
