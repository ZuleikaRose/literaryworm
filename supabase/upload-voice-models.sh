#!/usr/bin/env bash
# Uploads the on-device voices' Piper models (src/lib/onDeviceVoice.ts) to a project's public
# `voice-models` bucket (migration 6888), fetching them from rhasspy/piper-voices on Hugging Face
# (MIT; each dataset's licence is in ON_DEVICE_VOICES' credits). Each model goes up in 40 MB parts
# (<file>.0, .1…; MODEL_PART_BYTES), because Storage refuses uploads over 50 MB; the browser joins
# them. Re-running replaces the files.
#
#   supabase/upload-voice-models.sh xjvisabdztxvnsglysdh             # the dev branch
#   supabase/upload-voice-models.sh ldzdmrdvmacpudsbngvd             # production
#   supabase/upload-voice-models.sh ldzdmrdvmacpudsbngvd --dry-run   # fetch and split, upload nothing
set -euo pipefail
ref="${1:?usage: $0 <project ref> [--dry-run]}"
dry="${2:-}"
upload() { # <file> <content type> <cache control>
  if [ "$dry" = "--dry-run" ]; then echo "would upload $(basename "$1") ($(stat -c %s "$1") bytes, $2) to ss:///voice-models/ on $ref"; return; fi
  supabase --experimental storage cp --remote="$ref" --yes --content-type "$2" --cache-control "$3" "$1" "ss:///voice-models/$(basename "$1")" > /dev/null
}
base=https://huggingface.co/rhasspy/piper-voices/resolve/main
# Every model ON_DEVICE_VOICES uses, by its path in rhasspy/piper-voices.
models=(
  en/en_GB/alba/medium/en_GB-alba-medium
  en/en_GB/cori/medium/en_GB-cori-medium
  en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium
  en/en_GB/southern_english_female/low/en_GB-southern_english_female-low
  en/en_GB/vctk/medium/en_GB-vctk-medium
  en/en_US/arctic/medium/en_US-arctic-medium
  en/en_US/bryce/medium/en_US-bryce-medium
  en/en_US/hifi_tts_92/medium/en_US-hifi_tts_92-medium
  en/en_US/joe/medium/en_US-joe-medium
  en/en_US/john/medium/en_US-john-medium
  en/en_US/kathleen/medium/en_US-kathleen-medium
  en/en_US/kristin/medium/en_US-kristin-medium
  en/en_US/ljspeech/medium/en_US-ljspeech-medium
  en/en_US/mike/medium/en_US-mike-medium
  en/en_US/norman/medium/en_US-norman-medium
  en/en_US/sam/medium/en_US-sam-medium
)
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
for model in "${models[@]}"; do
  name="$(basename "$model")"
  curl -fsSL -o "$work/$name.onnx" "$base/$model.onnx"
  curl -fsSL -o "$work/$name.onnx.json" "$base/$model.onnx.json"
  split -b 40M -d -a 1 "$work/$name.onnx" "$work/$name.onnx."
  rm "$work/$name.onnx"
  for part in "$work/$name.onnx."[0-9]; do
    upload "$part" application/octet-stream "public, max-age=31536000, immutable"
  done
  upload "$work/$name.onnx.json" application/json "public, max-age=86400"
  rm -f "$work/$name.onnx".*
done
if [ "$dry" = "--dry-run" ]; then echo "dry run: nothing uploaded"; else echo "uploaded ${#models[@]} models"; fi
