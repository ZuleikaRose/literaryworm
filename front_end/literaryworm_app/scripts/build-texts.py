#!/usr/bin/env python3
"""Writes public/texts/<book id>.json: the full text of each public-domain title, one entry per
chapter of its LibriVox recording (src/data/librivox.ts), for the player's device voices.

The texts are Project Gutenberg's plain-text editions (public domain in the US). Each book's
chapter headings are matched with its own pattern, then grouped to line up with the
recording's tracks, so a voice reads the same chapter the track list shows.
Run from front_end/literaryworm_app after scripts/build-librivox.py:
    python3 scripts/build-texts.py
"""

import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "texts"
GUTENBERG = "https://www.gutenberg.org/cache/epub/{0}/pg{0}.txt"

ROMAN = r"[IVXLC]+"
WORDS = r"(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?"

# Catalog id -> Gutenberg ebook, the heading pattern (whole line), and how many of those units
# each LibriVox track holds ("ranges" reads them from the track titles; "proportional" splits
# the whole text by the tracks' lengths, for editions whose chapters differ from the recording).
BOOKS = {
    "pride-and-prejudice": {"ebook": 1342, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?\]?"},
    "frankenstein": {
        "ebook": 41445,
        "heading": rf"(?:PREFACE\.|LETTER {ROMAN}\.|CHAPTER {ROMAN}\.)",
        # LibriVox reads Walton's closing letters as their own track.
        "split": r"WALTON, _in continuation_\.",
    },
    "sherlock-holmes": {"ebook": 1661, "heading": rf"{ROMAN}\. [A-Z][A-Z’'\- ]+"},
    "alice-in-wonderland": {"ebook": 11, "heading": rf"CHAPTER {ROMAN}\."},
    "the-secret-garden": {"ebook": 113, "heading": rf"CHAPTER {ROMAN}\.?"},
    "the-wind-in-the-willows": {"ebook": 289, "heading": rf"{ROMAN}\.\n[^\n]+"},
    "treasure-island": {"ebook": 120, "heading": rf"{ROMAN}\n[^\n]+", "groups": [2] * 17},
    "little-women": {"ebook": 514, "heading": rf"CHAPTER {WORDS}"},
    "the-time-machine": {"ebook": 35, "heading": rf" *(?:{ROMAN}\.|Epilogue)", "proportional": True},
    "moby-dick": {"ebook": 2701, "heading": r" *(?:ETYMOLOGY\.|CHAPTER \d+\. .*|Epilogue)", "ranges": True, "min": 100, "start": r"^  ETYMOLOGY\.$"},  # some chapters are a few lines
    "dracula": {"ebook": 345, "heading": rf"CHAPTER {ROMAN}(?:\. .*)?", "start": r"^CHAPTER I$"},
    "jane-eyre": {"ebook": 1260, "heading": rf"CHAPTER {ROMAN}(?:—.*)?"},
    "peter-pan": {"ebook": 16, "heading": rf"Chapter {ROMAN}\.?"},
    "anne-of-green-gables": {"ebook": 45, "heading": rf"CHAPTER {ROMAN}\. .*"},
    "the-great-gatsby": {"ebook": 64317, "heading": rf" +{ROMAN}"},
    "the-metamorphosis": {"ebook": 5200, "heading": rf"{ROMAN}"},
    "the-odyssey": {"ebook": 1727, "heading": rf"BOOK {ROMAN}", "end": r"^FOOTNOTES:"},
}

# Shorter than this after a heading means a table-of-contents line, not a chapter.
MIN_UNIT = 400


def recordings() -> dict:
    src = (ROOT / "src" / "data" / "librivox.ts").read_text()
    return json.loads(src[src.index("= {") + 2 : src.rindex("}") + 1])


def fetch(ebook: int) -> str:
    req = urllib.request.Request(GUTENBERG.format(ebook), headers={"User-Agent": "LiteraryWorm text builder"})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            text = res.read().decode("utf-8-sig").replace("\r", "")
    except (urllib.error.URLError, TimeoutError, UnicodeDecodeError) as err:
        raise SystemExit(f"Gutenberg ebook {ebook}: couldn't download ({err})") from err
    start, end = text.find("*** START OF"), text.find("*** END OF")
    if start < 0 or end < 0:
        raise SystemExit(f"Gutenberg ebook {ebook}: no START/END markers, so the book text can't be found")
    return text[text.index("\n", start) : end]


def cut_at(body: str, pattern: str, ebook: int) -> int:
    """Where a start or end marker is; a clear error if this edition no longer has it."""
    m = re.search(pattern, body, re.M)
    if not m:
        raise SystemExit(f"Gutenberg ebook {ebook}: marker {pattern!r} not found; the edition may have changed")
    return m.start()


def clean(text: str) -> str:
    """Plain paragraphs: no illustrations or footnote marks, italics unmarked, lines rejoined."""
    text = re.sub(r"\[Illustration[^\]]*\]", "", text, flags=re.S)
    text = re.sub(r"\[\d+\]", "", text)
    text = text.replace("_", "").replace(".]", ".")
    # Gutenberg types a dash as two hyphens.
    text = re.sub(r"\s*-{2,}\s*", "\u2014", text)
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    # Lines of only stars, dots or brackets are dividers and the ends of illustration captions.
    return "\n\n".join(p for p in paragraphs if p and not re.fullmatch(r"[*\s.\[\]]+", p))


def units(body: str, heading: str, split: str | None, min_unit: int = MIN_UNIT) -> list[str]:
    starts = [m.start() for m in re.finditer(rf"^{heading}$", body, re.M)]
    pieces = [body[a:b] for a, b in zip(starts, starts[1:] + [len(body)])]
    # The app shows its own chapter heading, so the book's ("CHAPTER I.") is left out.
    pieces = [p[re.match(rf"{heading}\n?", p).end():] for p in pieces]
    pieces = [p for p in pieces if len(clean(p)) >= min_unit]
    if split:
        last = pieces[-1]
        m = re.search(split, last)
        if not m:
            raise SystemExit(f"split marker not found: {split}")
        pieces[-1:] = [last[: m.start()], last[m.start() :]]
    return [clean(p) for p in pieces]


def by_ranges(pieces: list[str], titles: list[str]) -> list[int]:
    """Moby-Dick: 'Chapter 001-002', 'Chapter 003', 'Chapter 135 and Epilogue', 'Chapter 000: ...'."""
    groups = []
    for title in titles:
        nums = [int(n) for n in re.findall(r"\d+", title)]
        count = 1 if nums[0] == 0 else (nums[-1] - nums[0] + 1 if len(nums) > 1 else 1)
        if "Epilogue" in title:
            count += 1
        groups.append(count)
    return groups


def proportional(text: str, seconds: list[int]) -> list[str]:
    paragraphs = text.split("\n\n")
    total = sum(len(p) for p in paragraphs)
    # Where each track ends, as a running total, so rounding never piles up at the end.
    ends, run = [], 0
    for s in seconds:
        run += s
        ends.append(total * run / sum(seconds))
    out, current, done, i = [], [], 0, 0
    for p in paragraphs:
        # Break before this paragraph if it would carry the track further past its end than stopping short.
        if i < len(ends) - 1 and current and done + len(p) / 2 > ends[i]:
            out.append("\n\n".join(current))
            current, i = [], i + 1
        current.append(p)
        done += len(p)
    out.append("\n\n".join(current))
    return out


def build(book_id: str, conf: dict, recording: dict) -> list[str]:
    tracks = recording["tracks"]
    body = fetch(conf["ebook"])
    if conf.get("start"):
        body = body[cut_at(body, conf["start"], conf["ebook"]) :]  # past a contents list that names every chapter
    if conf.get("end"):
        body = body[: cut_at(body, conf["end"], conf["ebook"])]  # notes and indexes aren't read aloud
    pieces = units(body, conf["heading"], conf.get("split"), conf.get("min", MIN_UNIT))
    if conf.get("proportional"):
        return proportional("\n\n".join(pieces), [t["seconds"] for t in tracks])
    groups = by_ranges(pieces, [t["title"] for t in tracks]) if conf.get("ranges") else conf.get("groups", [1] * len(tracks))
    if sum(groups) != len(pieces) or len(groups) != len(tracks):
        heads = " | ".join(p.split("\n\n")[0][:30] for p in pieces)
        raise SystemExit(f"{book_id}: {len(pieces)} text units, tracks need {sum(groups)} in {len(groups)} groups: {heads}")
    chapters, at = [], 0
    for g in groups:
        chapters.append("\n\n".join(pieces[at : at + g]))
        at += g
    return chapters


def main() -> None:
    recs = recordings()
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    failed = []
    for book_id, conf in BOOKS.items():
        if only and book_id not in only:
            continue
        try:
            chapters = build(book_id, conf, recs[book_id])
        except SystemExit as err:
            failed.append(book_id)
            print(f"{book_id:24} FAILED  {err}")
            continue
        # Each chapter's characters per second of narration: far off the book's usual rate means
        # the text and the recording don't line up.
        rates = [len(c) / t["seconds"] for c, t in zip(chapters, recs[book_id]["tracks"])]
        mean = sum(rates) / len(rates)
        odd = [i + 1 for i, r in enumerate(rates) if not 0.6 * mean <= r <= 1.5 * mean]
        (OUT / f"{book_id}.json").write_text(json.dumps({"source": f"Project Gutenberg ebook #{conf['ebook']}", "chapters": chapters}, ensure_ascii=False))
        print(f"{book_id:24} {len(chapters):3} chapters  {mean:5.1f} chars/s" + (f"  check chapters {odd}" if odd else ""))
    if failed:
        raise SystemExit(f"{len(failed)} books failed")


if __name__ == "__main__":
    main()
