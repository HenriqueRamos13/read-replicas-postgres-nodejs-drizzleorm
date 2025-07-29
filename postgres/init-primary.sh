#!/bin/bash
set -e

echo "host replication all 0.0.0.0/0 md5" >> $PGDATA/pg_hba.conf
psql -v ON_ERROR_STOP=1 <<-EOSQL
  ALTER SYSTEM SET wal_level = replica;
  ALTER SYSTEM SET max_wal_senders = 10;
  ALTER SYSTEM SET wal_keep_size = '64MB';
  SELECT pg_reload_conf();
EOSQL 