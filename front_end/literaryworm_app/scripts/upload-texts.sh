#!/usr/bin/env bash
# Uploads the public-domain books' texts (public/texts/<id>.json, built by scripts/build-texts.py)
# to the public `book-texts` Storage bucket (migration 6300), which the site serves at /texts/
# through vercel.json. Only three texts are kept in git (the tests and a copy without a backend use
# them); the rest live in the bucket.
#
# Run from front_end/literaryworm_app with the Supabase CLI logged in and linked to the project:
#   scripts/upload-texts.sh                 every file in public/texts
#   scripts/upload-texts.sh emma heidi      just these books
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -eq 0 ]; then
  set -- $(ls public/texts | sed 's/\.json$//')
fi

failed=0
for id in "$@"; do
  file="public/texts/$id.json"
  if [ ! -f "$file" ]; then
    echo "$id: no $file (run scripts/build-texts.py $id first)" >&2
    failed=$((failed + 1))
    continue
  fi
  # Storage won't overwrite a file, so a rebuilt text replaces the old one: remove it first
  # (nothing to remove the first time).
  supabase --workdir ../.. --experimental storage rm "ss:///book-texts/$id.json" --linked --yes > /dev/null 2>&1 || true
  # A day in caches: a rebuilt text keeps its name, so it shows within a day.
  if supabase --workdir ../.. --experimental storage cp "$file" "ss:///book-texts/$id.json" \
    --linked --content-type application/json --cache-control "public, max-age=86400" > /dev/null; then
    echo "$id uploaded"
  else
    echo "$id: upload failed" >&2
    failed=$((failed + 1))
  fi
done

if [ "$failed" -gt 0 ]; then
  echo "$failed failed" >&2
  exit 1
fi
