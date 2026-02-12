"""Analytics module with pluggable database adapter pattern.

Supports both DuckDB (in-memory) and Snowflake (cloud) backends
via adapter pattern, similar to apps/monolith/src/services/AnalyticsService.ts.
"""
import io
import json
import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

import boto3
import numpy as np
import pandas as pd

from .adapters import BaseAnalyticsAdapter, create_analytics_adapter
from .config import Config

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class Analytics:
    """
    Analytics engine with pluggable database adapter.

    Supports both DuckDB (in-memory) and Snowflake (cloud) backends
    via adapter pattern.

    The adapter is selected based on ANALYTICS_ADAPTER environment variable:
    - "duckdb" (default): In-memory, zero-cost, ideal for PoC
    - "snowflake": Cloud-based, scalable, enterprise-ready
    """

    def __init__(
        self, config: Config, adapter: BaseAnalyticsAdapter | None = None
    ) -> None:
        """
        Initialize analytics engine.

        Args:
            config: Configuration object
            adapter: Optional pre-configured adapter (for testing/DI).
                    If None, will create adapter based on config.
        """
        self.config = config
        self.s3_client = boto3.client("s3", region_name=config.aws_region)

        # Use provided adapter or create from config (Dependency Injection)
        self.adapter = adapter or create_analytics_adapter(config)

    def download_from_s3(self, s3_path: str) -> pd.DataFrame:
        """Download CSV from S3 and return DataFrame."""
        bucket = self.config.s3_bucket
        logger.info(f"Downloading s3://{bucket}/{s3_path}")

        response = self.s3_client.get_object(Bucket=bucket, Key=s3_path)
        csv_data = response["Body"].read().decode("utf-8")
        return pd.read_csv(io.StringIO(csv_data))

    def generate_dummy_data(self, n_samples: int = 5000) -> pd.DataFrame:
        """Generate dummy sales/analytics data for validation."""
        np.random.seed(42)

        # Generate synthetic sales data
        dates = pd.date_range(start="2024-01-01", periods=n_samples, freq="h")
        categories = ["electronics", "clothing", "food", "books", "home"]
        regions = ["north", "south", "east", "west"]

        data = {
            "timestamp": dates,
            "category": np.random.choice(categories, n_samples),
            "region": np.random.choice(regions, n_samples),
            "quantity": np.random.poisson(10, n_samples),
            "unit_price": np.random.uniform(5, 500, n_samples).round(2),
            "discount_pct": np.random.choice([0, 5, 10, 15, 20], n_samples),
            "customer_id": np.random.randint(1000, 9999, n_samples),
        }

        df = pd.DataFrame(data)
        df["revenue"] = df["quantity"] * df["unit_price"] * (1 - df["discount_pct"] / 100)
        return df

    def run_analytics_queries(self) -> dict[str, Any]:
        """
        Execute analytics queries using the configured adapter.

        Queries are database-agnostic SQL that works on both DuckDB and Snowflake.
        """
        results: dict[str, Any] = {}

        # Summary statistics
        summary_query = """
            SELECT
                COUNT(*) as total_transactions,
                SUM(revenue) as total_revenue,
                AVG(revenue) as avg_revenue,
                MIN(revenue) as min_revenue,
                MAX(revenue) as max_revenue,
                SUM(quantity) as total_quantity,
                COUNT(DISTINCT customer_id) as unique_customers
            FROM sales
        """
        result = self.adapter.execute_query(summary_query)
        if result.success and result.data is not None:
            results["summary"] = result.data.to_dict(orient="records")[0]
        else:
            logger.error(f"Summary query failed: {result.error}")

        # Revenue by category
        category_query = """
            SELECT
                category,
                COUNT(*) as transactions,
                SUM(revenue) as total_revenue,
                AVG(revenue) as avg_revenue,
                SUM(quantity) as total_quantity
            FROM sales
            GROUP BY category
            ORDER BY total_revenue DESC
        """
        result = self.adapter.execute_query(category_query)
        if result.success and result.data is not None:
            results["by_category"] = result.data.to_dict(orient="records")

        # Revenue by region
        region_query = """
            SELECT
                region,
                COUNT(*) as transactions,
                SUM(revenue) as total_revenue,
                AVG(revenue) as avg_revenue
            FROM sales
            GROUP BY region
            ORDER BY total_revenue DESC
        """
        result = self.adapter.execute_query(region_query)
        if result.success and result.data is not None:
            results["by_region"] = result.data.to_dict(orient="records")

        # Daily aggregation
        daily_query = """
            SELECT
                DATE_TRUNC('day', timestamp) as date,
                COUNT(*) as transactions,
                SUM(revenue) as daily_revenue,
                AVG(unit_price) as avg_unit_price
            FROM sales
            GROUP BY DATE_TRUNC('day', timestamp)
            ORDER BY date
        """
        result = self.adapter.execute_query(daily_query)
        if result.success and result.data is not None:
            daily_df = result.data
            daily_df["date"] = daily_df["date"].astype(str)
            results["daily_trend"] = daily_df.to_dict(orient="records")

        # Top customers
        top_customers_query = """
            SELECT
                customer_id,
                COUNT(*) as transactions,
                SUM(revenue) as total_spend,
                AVG(revenue) as avg_order_value
            FROM sales
            GROUP BY customer_id
            ORDER BY total_spend DESC
            LIMIT 10
        """
        result = self.adapter.execute_query(top_customers_query)
        if result.success and result.data is not None:
            results["top_customers"] = result.data.to_dict(orient="records")

        # Discount impact analysis
        discount_query = """
            SELECT
                discount_pct,
                COUNT(*) as transactions,
                SUM(revenue) as total_revenue,
                AVG(quantity) as avg_quantity
            FROM sales
            GROUP BY discount_pct
            ORDER BY discount_pct
        """
        result = self.adapter.execute_query(discount_query)
        if result.success and result.data is not None:
            results["discount_impact"] = result.data.to_dict(orient="records")

        return results

    def upload_results(self, results: dict[str, Any]) -> str:
        """Upload analytics results as JSON to S3."""
        bucket = self.config.s3_bucket
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Add metadata
        results["metadata"] = {
            "generated_at": datetime.utcnow().isoformat(),
            "adapter": self.adapter.adapter_name,
            "data_source": "dummy_data",  # Change when using real data
            "version": "2.0.0",  # Updated for adapter pattern
        }

        # Upload timestamped version
        s3_path = f"{self.config.s3_analytics_path}analytics_{timestamp}.json"
        logger.info(f"Uploading to s3://{bucket}/{s3_path}")
        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_path,
            Body=json.dumps(results, indent=2, default=str).encode("utf-8"),
            ContentType="application/json",
        )

        # Also upload as "latest"
        latest_path = f"{self.config.s3_analytics_path}analytics_latest.json"
        self.s3_client.put_object(
            Bucket=bucket,
            Key=latest_path,
            Body=json.dumps(results, indent=2, default=str).encode("utf-8"),
            ContentType="application/json",
        )

        return s3_path

    def run(self, use_dummy_data: bool = True) -> None:
        """
        Main analytics pipeline using adapter pattern.

        The adapter is swapped via ANALYTICS_ADAPTER environment variable.
        No code changes needed to switch between DuckDB and Snowflake.
        """
        logger.info(
            f"Starting analytics job (adapter: {self.adapter.adapter_name})"
        )

        # Use context manager for automatic connection management
        with self.adapter:
            # Test connection
            if not self.adapter.test_connection():
                raise RuntimeError(
                    f"Failed to connect to {self.adapter.adapter_name}"
                )

            # Load data
            if use_dummy_data:
                logger.info("Using dummy data for validation")
                df = self.generate_dummy_data()
            else:
                # Future: load from S3 processed data
                df = self.download_from_s3(self.config.s3_processed_path)

            # Load into database via adapter
            self.adapter.load_data(df, table_name="sales")
            logger.info(f"Loaded {len(df)} records into {self.adapter.adapter_name}")

            # Run analytics
            results = self.run_analytics_queries()
            logger.info(f"Computed {len(results)} analytics result sets")

        # Upload results (after connection closed)
        s3_path = self.upload_results(results)
        logger.info(
            f"Analytics complete. Results: s3://{self.config.s3_bucket}/{s3_path}"
        )
