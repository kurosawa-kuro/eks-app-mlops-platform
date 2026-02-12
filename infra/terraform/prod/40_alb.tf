# ===========================================
# Application Load Balancer
# ===========================================

resource "aws_lb" "api_main" {
  name               = local.names.alb
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]

  tags = merge(local.common_tags, {
    Name = local.names.alb
  })
}

# ===========================================
# Target Groups (NodePort)
# ===========================================

# Backend API Target Group
resource "aws_lb_target_group" "api_main" {
  name        = local.names.tg
  port        = var.api_nodeport
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = module.vpc.vpc_id

  health_check {
    protocol            = "HTTP"
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200-399"
  }

  tags = merge(local.common_tags, {
    Name = local.names.tg
  })
}

# Frontend Target Group
resource "aws_lb_target_group" "frontend" {
  name        = "${var.cluster_name}-frontend-tg"
  port        = var.frontend_nodeport
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = module.vpc.vpc_id

  health_check {
    protocol            = "HTTP"
    path                = "/"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200-399"
  }

  tags = merge(local.common_tags, {
    Name = "${var.cluster_name}-frontend-tg"
  })
}

# ===========================================
# HTTPS Listener (443)
# ===========================================

resource "aws_lb_listener" "https_main" {
  load_balancer_arn = aws_lb.api_main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.wildcard.certificate_arn

  # Default: return 404 for unknown hosts
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  tags = local.common_tags
}

# ===========================================
# Listener Rules (Host-based routing)
# ===========================================

# Frontend: app.tk-k8s.com -> frontend target group
resource "aws_lb_listener_rule" "frontend" {
  listener_arn = aws_lb_listener.https_main.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    host_header {
      values = ["app.${var.root_domain}"]
    }
  }

  tags = local.common_tags
}

# Backend API: api.tk-k8s.com -> api target group
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https_main.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_main.arn
  }

  condition {
    host_header {
      values = ["${var.api_subdomain}.${var.root_domain}"]
    }
  }

  tags = local.common_tags
}

# ===========================================
# HTTP Listener (80) -> HTTPS Redirect
# ===========================================

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api_main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = local.common_tags
}

# ===========================================
# ASG Attachments (EKS Managed Node Group)
# ===========================================
# EKSモジュールのoutputからASG名を取得（for_each問題を回避）

# Backend API Target Group
resource "aws_autoscaling_attachment" "eks_nodes_api" {
  for_each = module.eks_cluster.eks_managed_node_groups

  autoscaling_group_name = each.value.node_group_autoscaling_group_names[0]
  lb_target_group_arn    = aws_lb_target_group.api_main.arn
}

# Frontend Target Group
resource "aws_autoscaling_attachment" "eks_nodes_frontend" {
  for_each = module.eks_cluster.eks_managed_node_groups

  autoscaling_group_name = each.value.node_group_autoscaling_group_names[0]
  lb_target_group_arn    = aws_lb_target_group.frontend.arn
}
