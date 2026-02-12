"""Base adapter interface for analytics database operations."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING
import logging

import pandas as pd

if TYPE_CHECKING:
    from ..config import Config

logger = logging.getLogger(__name__)


@dataclass
class QueryResult:
    """Standardized query result."""

    success: bool
    data: pd.DataFrame | None = None
    error: str | None = None


class BaseAnalyticsAdapter(ABC):
    """
    Base adapter for analytics database operations.

    Follows the adapter pattern seen in:
    - apps/monolith/src/adapters/database/BaseDatabaseAdapter.ts
    - apps/monolith/src/adapters/storage/BaseStorageAdapter.ts
    """

    def __init__(self, config: "Config", adapter_logger: logging.Logger | None = None):
        self.config = config
        self.logger = adapter_logger or logging.getLogger(__name__)
        self._connection = None

    @abstractmethod
    def connect(self) -> None:
        """Establish database connection."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close database connection."""
        pass

    @abstractmethod
    def load_data(self, df: pd.DataFrame, table_name: str) -> None:
        """Load DataFrame into database table."""
        pass

    @abstractmethod
    def execute_query(self, query: str) -> QueryResult:
        """Execute SQL query and return results as DataFrame."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Test database connection."""
        pass

    @property
    @abstractmethod
    def adapter_name(self) -> str:
        """Return adapter name for logging."""
        pass

    @property
    @abstractmethod
    def supports_dataframe_load(self) -> bool:
        """
        Whether this adapter supports direct DataFrame loading.

        - DuckDB: register() for in-memory table
        - Snowflake: write_pandas() for cloud table
        - BigQuery/Redshift: may require different methods

        This enables OCP-compliant branching for data loading strategies.
        """
        pass

    # Helper methods (similar to BaseStorageAdapter pattern)

    def _success_result(self, data: pd.DataFrame) -> QueryResult:
        """Create a success result."""
        self.logger.debug(f"Query returned {len(data)} rows")
        return QueryResult(success=True, data=data)

    def _error_result(self, error: Exception, context: str = "") -> QueryResult:
        """Create an error result with logging."""
        error_msg = f"{context}: {str(error)}" if context else str(error)
        self.logger.error(error_msg, exc_info=True)
        return QueryResult(success=False, error=error_msg)

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()
        return False  # Don't suppress exceptions
