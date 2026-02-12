"""MLOps Smoke Test - S3 IRSA verification.

This module verifies that the MLOps infrastructure is ready:
- IRSA (IAM Roles for Service Accounts) is correctly configured
- S3 bucket access (read/write) is working
- No GPU or model loading required

Execution time: ~5-10 seconds
"""
import os
import boto3
from datetime import datetime


def run():
    """Run S3 smoke test to verify IRSA and bucket access."""
    bucket = os.environ.get("S3_BUCKET")
    if not bucket:
        raise RuntimeError("S3_BUCKET environment variable not set")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    key = f"smoke/mlops_smoke_{timestamp}.txt"
    body = f"mlops smoke ok - {timestamp}"

    s3 = boto3.client("s3")

    # Test write
    print(f"[SMOKE] Writing to s3://{bucket}/{key}")
    s3.put_object(Bucket=bucket, Key=key, Body=body.encode())
    print("[SMOKE] Write successful")

    # Test read
    print(f"[SMOKE] Reading back from s3://{bucket}/{key}")
    response = s3.get_object(Bucket=bucket, Key=key)
    content = response["Body"].read().decode()
    print(f"[SMOKE] Read successful: {content}")

    # Verify content matches
    if content != body:
        raise RuntimeError(f"Content mismatch: expected '{body}', got '{content}'")

    print("[SMOKE] MLOps smoke OK - IRSA and S3 access verified")
