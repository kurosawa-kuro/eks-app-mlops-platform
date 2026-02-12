#!/usr/bin/env python3
"""Upload local data file to S3."""
import argparse

import boto3


def main():
    parser = argparse.ArgumentParser(description="Upload data to S3")
    parser.add_argument("--file", type=str, required=True, help="Local file path")
    parser.add_argument("--bucket", type=str, required=True, help="S3 bucket name")
    parser.add_argument("--key", type=str, default="raw/data.csv", help="S3 object key")
    parser.add_argument("--region", type=str, default="ap-northeast-1", help="AWS region")
    args = parser.parse_args()

    s3_client = boto3.client("s3", region_name=args.region)

    print(f"Uploading {args.file} to s3://{args.bucket}/{args.key}")
    s3_client.upload_file(args.file, args.bucket, args.key)
    print("Upload complete")


if __name__ == "__main__":
    main()
