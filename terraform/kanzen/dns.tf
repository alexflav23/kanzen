# DNS + TLS — fully automated via the Route 53 zone (kanzen.family, delegated from GoDaddy). Terraform requests the
# ACM certs, writes their DNS-validation records into the zone, waits for issuance, and creates the app A-ALIAS records.
# So `apply` yields working HTTPS on the web host (→ CloudFront) + the api subdomain (→ ALB) with zero manual cert/DNS
# steps. `domain_name` is the web host (apex for prod, e.g. a `staging.` host for staging); the zone is always the apex.

data "aws_route53_zone" "main" {
  name = var.route53_zone_name
}

# ── ACM certificates (DNS-validated) ──────────────────────────────────────────────────────────────────
# ALB terminates TLS for the API host (eu-west-1, regional); CloudFront needs its cert in us-east-1.
resource "aws_acm_certificate" "alb" {
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_acm_certificate" "cloudfront" {
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}

# Validation CNAMEs in the zone (one per domain/SAN).
resource "aws_route53_record" "alb_validation" {
  for_each        = { for o in aws_acm_certificate.alb.domain_validation_options : o.domain_name => o }
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_route53_record" "cf_validation" {
  for_each        = { for o in aws_acm_certificate.cloudfront.domain_validation_options : o.domain_name => o }
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "alb" {
  certificate_arn         = aws_acm_certificate.alb.arn
  validation_record_fqdns = [for r in aws_route53_record.alb_validation : r.fqdn]
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for r in aws_route53_record.cf_validation : r.fqdn]
}

# ── App records ───────────────────────────────────────────────────────────────────────────────────────
resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
