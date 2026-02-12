"""
Adapter factory for creating analytics adapters.

This module provides a pluggable adapter pattern for analytics backends,
enabling environment-based switching between DuckDB and Snowflake.

Usage:
    from adapters import create_analytics_adapter

    config = get_config()
    adapter = create_analytics_adapter(config)

    with adapter:
        adapter.load_data(df, "sales")
        result = adapter.execute_query("SELECT * FROM sales")
"""
import logging
from typing import TYPE_CHECKING

from .base import BaseAnalyticsAdapter, QueryResult
from .duckdb_adapter import DuckDBAdapter

if TYPE_CHECKING:
    from ..config import Config

logger = logging.getLogger(__name__)


def create_analytics_adapter(config: "Config") -> BaseAnalyticsAdapter:
    """
    Factory function to create the appropriate analytics adapter.

    Mirrors pattern from:
    - apps/monolith/src/container/index.ts (adapter selection logic)

    Args:
        config: Configuration object

    Returns:
        Instance of the configured adapter

    Raises:
        ValueError: If adapter type is unknown or configuration is invalid
    """
    adapter_type = config.analytics_adapter.lower()

    logger.info(f"Creating analytics adapter: {adapter_type}")

    if adapter_type == "duckdb":
        return DuckDBAdapter(config, logger)

    elif adapter_type == "snowflake":
        # Import only when needed to avoid requiring snowflake-connector-python
        # when using DuckDB
        if not config.validate_snowflake_config():
            raise ValueError(
                "Snowflake adapter selected but configuration is incomplete. "
                "Required: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_DATABASE"
            )
        from .snowflake_adapter import SnowflakeAdapter

        return SnowflakeAdapter(config, logger)

    else:
        raise ValueError(
            f"Unknown analytics adapter: {adapter_type}. Supported: duckdb, snowflake"
        )


__all__ = [
    "BaseAnalyticsAdapter",
    "QueryResult",
    "DuckDBAdapter",
    "create_analytics_adapter",
]
