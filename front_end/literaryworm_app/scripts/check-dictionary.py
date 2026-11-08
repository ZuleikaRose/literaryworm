#!/usr/bin/env python3
"""Checks one interface dictionary (src/data/i18n/<code>.json) against French's keys, which hold
every key the app uses: the same keys, no empty values, the same {placeholders} in each value as in
its key, keys sorted, and two-space JSON with a final newline (as the other dictionaries are).

    python3 scripts/check-dictionary.py ja
"""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "src" / "data" / "i18n"
code = sys.argv[1]
reference = json.loads((root / "fr.json").read_text())
path = root / f"{code}.json"
raw = path.read_text()
data = json.loads(raw)

placeholders = lambda s: sorted(re.findall(r"\{(\w+)\}", s))
problems = []
missing = [k for k in reference if k not in data]
extra = [k for k in data if k not in reference]
if missing:
    problems.append(f"{len(missing)} keys missing, e.g. {missing[:3]}")
if extra:
    problems.append(f"{len(extra)} keys not in the app, e.g. {extra[:3]}")
for k, v in data.items():
    if not isinstance(v, str) or not v.strip():
        problems.append(f"empty value for {k!r}")
    elif placeholders(k) != placeholders(v):
        problems.append(f"placeholders differ for {k!r}: {placeholders(v)}")
if list(data) != sorted(data):
    problems.append("keys aren't sorted")
if raw != json.dumps(data, ensure_ascii=False, indent=2) + "\n":
    problems.append("not formatted as json.dumps(..., ensure_ascii=False, indent=2) plus a final newline")

if problems:
    print(f"{code}: {len(problems)} problems")
    for p in problems[:40]:
        print(" -", p)
    sys.exit(1)
print(f"{code}: OK, {len(data)} entries")
