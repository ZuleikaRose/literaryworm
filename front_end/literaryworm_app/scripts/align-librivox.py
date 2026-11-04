#!/usr/bin/env python3
"""Line a LibriVox recording up with the book's own text, for the read-along transcript.

For each chapter (one recording track) it downloads the MP3 from the Internet Archive, converts it
to 16 kHz mono WAV with ffmpeg, has whisper.cpp's whisper-cli write one word per segment with its
time, matches those words to the chapter's text (public/texts/<id>.json) and writes anchors
[word index in the chapter text, seconds into the track] to public/alignments/<id>.json, about every
ten matched words. Only runs of at least MIN_RUN words that agree are used, so a misheard word
can't place a sentence. The words shown are always the book's; the recogniser only times them.

Words are the chapter text split on whitespace exactly as JavaScript's \\s does (JS_WHITESPACE), so
the indexes agree with src/lib/alignment.ts.

    python3 scripts/align-librivox.py alice-in-wonderland --whisper /path/whisper-cli --model /path/ggml-base.en.bin
    python3 scripts/align-librivox.py alice-in-wonderland --from-json /path/work   # re-match saved whisper output

Needs ffmpeg and whisper.cpp (https://github.com/ggml-org/whisper.cpp), neither of which is part of
the app. Audio and whisper output go to --work (a temporary folder by default); only the alignment
file is written into the app.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
JS_WHITESPACE = re.compile("[\t\n\v\f\r    -     　﻿]+")
MIN_RUN = 3
STRIDE = 10
USER_AGENT = "LiteraryWorm/1.0 (https://www.literaryworm.com; hello@literaryworm.com)"


def text_words(text: str) -> list[str]:
    """The chapter's words, split as JavaScript's text.split(/\\s+/) with empties dropped."""
    return [w for w in JS_WHITESPACE.split(text) if w]


def norm(word: str) -> str:
    """A word for matching: lower case, accents and punctuation gone ("Alice's" -> "alices")."""
    plain = unicodedata.normalize("NFKD", word.lower())
    return "".join(ch for ch in plain if ch.isalnum())


def anchors_for(text: list[str], heard: list[tuple[str, float]]) -> tuple[list[list[float]], float]:
    """Anchors [text word index, seconds] from runs where the text and what was heard agree, and the share matched."""
    a = [norm(w) for w in text]
    b = [norm(w) for w, _ in heard]
    matcher = difflib.SequenceMatcher(None, a, b, autojunk=False)
    anchors: list[list[float]] = []
    matched = 0
    for block in matcher.get_matching_blocks():
        if block.size < MIN_RUN:
            continue
        matched += block.size
        for k in range(0, block.size, STRIDE):
            i, t = block.a + k, heard[block.b + k][1]
            if a[i] and (not anchors or (i > anchors[-1][0] and t >= anchors[-1][1])):
                anchors.append([i, round(t, 2)])
    return anchors, (matched / len(a) if a else 0.0)


def recording_urls(book_id: str) -> list[str]:
    """The book's LibriVox track URLs, in order, from src/data/librivox.ts."""
    source = (APP / "src/data/librivox.ts").read_text(encoding="utf-8")
    start = source.find(f'"{book_id}": {{')
    if start < 0:
        raise SystemExit(f"{book_id} has no recording in src/data/librivox.ts")
    end = source.find('\n  "', start + 5)
    block = source[start : end if end > 0 else None]
    return re.findall(r'url: "([^"]+)"', block) or re.findall(r'"url": "([^"]+)"', block)


def heard_words(whisper_json: Path) -> list[tuple[str, float]]:
    """whisper-cli -ml 1 -oj output: one word per segment, with its start in milliseconds."""
    data = json.loads(whisper_json.read_text(encoding="utf-8"))
    words: list[tuple[str, float]] = []
    for seg in data.get("transcription", []):
        word = seg.get("text", "").strip()
        start = seg.get("offsets", {}).get("from")
        if word and isinstance(start, (int, float)):
            words.append((word, start / 1000))
    return words


def transcribe(url: str, work: Path, index: int, whisper: str, model: str, threads: int) -> Path:
    mp3, wav, out = work / f"{index:03d}.mp3", work / f"{index:03d}.wav", work / f"{index:03d}"
    if not mp3.exists():
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response:
            mp3.write_bytes(response.read())
    if not wav.exists():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(mp3), "-ar", "16000", "-ac", "1", str(wav)], check=True)
    result = out.with_suffix(".json")
    if not result.exists():
        subprocess.run([whisper, "-m", model, "-f", str(wav), "-ml", "1", "-oj", "-of", str(out), "-t", str(threads), "-np"], check=True)
    wav.unlink(missing_ok=True)  # the WAV is large; the MP3 and the words are kept for re-runs
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("book_id")
    parser.add_argument("--whisper", help="path to whisper.cpp's whisper-cli")
    parser.add_argument("--model", help="path to a whisper.cpp model, such as ggml-base.en.bin")
    parser.add_argument("--work", help="folder for audio and whisper output (default: a temporary folder)")
    parser.add_argument("--from-json", help="re-match the whisper output already in this folder")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()

    chapters = json.loads((APP / f"public/texts/{args.book_id}.json").read_text(encoding="utf-8"))["chapters"]
    urls = recording_urls(args.book_id)
    if len(urls) != len(chapters):
        raise SystemExit(f"{args.book_id}: {len(chapters)} text chapters but {len(urls)} recording tracks")
    if not args.from_json and not (args.whisper and args.model):
        raise SystemExit("Give --whisper and --model to transcribe, or --from-json to re-match saved output.")
    work = Path(args.from_json or args.work or tempfile.mkdtemp(prefix=f"align-{args.book_id}-"))
    work.mkdir(parents=True, exist_ok=True)

    result: list[list[list[float]]] = []
    for i, (url, text) in enumerate(zip(urls, chapters)):
        whisper_json = work / f"{i:03d}.json" if args.from_json else transcribe(url, work, i, args.whisper, args.model, args.threads)
        anchors, share = anchors_for(text_words(text), heard_words(whisper_json))
        # A chapter that barely matched (a different edition, say) gets no anchors: the app falls back.
        if share < 0.5:
            print(f"  chapter {i + 1}: only {share:.0%} matched, left out", file=sys.stderr)
            anchors = []
        print(f"  chapter {i + 1}: {share:.0%} of words matched, {len(anchors)} anchors")
        result.append(anchors)

    out = APP / f"public/alignments/{args.book_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"source": "LibriVox recording lined up with the Project Gutenberg text by scripts/align-librivox.py", "chapters": result}
    out.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(APP)} ({out.stat().st_size // 1024} KB, work files in {work})")


if __name__ == "__main__":
    main()
