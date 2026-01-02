#!/usr/bin/env python3
"""
E-BARMM Data Migration Script
Migrates data from legacy MySQL to target PostgreSQL+PostGIS
See MIGRATION.md for detailed documentation
"""

import sys
import argparse
import logging
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent / 'backend'))

from scripts import (
    migrate_deo,
    bootstrap_users,
    migrate_projects,
    migrate_progress,
    migrate_media,
    migrate_gis
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description='E-BARMM Data Migration')
    parser.add_argument(
        '--step',
        type=str,
        choices=['all', 'deo', 'users', 'projects', 'progress', 'media', 'gis'],
        default='all',
        help='Migration step to run'
    )
    parser.add_argument('--dry-run', action='store_true', help='Dry run (no actual changes)')

    args = parser.parse_args()

    logger.info(f"Starting E-BARMM migration (step: {args.step})")

    try:
        if args.step == 'all' or args.step == 'deo':
            logger.info("Step 1: Migrating DEO data...")
            migrate_deo.run()

        if args.step == 'all' or args.step == 'users':
            logger.info("Step 2: Bootstrapping users...")
            bootstrap_users.run()

        if args.step == 'all' or args.step == 'projects':
            logger.info("Step 3: Migrating projects...")
            migrate_projects.run()

        if args.step == 'all' or args.step == 'progress':
            logger.info("Step 4: Migrating progress logs...")
            migrate_progress.run()

        if args.step == 'all' or args.step == 'media':
            logger.info("Step 5: Migrating media assets...")
            migrate_media.run()

        if args.step == 'all' or args.step == 'gis':
            logger.info("Step 6: Migrating GIS data...")
            migrate_gis.run()

        logger.info("Migration completed successfully!")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
