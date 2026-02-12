"""Sample data generation module."""
import io
import logging

import boto3
import numpy as np
import pandas as pd

from .config import Config

logger = logging.getLogger(__name__)


class DataGenerator:
    """Generate sample regression data and upload to S3."""

    def __init__(self, config: Config):
        self.config = config
        self.s3_client = boto3.client("s3", region_name=config.aws_region)

    def generate_data(self, n_samples: int = 1000, seed: int = 42) -> pd.DataFrame:
        """Generate synthetic regression data with some NaN values."""
        np.random.seed(seed)

        # Features
        data = {
            "feature_1": np.random.normal(100, 15, n_samples),
            "feature_2": np.random.uniform(0, 50, n_samples),
            "feature_3": np.random.exponential(5, n_samples),
            "feature_4": np.random.normal(50, 10, n_samples),
            "feature_5": np.random.uniform(10, 100, n_samples),
        }

        df = pd.DataFrame(data)

        # Add some NaN values (5% per column)
        for col in df.columns:
            nan_idx = np.random.choice(n_samples, size=int(n_samples * 0.05), replace=False)
            df.loc[nan_idx, col] = np.nan

        # Generate target with known relationship + noise
        df["target"] = (
            2.5 * df["feature_1"].fillna(100)
            + 1.5 * df["feature_2"].fillna(25)
            - 0.8 * df["feature_3"].fillna(5)
            + 0.5 * df["feature_4"].fillna(50)
            + np.random.normal(0, 20, n_samples)
        )

        return df

    def upload_to_s3(self, df: pd.DataFrame) -> None:
        """Upload DataFrame as CSV to S3."""
        bucket = self.config.s3_bucket
        key = self.config.s3_raw_path
        logger.info(f"Uploading to s3://{bucket}/{key}")

        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        self.s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=csv_buffer.getvalue().encode("utf-8"),
            ContentType="text/csv",
        )

    def run(self) -> None:
        """Generate data and upload to S3."""
        logger.info("Starting data generation")

        df = self.generate_data()
        logger.info(f"Generated {len(df)} samples with {len(df.columns)} columns")
        logger.info(f"NaN count per column:\n{df.isna().sum().to_dict()}")

        self.upload_to_s3(df)
        logger.info(
            f"Data uploaded to s3://{self.config.s3_bucket}/{self.config.s3_raw_path}"
        )
