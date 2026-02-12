# ===========================================
# Shared Kinesis Firehose Delivery Streams
# ===========================================
# Centralized log delivery from all environments to S3
# ===========================================

# ---------------------------------------------
# IAM Role for Firehose
# ---------------------------------------------

resource "aws_iam_role" "firehose_delivery" {
  name = local.names.role_firehose

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "firehose.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "firehose_delivery" {
  name = local.names.policy_firehose
  role = aws_iam_role.firehose_delivery.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.logs.arn,
          "${aws_s3_bucket.logs.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:${local.names.log_firehose_prefix}/*:log-stream:*"
        ]
      }
    ]
  })
}

# ---------------------------------------------
# CloudWatch Log Groups for Firehose Errors
# ---------------------------------------------

resource "aws_cloudwatch_log_group" "firehose_errors" {
  for_each = var.firehose_streams

  name              = "${local.names.log_firehose_prefix}/${each.key}"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_cloudwatch_log_stream" "firehose_errors" {
  for_each = var.firehose_streams

  name           = "S3Delivery"
  log_group_name = aws_cloudwatch_log_group.firehose_errors[each.key].name
}

# ---------------------------------------------
# Firehose Delivery Streams
# ---------------------------------------------

resource "aws_kinesis_firehose_delivery_stream" "log_delivery" {
  for_each = var.firehose_streams

  name        = each.key
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_delivery.arn
    bucket_arn = aws_s3_bucket.logs.arn

    # Buffering
    buffering_size     = each.value.buffer_size
    buffering_interval = each.value.buffer_interval

    # Prefix for S3 keys
    prefix              = "${each.value.prefix}year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "${each.value.prefix}errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"

    # Compression
    compression_format = "GZIP"

    # CloudWatch logging
    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose_errors[each.key].name
      log_stream_name = aws_cloudwatch_log_stream.firehose_errors[each.key].name
    }
  }

  tags = merge(local.common_tags, {
    Name = each.key
  })
}
