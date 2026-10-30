#!/bin/bash
# Runs security_test.sql on a Supabase branch through the Management API (no Docker or psql
# needed), and leaves nothing behind: the checks run inside a transaction that's rolled back.
#
#   supabase/tests/run-on-branch.sh <branch project ref>
#
# Make the branch first (dashboard, or `supabase branches create`), let it apply the migrations,
# and delete it afterwards: branches are billed by the hour. The Supabase CLI must be logged in.
#
# A branch differs from production in ways the migrations don't cover, so before the checks this:
#   1. gives service_role its table rights (production's projects have them by default);
#   2. copies production's EXECUTE rights on public functions (read from production, read-only),
#      for functions both have; newer ones keep what their migrations grant;
#   3. makes the indexes the CREATE INDEX CONCURRENTLY migrations add (applied by hand on
#      production, so a branch never gets them), without CONCURRENTLY.
# Steps 1 to 3 change the branch for good; they're safe to repeat.
set -euo pipefail

BRANCH=${1:?usage: run-on-branch.sh <branch project ref>}
PRODUCTION=${PRODUCTION_REF:-ldzdmrdvmacpudsbngvd}
[ "$BRANCH" != "$PRODUCTION" ] || { echo "That's the production project. Give a branch's ref."; exit 1; }
cd "$(dirname "$0")/../.."
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

query() { supabase db query --linked --project-ref "$1" -f "$2"; }

echo "1. service_role table rights"
cat > "$WORK/grants.sql" <<'SQL'
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
SQL
query "$BRANCH" "$WORK/grants.sql" >/dev/null

echo "2. production's EXECUTE rights on public functions"
cat > "$WORK/acl.sql" <<'SQL'
-- With an empty search path, function names and types come out schema-qualified.
set local search_path = '';
select string_agg(
  format('revoke execute on function %s from public, anon, authenticated, service_role;', f.sig)
  || coalesce(format(' grant execute on function %s to %s;', f.sig, f.roles), ''),
  E'\n' order by f.sig) as sql
from (
  select p.oid::regprocedure::text as sig,
         (select string_agg(distinct r.rolname, ', ')
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          join pg_roles r on r.oid = a.grantee
          where a.privilege_type = 'EXECUTE' and r.rolname in ('anon', 'authenticated', 'service_role')) as roles
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
) f;
SQL
supabase db query --linked --project-ref "$PRODUCTION" --output-format json -f "$WORK/acl.sql" > "$WORK/acl.json"
# Keep only the functions the branch has (a newer migration may have renamed or dropped one).
jq -r '(if type == "array" then .[0].sql else (.rows // .result // .)[0].sql end) // empty' "$WORK/acl.json" > "$WORK/acl_all.sql"
[ -s "$WORK/acl_all.sql" ] || { echo "Couldn't read production's function rights:"; head -c 400 "$WORK/acl.json"; exit 1; }
{
  echo "do \$\$ declare s text; begin"
  while IFS= read -r line; do
    sig=$(sed -E 's/^revoke execute on function (.+) from public, anon.*/\1/' <<<"$line")
    sql=$(sed "s/'/''/g" <<<"$line")
    echo "  if to_regprocedure('$(sed "s/'/''/g" <<<"$sig")') is not null then execute '$sql'; end if;"
  done < "$WORK/acl_all.sql"
  echo "end \$\$;"
} > "$WORK/acl_branch.sql"
query "$BRANCH" "$WORK/acl_branch.sql" >/dev/null

echo "3. the CONCURRENTLY indexes"
# The one-statement index migrations: a line starting "create index concurrently", and nothing
# else but comments and blank lines.
for f in $(grep -li "^create index concurrently" supabase/migrations/*.sql); do
  grep -viqE "^(--|create index concurrently|[[:space:]]*$)" "$f" || cat "$f"
done | sed -E 's/[Cc][Oo][Nn][Cc][Uu][Rr][Rr][Ee][Nn][Tt][Ll][Yy] //' > "$WORK/indexes.sql"
query "$BRANCH" "$WORK/indexes.sql" >/dev/null

echo "4. the security checks (rolled back afterwards)"
{ echo "begin;"; cat supabase/tests/security_test.sql; echo; echo "rollback;"; } > "$WORK/checks.sql"
if out=$(query "$BRANCH" "$WORK/checks.sql" 2>&1) && ! grep -q "FAIL:" <<<"$out"; then
  echo "ALL SECURITY CHECKS PASSED on $BRANCH"
else
  grep -o "FAIL:[^\"]*" <<<"$out" | head -5 || true
  echo "$out" | tail -20
  echo "Security checks failed on $BRANCH."
  exit 1
fi
