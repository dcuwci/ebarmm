"""
Thumbnail Generation Service
Generates and caches image thumbnails for efficient delivery
"""

import io
import hashlib
from typing import Optional, Tuple
from datetime import datetime, timedelta
from functools import lru_cache
import logging

from PIL import Image
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from ..core.config import settings

logger = logging.getLogger(__name__)

# Initialize S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4'),
    use_ssl=settings.S3_USE_SSL
)

# In-memory cache for thumbnails (simple TTL cache)
_thumbnail_cache: dict = {}
_cache_timestamps: dict = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _get_cache_key(storage_key: str, size: int) -> str:
    """Generate cache key for thumbnail"""
    return f"{storage_key}:{size}"


def _is_cache_valid(cache_key: str) -> bool:
    """Check if cached item is still valid"""
    if cache_key not in _cache_timestamps:
        return False
    return datetime.utcnow() - _cache_timestamps[cache_key] < timedelta(seconds=CACHE_TTL_SECONDS)


def _cleanup_expired_cache():
    """Remove expired cache entries (called periodically)"""
    now = datetime.utcnow()
    expired_keys = [
        key for key, timestamp in _cache_timestamps.items()
        if now - timestamp > timedelta(seconds=CACHE_TTL_SECONDS)
    ]
    for key in expired_keys:
        _thumbnail_cache.pop(key, None)
        _cache_timestamps.pop(key, None)


def get_thumbnail_key(original_key: str, size: int = 300) -> str:
    """
    Generate the S3 key for a thumbnail.

    Example: photos/project-id/image.jpg -> thumbnails/project-id/image_300.jpg
    """
    # Replace 'photos/' prefix with 'thumbnails/'
    if original_key.startswith('photos/'):
        thumb_key = original_key.replace('photos/', 'thumbnails/', 1)
    else:
        thumb_key = f"thumbnails/{original_key}"

    # Insert size before extension
    parts = thumb_key.rsplit('.', 1)
    if len(parts) == 2:
        return f"{parts[0]}_{size}.{parts[1]}"
    return f"{thumb_key}_{size}"


def generate_thumbnail(
    image_data: bytes,
    size: int = 300,
    quality: int = 85
) -> Tuple[bytes, str]:
    """
    Generate a thumbnail from image data.

    Args:
        image_data: Original image bytes
        size: Maximum dimension (width or height)
        quality: JPEG quality (1-100)

    Returns:
        Tuple of (thumbnail_bytes, content_type)
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary (for PNG with transparency, etc.)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Calculate new size maintaining aspect ratio
        width, height = img.size
        if width > height:
            new_width = size
            new_height = int(height * size / width)
        else:
            new_height = size
            new_width = int(width * size / height)

        # Resize with high-quality resampling
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Save to bytes
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)

        return output.getvalue(), 'image/jpeg'

    except Exception as e:
        logger.error(f"Failed to generate thumbnail: {e}")
        raise


def generate_and_store_thumbnail(
    storage_key: str,
    size: int = 300
) -> Optional[str]:
    """
    Generate a thumbnail from an existing S3 image and store it.

    Args:
        storage_key: Original image S3 key
        size: Thumbnail size

    Returns:
        Thumbnail S3 key if successful, None otherwise
    """
    try:
        # Fetch original image
        response = s3_client.get_object(
            Bucket=settings.S3_BUCKET,
            Key=storage_key
        )
        image_data = response['Body'].read()

        # Generate thumbnail
        thumbnail_data, content_type = generate_thumbnail(image_data, size)

        # Store thumbnail
        thumbnail_key = get_thumbnail_key(storage_key, size)
        s3_client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=thumbnail_key,
            Body=thumbnail_data,
            ContentType=content_type
        )

        logger.info(f"Generated thumbnail: {thumbnail_key} ({len(thumbnail_data)} bytes)")
        return thumbnail_key

    except ClientError as e:
        logger.error(f"S3 error generating thumbnail for {storage_key}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error generating thumbnail for {storage_key}: {e}")
        return None


def get_thumbnail(
    storage_key: str,
    size: int = 300,
    generate_if_missing: bool = True
) -> Optional[Tuple[bytes, str]]:
    """
    Get a thumbnail, using cache and generating if needed.

    Args:
        storage_key: Original image S3 key
        size: Thumbnail size
        generate_if_missing: Whether to generate if thumbnail doesn't exist

    Returns:
        Tuple of (thumbnail_bytes, content_type) or None
    """
    cache_key = _get_cache_key(storage_key, size)

    # Check memory cache
    if cache_key in _thumbnail_cache and _is_cache_valid(cache_key):
        return _thumbnail_cache[cache_key]

    # Periodic cache cleanup
    if len(_thumbnail_cache) > 100:
        _cleanup_expired_cache()

    thumbnail_key = get_thumbnail_key(storage_key, size)

    try:
        # Try to fetch existing thumbnail from S3
        response = s3_client.get_object(
            Bucket=settings.S3_BUCKET,
            Key=thumbnail_key
        )
        thumbnail_data = response['Body'].read()
        content_type = response.get('ContentType', 'image/jpeg')

        # Cache it
        result = (thumbnail_data, content_type)
        _thumbnail_cache[cache_key] = result
        _cache_timestamps[cache_key] = datetime.utcnow()

        return result

    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            # Thumbnail doesn't exist, generate it
            if generate_if_missing:
                generated_key = generate_and_store_thumbnail(storage_key, size)
                if generated_key:
                    # Fetch the generated thumbnail
                    return get_thumbnail(storage_key, size, generate_if_missing=False)
            return None
        raise


def get_cached_image(
    storage_key: str
) -> Optional[Tuple[bytes, str]]:
    """
    Get full image with caching.

    Args:
        storage_key: Image S3 key

    Returns:
        Tuple of (image_bytes, content_type) or None
    """
    cache_key = f"full:{storage_key}"

    # Check memory cache
    if cache_key in _thumbnail_cache and _is_cache_valid(cache_key):
        return _thumbnail_cache[cache_key]

    try:
        response = s3_client.get_object(
            Bucket=settings.S3_BUCKET,
            Key=storage_key
        )
        image_data = response['Body'].read()
        content_type = response.get('ContentType', 'application/octet-stream')

        # Only cache if image is reasonably small (< 5MB)
        if len(image_data) < 5 * 1024 * 1024:
            result = (image_data, content_type)
            _thumbnail_cache[cache_key] = result
            _cache_timestamps[cache_key] = datetime.utcnow()
            return result

        return (image_data, content_type)

    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            return None
        raise
