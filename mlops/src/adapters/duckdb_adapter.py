"""DuckDB adapter implementation for in-memory analytics."""
import logging
from typing import TYPE_CHECKING

import duckdb
import pandas as pd

from .base import BaseAnalyticsAdapter, QueryResult

if TYPE_CHECKING:
    from ..config import Config

logger = logging.getLogger(__name__)


class DuckDBAdapter(BaseAnalyticsAdapter):
    """
    DuckDB adapter for in-memory analytics.

    Mirrors pattern from:
    - apps/monolith/src/adapters/database/PostgresAdapter.ts

    Features:
    - Zero-config in-memory database
    - Direct DataFrame registration (no data copying)
    - Ideal for PoC, testing, and cost-minimal deployments
    """

    @property
    def adapter_name(self) -> str:
        return "DuckDB"

    @property
    def supports_dataframe_load(self) -> bool:
        """DuckDB supports direct DataFrame registration."""
        return True

    def connect(self) -> None:
        """Establish DuckDB connection (in-memory)."""
        try:
            self._connection = duckdb.connect(":memory:")
            self.logger.info("DuckDB connection established (in-memory)")
        except Exception as e:
            self.logger.error(f"DuckDB connection failed: {e}")
            raise

    def disconnect(self) -> None:
        """Close DuckDB connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
            self.logger.info("DuckDB connection closed")

    def load_data(self, df: pd.DataFrame, table_name: str = "sales") -> None:
        """
        Load DataFrame into DuckDB table.

        Uses register() for zero-copy DataFrame access.
        """
        if not self._connection:
            raise RuntimeError("Not connected to DuckDB")

        try:
            self.logger.info(f"Loading {len(df)} rows into DuckDB table '{table_name}'")
            self._connection.register(table_name, df)
            self.logger.info(f"Successfully registered DataFrame as '{table_name}'")
        except Exception as e:
            self.logger.error(f"Failed to load data: {e}")
            raise

    def execute_query(self, query: str) -> QueryResult:
        """Execute SQL query and return results."""
        if not self._connection:
            return self._error_result(
                RuntimeError("Not connected to DuckDB"), "Query execution failed"
            )

        try:
            result_df = self._connection.execute(query).fetchdf()
            return self._success_result(result_df)
        except Exception as e:
            return self._error_result(e, f"DuckDB query failed: {query[:100]}")

    def test_connection(self) -> bool:
        """Test DuckDB connection."""
        try:
            if not self._connection:
                self.connect()
            result = self._connection.execute("SELECT 1 AS connected").fetchdf()
            return len(result) == 1
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False
