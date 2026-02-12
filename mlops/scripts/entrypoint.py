#!/usr/bin/env python3
"""Entrypoint for MLOps pipeline stages."""
import argparse
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="MLOps Pipeline")
    parser.add_argument(
        "--stage",
        type=str,
        required=True,
        choices=["generate", "preprocess", "train", "analytics", "generate-reviews", "sentiment", "smoke"],
        help="Pipeline stage to run",
    )
    args = parser.parse_args()

    logger.info(f"Starting stage: {args.stage}")

    try:
        if args.stage == "generate":
            from src.config import get_config
            from src.generate import DataGenerator

            config = get_config()
            generator = DataGenerator(config)
            generator.run()

        elif args.stage == "preprocess":
            from src.config import get_config
            from src.preprocess import Preprocessor

            config = get_config()
            preprocessor = Preprocessor(config)
            preprocessor.run()

        elif args.stage == "train":
            from src.config import get_config
            from src.train import Trainer

            config = get_config()
            trainer = Trainer(config)
            trainer.run()

        elif args.stage == "analytics":
            import os

            from src.analytics import Analytics
            from src.config import get_config

            config = get_config()
            use_dummy = os.getenv("USE_DUMMY_DATA", "true").lower() == "true"
            analytics = Analytics(config)
            analytics.run(use_dummy_data=use_dummy)

        elif args.stage == "generate-reviews":
            from src.config import get_config
            from src.generate_reviews import ReviewGenerator

            config = get_config()
            generator = ReviewGenerator(config)
            generator.run(count=100)

        elif args.stage == "sentiment":
            from src.config import get_config
            from src.sentiment import SentimentAnalyzer

            config = get_config()
            analyzer = SentimentAnalyzer(config)
            analyzer.run()

        elif args.stage == "smoke":
            from src.smoke import run

            run()

        logger.info(f"Stage {args.stage} completed successfully")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Stage {args.stage} failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
