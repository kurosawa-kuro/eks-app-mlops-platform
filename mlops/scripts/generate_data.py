#!/usr/bin/env python3
"""Generate sample regression data for MLOps pipeline testing."""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def generate_regression_data(n_samples: int = 1000, seed: int = 42) -> pd.DataFrame:
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


def main():
    parser = argparse.ArgumentParser(description="Generate sample regression data")
    parser.add_argument("--output", type=str, default="data.csv", help="Output file path")
    parser.add_argument("--samples", type=int, default=1000, help="Number of samples")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    df = generate_regression_data(n_samples=args.samples, seed=args.seed)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"Generated {len(df)} samples with {len(df.columns)} columns")
    print(f"Output: {output_path}")
    print(f"NaN count per column:\n{df.isna().sum()}")


if __name__ == "__main__":
    main()
