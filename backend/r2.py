"""Cloudflare R2 storage helper (S3-compatible API via boto3)."""
from __future__ import annotations

import os

import boto3
from botocore.client import Config

R2_BUCKET = os.getenv("R2_BUCKET_NAME", "modevi")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "").rstrip("/")


def _client():
    endpoint = os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    if not all([endpoint, access_key, secret_key]):
        raise RuntimeError(
            "R2 no configurado. Establece R2_ENDPOINT_URL, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY."
        )
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=15,
            retries={"max_attempts": 1},
        ),
        region_name="auto",
    )


def upload(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to R2 and return the public URL."""
    _client().put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    if not R2_PUBLIC_URL:
        raise RuntimeError("R2_PUBLIC_URL no está configurada.")
    return f"{R2_PUBLIC_URL}/{key}"


def delete(key: str) -> None:
    """Delete a file from R2. Silently ignores if not found."""
    try:
        _client().delete_object(Bucket=R2_BUCKET, Key=key)
    except Exception:
        pass


def is_configured() -> bool:
    return bool(
        os.getenv("R2_ENDPOINT_URL")
        and os.getenv("R2_ACCESS_KEY_ID")
        and os.getenv("R2_SECRET_ACCESS_KEY")
        and os.getenv("R2_PUBLIC_URL")
    )
