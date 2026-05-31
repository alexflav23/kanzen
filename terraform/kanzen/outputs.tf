# The live URLs (DNS + certs are auto-created in the Route 53 zone — nothing manual to point).
output "web_url" {
  description = "The web app URL."
  value       = "https://${var.domain_name}"
}

output "api_url" {
  description = "The API URL — set the web build's VITE_API_URL to this."
  value       = "https://api.${var.domain_name}"
}

output "api_alb_dns" {
  description = "ALB DNS (the api record already aliases to this)."
  value       = aws_lb.main.dns_name
}

output "web_cloudfront_domain" {
  description = "CloudFront domain — point the apex/web record here."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution id — for the deploy job's cache invalidation."
  value       = aws_cloudfront_distribution.web.id
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
