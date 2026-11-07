#!/usr/bin/env bash
# Lines up the next read-along titles in one go: runs scripts/align-librivox.py for each book that
# has no public/alignments/<id>.json yet, one after another, keeping going past a failure, and
# keeps each book's whisper output under --work so a book can be re-matched without hearing it
# again (align-librivox.py <id> --from-json <work>/<id>). Needs ffmpeg and whisper.cpp, neither part
# of the app. Long: every chapter of every recording is heard once (hours on a CPU).
#
#   scripts/align-batch.sh --whisper /path/whisper-cli --model /path/ggml-base.en.bin [--work DIR] [ids…]
#
# With no ids it does NEXT_BOOKS below. Afterwards, for each book that came out well (most
# chapters 85% matched or more), add its id to ALIGNED_BOOKS in src/lib/alignment.ts and name it
# where the read-along books are named (CLAUDE.md lists them).
set -euo pipefail
cd "$(dirname "$0")/.."

NEXT_BOOKS=(
  treasure-island
  peter-pan
  the-time-machine
  the-war-of-the-worlds
  the-secret-garden
  the-jungle-book
  heart-of-darkness
  the-picture-of-dorian-gray
)

whisper="" model="" work="${TMPDIR:-/tmp}/literaryworm-align" ids=()
while [ $# -gt 0 ]; do
  case "$1" in
    --whisper) whisper="$2"; shift 2 ;;
    --model) model="$2"; shift 2 ;;
    --work) work="$2"; shift 2 ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) ids+=("$1"); shift ;;
  esac
done
if [ -z "$whisper" ] || [ -z "$model" ]; then
  echo "usage: $0 --whisper /path/whisper-cli --model /path/ggml-base.en.bin [--work DIR] [ids…]" >&2
  exit 2
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg is needed" >&2; exit 2; }
[ ${#ids[@]} -gt 0 ] || ids=("${NEXT_BOOKS[@]}")

done_ids=() failed=()
for id in "${ids[@]}"; do
  if [ -f "public/alignments/$id.json" ]; then
    echo "== $id: already aligned, skipped"
    continue
  fi
  if [ ! -f "public/texts/$id.json" ]; then
    echo "== $id: no public/texts/$id.json (run scripts/build-texts.py $id first)" >&2
    failed+=("$id")
    continue
  fi
  echo "== $id"
  mkdir -p "$work/$id"
  if python3 scripts/align-librivox.py "$id" --whisper "$whisper" --model "$model" --work "$work/$id"; then
    done_ids+=("$id")
  else
    failed+=("$id")
  fi
done

echo
echo "Aligned: ${done_ids[*]:-none}"
echo "Failed: ${failed[*]:-none}"
