#!/usr/bin/env python3
"""Writes src/data/librivox.ts: the LibriVox recording for each public-domain catalog title.

LibriVox recordings are in the public domain. Each entry lists the recording's sections
(chapters) with their length and MP3 on the Internet Archive, which the player streams.
Run from front_end/literaryworm_app:  python3 scripts/build-librivox.py
"""

import json
import pathlib
import urllib.error
import urllib.request

# Catalog id -> LibriVox project id. One reader where a complete solo recording exists.
PROJECTS = {
    "pride-and-prejudice": 4023,  # Elizabeth Klett
    "frankenstein": 2030,  # Cori Samuel (1818 text)
    "sherlock-holmes": 314,  # LibriVox volunteers
    "alice-in-wonderland": 4139,  # Kara Shallenberg
    "the-secret-garden": 56,  # Kara Shallenberg
    "the-wind-in-the-willows": 94,  # LibriVox volunteers
    "treasure-island": 1557,  # Adrian Praetzellis
    "little-women": 7143,  # Abigail Rasmussen
    "the-time-machine": 817,  # LibriVox volunteers
    "moby-dick": 753,  # Stewart Wills
    "dracula": 10747,  # Kara Shallenberg
    "jane-eyre": 2192,  # Elizabeth Klett
    "peter-pan": 11993,  # Patrick Saville
    "anne-of-green-gables": 1168,  # Karen Savage
    "the-great-gatsby": 16113,  # Kara Shallenberg
    "the-metamorphosis": 527,  # David Barnes
    "the-odyssey": 65,  # LibriVox volunteers (Samuel Butler's translation)
    "a-christmas-carol": 9239,  # Cori Samuel
    "the-call-of-the-wild": 9909,  # Phil Chenevert
    "the-picture-of-dorian-gray": 6124,  # Bob Neufeld (1891 text)
    "the-wonderful-wizard-of-oz": 5827,  # Phil Chenevert
    # More public-domain titles (October 2026)
    "emma": 6866,  # solo
    "sense-and-sensibility": 4358,  # solo
    "persuasion": 2977,  # solo
    "northanger-abbey": 10326,  # solo
    "wuthering-heights": 2994,  # solo
    "great-expectations": 9945,  # solo
    "a-tale-of-two-cities": 15669,  # solo
    "the-adventures-of-tom-sawyer": 448,  # solo
    "adventures-of-huckleberry-finn": 9807,  # solo
    "the-war-of-the-worlds": 16093,  # solo
    "the-invisible-man": 16039,  # solo
    "the-island-of-doctor-moreau": 17125,  # solo
    "twenty-thousand-leagues-under-the-sea": 8216,  # solo
    "the-hound-of-the-baskervilles": 6936,  # solo
    "a-study-in-scarlet": 9379,  # solo
    "the-sign-of-the-four": 9425,  # solo
    "dr-jekyll-and-mr-hyde": 13584,  # solo
    "kidnapped": 2317,  # solo
    "the-jungle-book": 6712,  # solo
    "heart-of-darkness": 17219,  # solo
    "the-scarlet-letter": 9288,  # solo
    "the-last-of-the-mohicans": 1379,  # solo
    "robinson-crusoe": 4284,  # solo
    "gullivers-travels": 21437,  # solo
    "heidi": 491,  # solo
    "the-railway-children": 12627,  # solo
    "a-little-princess": 9592,  # solo
    "five-children-and-it": 12347,  # solo
    "the-princess-and-the-goblin": 3323,  # solo
    "through-the-looking-glass": 15261,  # solo
    "the-prince-and-the-pauper": 10678,  # solo
    "silas-marner": 6314,  # solo
    "cranford": 1937,  # solo
    "the-turn-of-the-screw": 14780,  # solo
    "the-age-of-innocence": 4612,  # solo
    "the-awakening": 3902,  # solo
    "ethan-frome": 5885,  # solo
    "the-red-badge-of-courage": 19068,  # solo
    "the-man-who-was-thursday": 17742,  # solo
    "the-phantom-of-the-opera": 4487,  # solo
    "king-solomons-mines": 544,  # solo
    "the-prisoner-of-zenda": 523,  # solo
    "a-room-with-a-view": 5307,  # solo
    "autobiography-of-benjamin-franklin": 1143,  # solo
    "pinocchio": 6787,  # solo
    "rebecca-of-sunnybrook-farm": 1158,  # LibriVox volunteers
    "pollyanna": 11704,  # solo
    "white-fang": 4677,  # solo
    "the-sea-wolf": 9796,  # solo
    "the-scarlet-pimpernel": 22355,  # solo
}

API = "https://librivox.org/api/feed/audiobooks/?id={}&format=json&extended=1"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "librivox.ts"


def fetch(project_id: int) -> dict:
    # LibriVox refuses Python's default User-Agent.
    req = urllib.request.Request(API.format(project_id), headers={"User-Agent": "LiteraryWorm catalog builder"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.load(res)["books"][0]
    except (urllib.error.URLError, TimeoutError) as err:
        raise SystemExit(f"LibriVox project {project_id}: couldn't download ({err})") from err
    except (ValueError, KeyError, IndexError) as err:
        raise SystemExit(f"LibriVox project {project_id}: unexpected answer ({err})") from err


def narrators(sections: list) -> str:
    names = []
    for s in sections:
        for r in s.get("readers", []):
            name = r["display_name"].split(" (")[0]
            if name not in names:
                names.append(name)
    return names[0] if len(names) == 1 else "LibriVox volunteers"


def entry(book_id: str, project_id: int) -> dict:
    b = fetch(project_id)
    sections = sorted(b["sections"], key=lambda s: int(s["section_number"]))
    tracks = []
    for s in sections:
        url = s["listen_url"].replace("http://", "https://").replace("https://www.archive.org", "https://archive.org")
        tracks.append({"title": s["title"].strip(), "url": url, "seconds": int(s["playtime"])})
    if not tracks or any(t["seconds"] <= 0 or not t["url"].endswith(".mp3") for t in tracks):
        raise SystemExit(f"{book_id}: incomplete recording {project_id}")
    return {
        "bookId": book_id,
        "narrator": narrators(sections),
        "page": b["url_librivox"].replace("http://", "https://"),
        "tracks": tracks,
    }


def main() -> None:
    entries = [entry(book_id, pid) for book_id, pid in PROJECTS.items()]
    body = json.dumps({e["bookId"]: {k: v for k, v in e.items() if k != "bookId"} for e in entries}, indent=2, ensure_ascii=False)
    OUT.write_text(
        "// Generated by scripts/build-librivox.py; don't edit by hand.\n"
        "// LibriVox recordings are in the public domain; the MP3s are served by the Internet Archive.\n\n"
        'import type { Recording } from "../types";\n\n'
        f"export const recordings: Record<string, Recording> = {body};\n"
    )
    print(f"Wrote {OUT} ({len(entries)} recordings, {sum(len(e['tracks']) for e in entries)} tracks)")


if __name__ == "__main__":
    main()
