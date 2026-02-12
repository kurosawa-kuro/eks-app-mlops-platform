# ===========================================
# ACM Certificate + DNS Validation
# ===========================================

data "aws_route53_zone" "root" {
  name         = "${var.root_domain}."
  private_zone = false
}

# Wildcard certificate for *.tk-k8s.com (covers api, app, etc.)
resource "aws_acm_certificate" "wildcard" {
  domain_name       = "*.${var.root_domain}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-wildcard-cert"
  })
}

resource "aws_route53_record" "wildcard_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.wildcard.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.root.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "wildcard" {
  certificate_arn         = aws_acm_certificate.wildcard.arn
  validation_record_fqdns = [for r in aws_route53_record.wildcard_cert_validation : r.fqdn]
}
