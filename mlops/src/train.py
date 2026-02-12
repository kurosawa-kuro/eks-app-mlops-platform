"""Model training module."""
import io
import json
import logging
import pickle
from datetime import datetime
from typing import Dict, Any

import boto3
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, root_mean_squared_error

from .config import Config

logger = logging.getLogger(__name__)


class Trainer:
    """Model training with S3 I/O."""

    def __init__(self, config: Config):
        self.config = config
        self.s3_client = boto3.client("s3", region_name=config.aws_region)
        self.model = None

    def download_from_s3(self, s3_path: str) -> pd.DataFrame:
        """Download CSV from S3 and return DataFrame."""
        bucket = self.config.s3_bucket
        logger.info(f"Downloading s3://{bucket}/{s3_path}")

        response = self.s3_client.get_object(Bucket=bucket, Key=s3_path)
        csv_data = response["Body"].read().decode("utf-8")
        return pd.read_csv(io.StringIO(csv_data))

    def upload_model(self, model: Any, filename: str) -> str:
        """Upload pickled model to S3."""
        bucket = self.config.s3_bucket
        s3_path = f"{self.config.s3_models_path}{filename}"
        logger.info(f"Uploading model to s3://{bucket}/{s3_path}")

        model_bytes = pickle.dumps(model)
        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_path,
            Body=model_bytes,
            ContentType="application/octet-stream",
        )
        return s3_path

    def upload_metrics(self, metrics: Dict[str, Any], filename: str) -> str:
        """Upload metrics JSON to S3."""
        bucket = self.config.s3_bucket
        s3_path = f"{self.config.s3_models_path}{filename}"
        logger.info(f"Uploading metrics to s3://{bucket}/{s3_path}")

        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_path,
            Body=json.dumps(metrics, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return s3_path

    def create_model(self):
        """Create model based on config."""
        if self.config.model_type == "linear_regression":
            return LinearRegression()
        return RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1,
        )

    def train(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
        """Train model and return metrics."""
        logger.info(f"Training {self.config.model_type} model")

        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Train
        self.model = self.create_model()
        self.model.fit(X_train, y_train)

        # Predict
        y_pred = self.model.predict(X_test)

        # Metrics
        metrics = {
            "mse": float(mean_squared_error(y_test, y_pred)),
            "rmse": float(root_mean_squared_error(y_test, y_pred)),
            "mae": float(mean_absolute_error(y_test, y_pred)),
            "r2": float(r2_score(y_test, y_pred)),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "model_type": self.config.model_type,
            "timestamp": datetime.utcnow().isoformat(),
        }

        logger.info(f"Training complete. R2: {metrics['r2']:.4f}, RMSE: {metrics['rmse']:.4f}")
        return metrics

    def run(self) -> None:
        """Main training pipeline."""
        logger.info("Starting training job")

        # Download processed data
        df = self.download_from_s3(self.config.s3_processed_path)
        logger.info(f"Downloaded processed data: {df.shape[0]} rows, {df.shape[1]} columns")

        # Assume last column is target (or 'target' column)
        if "target" in df.columns:
            X = df.drop(columns=["target"])
            y = df["target"]
        else:
            X = df.iloc[:, :-1]
            y = df.iloc[:, -1]

        # Train
        metrics = self.train(X, y)

        # Upload model and metrics
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        model_path = self.upload_model(self.model, f"model_{timestamp}.pkl")
        metrics_path = self.upload_metrics(metrics, f"metrics_{timestamp}.json")

        # Also upload as "latest"
        self.upload_model(self.model, "model.pkl")
        self.upload_metrics(metrics, "metrics.json")

        logger.info(f"Training complete. Model: {model_path}, Metrics: {metrics_path}")
