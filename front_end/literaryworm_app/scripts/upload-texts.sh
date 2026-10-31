#!/usr/bin/env bash
# Uploads the public-domain books' texts (public/texts/<id>.json, built by scripts/build-texts.py)
# to the public `book-texts` Storage bucket (migration 6300), which the site serves at /texts/
# through vercel.json. Only three texts are kept in git (the tests and a copy without a backend use
# them); the rest live in the bucket.
#
# Run from front_end/literaryworm_app with the Supabase CLI logged in and linked to the project:
#   scripts/upload-texts.sh                 every file in public/texts
#   scripts/upload-texts.sh emma heidi      just these books
#
# The CLI signs in on every call and Supabase throttles that, so the files go in two calls in all:
# one removing the old copies (Storage won't overwrite a file), one uploading the new ones. The
# upload copies a folder named book-texts to the root, which puts its files in that bucket.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -eq 0 ]; then
  set -- $(ls public/texts | sed 's/\.json$//')
fi

work=$(mktemp -d)
trap 'rm -r "$work"' EXIT
mkdir "$work/book-texts"
paths=()
for id in "$@"; do
  file="public/texts/$id.json"
  if [ ! -f "$file" ]; then
    echo "$id: no $file (run scripts/build-texts.py $id first)" >&2
    exit 1
  fi
  cp "$file" "$work/book-texts/"
  paths+=("ss:///book-texts/$id.json")
done

# Nothing to remove the first time: a missing file isn't an error worth stopping for.
supabase --workdir ../.. --experimental storage rm "${paths[@]}" --linked --yes > /dev/null 2>&1 || true
# A day in caches: a rebuilt text keeps its name, so it shows within a day.
supabase --workdir ../.. --experimental storage cp -r "$work/book-texts" ss:/// --linked \
  --content-type application/json --cache-control "public, max-age=86400" --jobs 4 > /dev/null
echo "uploaded $# texts"
