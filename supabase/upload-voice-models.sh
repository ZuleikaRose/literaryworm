#!/usr/bin/env bash
# Uploads the on-device voices' Piper models (src/lib/onDeviceVoice.ts) to a project's public
# `voice-models` bucket (migration 6888), fetching them from rhasspy/piper-voices on Hugging Face
# (MIT; the datasets are public domain). Each model goes up in 40 MB parts (<file>.0, .1…;
# MODEL_PART_BYTES), because Storage refuses uploads over 50 MB; the browser joins them.
# Re-running replaces the files.
#
#   supabase/upload-voice-models.sh xjvisabdztxvnsglysdh   # the dev branch
#   supabase/upload-voice-models.sh ldzdmrdvmacpudsbngvd   # production
set -euo pipefail
ref="${1:?usage: $0 <project ref>}"
base=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
for voice in ljspeech norman; do
  name="en_US-$voice-medium"
  curl -fsSL -o "$work/$name.onnx" "$base/$voice/medium/$name.onnx"
  curl -fsSL -o "$work/$name.onnx.json" "$base/$voice/medium/$name.onnx.json"
  split -b 40M -d -a 1 "$work/$name.onnx" "$work/$name.onnx."
  rm "$work/$name.onnx"
  for part in "$work/$name.onnx."[0-9]; do
    supabase --experimental storage cp --remote="$ref" --yes --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable" "$part" "ss:///voice-models/$(basename "$part")" > /dev/null
  done
  supabase --experimental storage cp --remote="$ref" --yes --content-type application/json --cache-control "public, max-age=86400" "$work/$name.onnx.json" "ss:///voice-models/$name.onnx.json" > /dev/null
done
echo "uploaded: $(ls "$work" | tr '\n' ' ')"
