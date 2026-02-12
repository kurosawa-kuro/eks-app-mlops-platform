"""Dummy review data generator for sentiment analysis testing."""
import io
import logging
import random

import boto3
import pandas as pd

from .config import Config

logger = logging.getLogger(__name__)

# Sample Japanese reviews for EC shop products
POSITIVE_REVIEWS = [
    "この商品、まじで最高だった！買ってよかった。",
    "思っていた以上に品質が良くて大満足です。",
    "配送も早くて梱包も丁寧。また利用したいです。",
    "コスパ最強！この値段でこの品質は驚き。",
    "デザインがおしゃれで気に入っています。友達にも勧めました。",
    "使いやすくて毎日愛用しています。おすすめです！",
    "期待以上の商品でした。星5つ間違いなし。",
    "サイズもピッタリで色も写真通り。満足！",
    "丁寧な対応ありがとうございました。また買います。",
    "これは買い！迷っている人は今すぐ購入すべき。",
]

NEGATIVE_REVIEWS = [
    "壊れて届いた、最悪。二度と買わない。",
    "写真と全然違う。詐欺みたいな商品。",
    "すぐに壊れた。品質管理どうなってるの？",
    "対応が遅すぎる。問い合わせしても返信なし。",
    "値段の割に安っぽい。もう少しお金出せばよかった。",
    "サイズが合わない。表記がおかしい。",
    "1週間で壊れました。返品したい。",
    "臭いがひどくて使えない。換気しても取れない。",
    "説明書が分かりにくい。組み立てに3時間かかった。",
    "二度と利用しません。他のショップで買います。",
]

NEUTRAL_REVIEWS = [
    "まあ普通かな。可もなく不可もなく。",
    "値段相応だと思います。特に不満はない。",
    "期待通りの商品でした。普通に使えます。",
    "良くも悪くもない。リピートするかは微妙。",
    "デザインは好みだけど、機能は普通。",
    "思っていたのとちょっと違うけど、使えなくはない。",
    "届くのに時間がかかったけど、商品自体は普通。",
    "特筆すべき点はないけど、問題もない。",
    "想定内の品質。特別良くも悪くもない。",
    "まあまあかな。次は別の商品も試してみたい。",
]

PRODUCT_IDS = [
    "SKU-001", "SKU-002", "SKU-003", "SKU-004", "SKU-005",
    "SKU-101", "SKU-102", "SKU-103", "SKU-104", "SKU-105",
]


class ReviewGenerator:
    """Generate dummy review data for testing."""

    def __init__(self, config: Config):
        self.config = config
        self.s3_client = boto3.client("s3", region_name=config.aws_region)

    def generate_reviews(self, count: int = 100) -> pd.DataFrame:
        """Generate random reviews with balanced sentiment distribution."""
        reviews = []

        for i in range(count):
            # Distribute: 40% positive, 30% neutral, 30% negative
            rand = random.random()
            if rand < 0.4:
                text = random.choice(POSITIVE_REVIEWS)
            elif rand < 0.7:
                text = random.choice(NEUTRAL_REVIEWS)
            else:
                text = random.choice(NEGATIVE_REVIEWS)

            reviews.append({
                "review_id": f"REV-{i+1:04d}",
                "product_id": random.choice(PRODUCT_IDS),
                "review_text": text,
            })

        return pd.DataFrame(reviews)

    def upload_to_s3(self, df: pd.DataFrame) -> str:
        """Upload DataFrame as CSV to S3."""
        bucket = self.config.s3_bucket
        s3_path = self.config.s3_reviews_path
        logger.info(f"Uploading to s3://{bucket}/{s3_path}")

        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_path,
            Body=csv_buffer.getvalue().encode("utf-8"),
            ContentType="text/csv",
        )
        return s3_path

    def run(self, count: int = 100) -> None:
        """Generate and upload reviews."""
        logger.info(f"Generating {count} dummy reviews")

        df = self.generate_reviews(count)
        logger.info(f"Generated {len(df)} reviews")

        s3_path = self.upload_to_s3(df)
        logger.info(
            f"Reviews uploaded to s3://{self.config.s3_bucket}/{s3_path}"
        )
