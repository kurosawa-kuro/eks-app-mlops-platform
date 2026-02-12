"""Data preprocessing module."""
import io
import logging
from typing import Tuple, List

import boto3
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler

from .config import Config

logger = logging.getLogger(__name__)


class Preprocessor:
    """Data preprocessing with S3 I/O."""

    def __init__(self, config: Config):
        self.config = config
        self.s3_client = boto3.client("s3", region_name=config.aws_region)

    def download_from_s3(self, s3_path: str) -> pd.DataFrame:
        """Download CSV from S3 and return DataFrame."""
        bucket = self.config.s3_bucket
        logger.info(f"Downloading s3://{bucket}/{s3_path}")

        response = self.s3_client.get_object(Bucket=bucket, Key=s3_path)
        csv_data = response["Body"].read().decode("utf-8")
        return pd.read_csv(io.StringIO(csv_data))

    def upload_to_s3(self, df: pd.DataFrame, s3_path: str) -> None:
        """Upload DataFrame as CSV to S3."""
        bucket = self.config.s3_bucket
        logger.info(f"Uploading to s3://{bucket}/{s3_path}")

        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_path,
            Body=csv_buffer.getvalue().encode("utf-8"),
            ContentType="text/csv",
        )

    def get_scaler(self):
        """Return appropriate scaler based on config."""
        if self.config.scaler_type == "minmax":
            return MinMaxScaler()
        return StandardScaler()

    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Apply preprocessing: fillna + scaling on numeric columns."""
        logger.info(f"Processing DataFrame with shape {df.shape}")

        # Identify numeric columns (exclude target if present)
        numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns.tolist()
        if "target" in numeric_cols:
            numeric_cols.remove("target")

        # Fill missing values with median
        df_processed = df.copy()
        for col in numeric_cols:
            median_val = df_processed[col].median()
            df_processed[col] = df_processed[col].fillna(median_val)
            logger.info(f"Filled {col} NaN with median: {median_val:.4f}")

        # Scale numeric features
        scaler = self.get_scaler()
        df_processed[numeric_cols] = scaler.fit_transform(df_processed[numeric_cols])
        logger.info(f"Applied {self.config.scaler_type} scaling to {len(numeric_cols)} columns")

        return df_processed, numeric_cols

    def run(self) -> None:
        """Main preprocessing pipeline."""
        logger.info("Starting preprocessing job")

        # Download raw data
        df = self.download_from_s3(self.config.s3_raw_path)
        logger.info(f"Downloaded raw data: {df.shape[0]} rows, {df.shape[1]} columns")

        # Process
        df_processed, _ = self.process(df)

        # Upload processed data
        self.upload_to_s3(df_processed, self.config.s3_processed_path)
        logger.info(
            f"Preprocessing complete. Output: s3://{self.config.s3_bucket}/{self.config.s3_processed_path}"
        )
