#!/bin/bash
set -e

wait_for_primary() {
  echo "Waiting for primary database to be ready..."
  for i in {1..30}; do
    if PGPASSWORD=$POSTGRES_PASSWORD pg_isready -h db-main -U postgres; then
      echo "Primary database is ready"
      return 0
    fi
    echo "Attempt $i/30: Primary database not ready, waiting..."
    sleep 2
  done
  echo "Primary database connection timeout"
  return 1
}

wait_for_primary

rm -rf $PGDATA/*

PGPASSWORD=$POSTGRES_PASSWORD pg_basebackup -h db-main -D $PGDATA -U postgres -Fp -Xs -P -R

echo "recovery_min_apply_delay = '1min'" >> $PGDATA/postgresql.auto.conf

chown -R postgres:postgres $PGDATA 