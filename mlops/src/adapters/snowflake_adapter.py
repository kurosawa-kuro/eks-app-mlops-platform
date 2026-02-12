"""Snowflake adapter implementation for cloud-based analytics."""
import logging
import os
from typing import TYPE_CHECKING

import pandas as pd

from .base import BaseAnalyticsAdapter, QueryResult

if TYPE_CHECKING:
    from ..config import Config

logger = logging.getLogger(__name__)


class SnowflakeAdapter(BaseAnalyticsAdapter):
    """
    Snowflake adapter for cloud-based analytics.

    Mirrors pattern from:
    - apps/monolith/src/adapters/database/MongoAdapter.ts

    Features:
    - Cloud-native data warehouse
    - Auto-scaling compute (warehouse)
    - Enterprise-grade security and governance
    - Ideal for production workloads at scale

    Notes:
    - Requires snowflake-connector-python package
    - Authentication via environment variables (SNOWFLAKE_PASSWORD)
    - Connection may have cold-start latency (warehouse spin-up)
    """

    # Column type mapping from pandas to Snowflake
    DTYPE_MAP = {
        "int64": "NUMBER",
        "float64": "FLOAT",
        "object": "VARCHAR",
        "datetime64[ns]": "TIMESTAMP_NTZ",
        "bool": "BOOLEAN",
    }

    def __init__(self, config: "Config", adapter_logger: logging.Logger | None = None):
        super().__init__(config, adapter_logger)
        self._cursor = None

    @property
    def adapter_name(self) -> str:
        return "Snowflake"

    @property
    def supports_dataframe_load(self) -> bool:
        """Snowflake supports DataFrame loading via write_pandas()."""
        return True

    def connect(self) -> None:
        """Establish Snowflake connection."""
        try:
            # Import here to make snowflake-connector-python optional
            import snowflake.connector

            # Get password from environment (never from config for security)
            password = os.getenv("SNOWFLAKE_PASSWORD")
            if not password:
                raise ValueError(
                    "SNOWFLAKE_PASSWORD environment variable is required"
                )

            self._connection = snowflake.connector.connect(
                account=self.config.snowflake_account,
                user=self.config.snowflake_user,
                password=password,
                warehouse=self.config.snowflake_warehouse,
                database=self.config.snowflake_database,
                schema=self.config.snowflake_schema,
            )
            self._cursor = self._connection.cursor()
            self.logger.info(
                f"Snowflake connection established: "
                f"{self.config.snowflake_database}.{self.config.snowflake_schema} "
                f"(warehouse: {self.config.snowflake_warehouse})"
            )
        except ImportError:
            raise ImportError(
                "snowflake-connector-python is required for Snowflake adapter. "
                "Install with: pip install snowflake-connector-python"
            )
        except Exception as e:
            self.logger.error(f"Snowflake connection failed: {e}")
            raise

    def disconnect(self) -> None:
        """Close Snowflake connection."""
        if self._cursor:
            self._cursor.close()
            self._cursor = None
        if self._connection:
            self._connection.close()
            self._connection = None
            self.logger.info("Snowflake connection closed")

    def _infer_snowflake_type(self, dtype: str) -> str:
        """Map pandas dtype to Snowflake type."""
        return self.DTYPE_MAP.get(str(dtype), "VARCHAR")

    def ensure_table(self, table_name: str, df: pd.DataFrame) -> None:
        """
        Ensure table exists with proper schema.

        This separates schema management from data loading,
        which is important for Snowflake governance.
        """
        if not self._cursor:
            raise RuntimeError("Not connected to Snowflake")

        # Build column definitions
        columns = []
        for col_name, dtype in df.dtypes.items():
            sf_type = self._infer_snowflake_type(dtype)
            # Sanitize column name (uppercase, no special chars)
            safe_name = str(col_name).upper().replace(" ", "_")
            columns.append(f'"{safe_name}" {sf_type}')

        create_sql = f"""
            CREATE TABLE IF NOT EXISTS {table_name.upper()} (
                {", ".join(columns)}
            )
        """
        self.logger.info(f"Ensuring table exists: {table_name.upper()}")
        self._cursor.execute(create_sql)

    def load_data(self, df: pd.DataFrame, table_name: str = "sales") -> None:
        """
        Load DataFrame into Snowflake table.

        Uses write_pandas for efficient bulk loading.
        """
        if not self._connection:
            raise RuntimeError("Not connected to Snowflake")

        try:
            # Import here to make package optional
            from snowflake.connector.pandas_tools import write_pandas

            self.logger.info(
                f"Loading {len(df)} rows into Snowflake table '{table_name}'"
            )

            # Ensure table schema exists
            self.ensure_table(table_name, df)

            # Truncate existing data (for analytics refresh pattern)
            self._cursor.execute(f"TRUNCATE TABLE IF EXISTS {table_name.upper()}")

            # Load data
            success, nchunks, nrows, _ = write_pandas(
                conn=self._connection,
                df=df,
                table_name=table_name.upper(),
                auto_create_table=False,  # We manage schema explicitly
                overwrite=False,  # Already truncated
            )

            if success:
                self.logger.info(
                    f"Successfully loaded {nrows} rows into '{table_name}' "
                    f"({nchunks} chunks)"
                )
            else:
                raise RuntimeError(f"write_pandas returned success=False")

        except Exception as e:
            self.logger.error(f"Failed to load data: {e}")
            raise

    def execute_query(self, query: str) -> QueryResult:
        """Execute SQL query and return results."""
        if not self._cursor:
            return self._error_result(
                RuntimeError("Not connected to Snowflake"),
                "Query execution failed",
            )

        try:
            self._cursor.execute(query)
            result_df = self._cursor.fetch_pandas_all()
            return self._success_result(result_df)
        except Exception as e:
            return self._error_result(
                e, f"Snowflake query failed: {query[:100]}"
            )

    def test_connection(self) -> bool:
        """Test Snowflake connection."""
        try:
            if not self._connection:
                self.connect()
            result = self.execute_query("SELECT 1 AS connected")
            return result.success and result.data is not None and len(result.data) == 1
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False
