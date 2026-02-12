"""Sentiment analysis module for EC shop reviews."""
import io
import json
import logging
from datetime import datetime
from typing import Dict, List, Tuple

import boto3
import pandas as pd
from scipy.special import softmax
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from .config import Config

logger = logging.getLogger(__name__)

# Japanese sentiment analysis model
MODEL_NAME = "jarvisx17/japanese-sentiment-analysis"


class SentimentAnalyzer:
    """Sentiment analysis for product reviews with S3 I/O."""

    def __init__(self, config: Config):
        self.config = config
        self.s3_client = boto3.client("s3", region_name=config.aws_region)
        self.tokenizer = None
        self.model = None

    def load_model(self) -> None:
        """Load the sentiment analysis model."""
        logger.info(f"Loading model: {MODEL_NAME}")
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
        logger.info("Model loaded successfully")

    def download_reviews(self) -> pd.DataFrame:
        """Download reviews CSV from S3."""
        bucket = self.config.s3_bucket
        s3_path = self.config.s3_reviews_path
        logger.info(f"Downloading s3://{bucket}/{s3_path}")

        response = self.s3_client.get_object(Bucket=bucket, Key=s3_path)
        csv_data = response["Body"].read().decode("utf-8")
        return pd.read_csv(io.StringIO(csv_data))

    def predict(self, text: str) -> Tuple[str, float]:
        """Predict sentiment for a single text.

        Returns:
            Tuple of (label, score) where label is one of:
            - positive
            - negative
            - neutral
        """
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )
        outputs = self.model(**inputs)
        scores = softmax(outputs.logits.detach().numpy()[0])

        # Get label mapping from model config
        id2label = self.model.config.id2label
        idx = scores.argmax()
        label = id2label[idx].lower()
        score = float(scores[idx])

        return label, score

    def analyze_batch(self, df: pd.DataFrame) -> List[Dict]:
        """Analyze a batch of reviews."""
        results = []

        for idx, row in df.iterrows():
            review_id = row.get("review_id", idx)
            product_id = row.get("product_id", "unknown")
            text = row.get("review_text", "")

            if not text or pd.isna(text):
                logger.warning(f"Skipping empty review: {review_id}")
                continue

            try:
                label, score = self.predict(text)
                results.append({
                    "review_id": str(review_id),
                    "product_id": str(product_id),
                    "text": text[:200],  # Truncate for output
                    "sentiment": label,
                    "score": round(score, 4),
                })

                if (idx + 1) % 10 == 0:
                    logger.info(f"Processed {idx + 1} reviews")

            except Exception as e:
                logger.error(f"Error processing review {review_id}: {e}")
                continue

        return results

    def upload_results(self, results: Dict) -> str:
        """Upload sentiment results to S3."""
        bucket = self.config.s3_bucket
        s3_path = self.config.s3_sentiment_path
        logger.info(f"Uploading results to s3://{bucket}/{s3_path}")

        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_path,
            Body=json.dumps(results, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return s3_path

    def run(self) -> None:
        """Main sentiment analysis pipeline."""
        logger.info("Starting sentiment analysis job")

        # Load model
        self.load_model()

        # Download reviews
        df = self.download_reviews()
        logger.info(f"Downloaded {len(df)} reviews")

        # Analyze
        results_list = self.analyze_batch(df)

        # Calculate summary statistics
        sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
        for r in results_list:
            label = r["sentiment"]
            if label in sentiment_counts:
                sentiment_counts[label] += 1

        # Build output
        output = {
            "timestamp": datetime.utcnow().isoformat(),
            "model": MODEL_NAME,
            "total_reviews": len(results_list),
            "summary": sentiment_counts,
            "results": results_list,
        }

        # Upload
        s3_path = self.upload_results(output)
        logger.info(
            f"Sentiment analysis complete. "
            f"Processed {len(results_list)} reviews. "
            f"Output: s3://{self.config.s3_bucket}/{s3_path}"
        )
        logger.info(f"Summary: {sentiment_counts}")
