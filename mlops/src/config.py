"""Environment-based configuration for MLOps pipeline."""
import os
from dataclasses import dataclass


@dataclass
class Config:
    """Pipeline configuration from environment variables."""

    # AWS
    aws_region: str = os.getenv("AWS_REGION", "ap-northeast-1")
    s3_bucket: str = os.getenv("S3_BUCKET", "")

    # S3 Paths
    s3_raw_path: str = os.getenv("S3_RAW_PATH", "raw/data.csv")
    s3_processed_path: str = os.getenv("S3_PROCESSED_PATH", "processed/data_processed.csv")
    s3_models_path: str = os.getenv("S3_MODELS_PATH", "models/")
    s3_analytics_path: str = os.getenv("S3_ANALYTICS_PATH", "analytics/")

    # Sentiment Analysis Paths
    s3_reviews_path: str = os.getenv("S3_REVIEWS_PATH", "raw/reviews.csv")
    s3_sentiment_path: str = os.getenv("S3_SENTIMENT_PATH", "analytics/sentiment_results.json")

    # Processing settings
    scaler_type: str = os.getenv("SCALER_TYPE", "standard")  # standard or minmax
    model_type: str = os.getenv("MODEL_TYPE", "random_forest")  # random_forest or linear_regression

    # Analytics adapter configuration
    analytics_adapter: str = os.getenv("ANALYTICS_ADAPTER", "duckdb")  # duckdb or snowflake

    # Snowflake configuration (only used if analytics_adapter == "snowflake")
    snowflake_account: str = os.getenv("SNOWFLAKE_ACCOUNT", "")
    snowflake_user: str = os.getenv("SNOWFLAKE_USER", "")
    snowflake_warehouse: str = os.getenv("SNOWFLAKE_WAREHOUSE", "ANALYTICS_WH")
    snowflake_database: str = os.getenv("SNOWFLAKE_DATABASE", "MLOPS_ANALYTICS")
    snowflake_schema: str = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")

    @property
    def raw_s3_uri(self) -> str:
        return f"s3://{self.s3_bucket}/{self.s3_raw_path}"

    @property
    def processed_s3_uri(self) -> str:
        return f"s3://{self.s3_bucket}/{self.s3_processed_path}"

    @property
    def models_s3_uri(self) -> str:
        return f"s3://{self.s3_bucket}/{self.s3_models_path}"

    @property
    def analytics_s3_uri(self) -> str:
        return f"s3://{self.s3_bucket}/{self.s3_analytics_path}"

    @property
    def reviews_s3_uri(self) -> str:
        return f"s3://{self.s3_bucket}/{self.s3_reviews_path}"

    @property
    def sentiment_s3_uri(self) -> str:
        return f"s3://{self.s3_bucket}/{self.s3_sentiment_path}"

    def validate_snowflake_config(self) -> bool:
        """Validate Snowflake configuration if required."""
        if self.analytics_adapter == "snowflake":
            required = [
                self.snowflake_account,
                self.snowflake_user,
                self.snowflake_warehouse,
                self.snowflake_database,
            ]
            return all(required)
        return True


def get_config() -> Config:
    """Factory function to create Config from environment."""
    return Config()
