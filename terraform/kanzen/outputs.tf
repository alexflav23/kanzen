# Wire-up values the operator feeds into SSM/Secrets + the web build at the launch wave.
output "api_alb_dns" {
  description = "ALB DNS — point the API subdomain here (CNAME)."
  value       = aws_lb.main.dns_name
}

output "web_cloudfront_domain" {
  description = "CloudFront domain — point the apex/web record here."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "rds_endpoint" {
  description = "Postgres endpoint (host:port) for the backend DB config."
  value       = aws_db_instance.main.endpoint
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_issuer" {
  description = "JWKS issuer the backend validates tokens against (F01)."
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "cognito_web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}

output "pkgs_bucket" {
  value = aws_s3_bucket.pkgs.id
}

output "web_bucket" {
  description = "S3 bucket the Vite build is synced to before CloudFront invalidation."
  value       = aws_s3_bucket.web.id
}
