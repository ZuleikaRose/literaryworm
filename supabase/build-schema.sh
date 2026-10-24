#!/usr/bin/env bash
# Regenerates ../schema.sql from the migrations, in order. Run after adding one.
set -euo pipefail
cd "$(dirname "$0")"
{
  echo "-- BookWorm database schema (Supabase Postgres)."
  echo "-- GENERATED from supabase/migrations by supabase/build-schema.sh. Edit the migrations, not this file."
  echo "-- Row Level Security is on for every table; supabase/tests/security_test.sql checks the policies."
  for f in migrations/*.sql; do
    echo
    echo "-- ============================================================================="
    echo "-- $(basename "$f")"
    echo "-- ============================================================================="
    cat "$f"
  done
} > ../schema.sql
echo "wrote schema.sql ($(wc -l < ../schema.sql) lines)"
