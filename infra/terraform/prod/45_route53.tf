# ===========================================
# Route53 ALIAS Records
# ===========================================

# Backend API: api.tk-k8s.com
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = "${var.api_subdomain}.${var.root_domain}"
  type    = "A"

  alias {
    name                   = aws_lb.api_main.dns_name
    zone_id                = aws_lb.api_main.zone_id
    evaluate_target_health = true
  }
}

# Frontend: app.tk-k8s.com
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = "app.${var.root_domain}"
  type    = "A"

  alias {
    name                   = aws_lb.api_main.dns_name
    zone_id                = aws_lb.api_main.zone_id
    evaluate_target_health = true
  }
}
