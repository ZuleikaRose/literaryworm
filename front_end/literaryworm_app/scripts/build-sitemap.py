#!/usr/bin/env python3
"""Writes public/sitemap.xml: the pages anyone can open without logging in.

The home page, Plans, What's new, Search and Sign up; the footer pages (src/data/legalPages.json);
every catalog book page (src/data/books.ts) and series page (src/data/series.ts). Members-only
pages are left out (robots.txt disallows them). Run it after adding titles, series or footer pages:

    python3 scripts/build-sitemap.py
"""
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape

APP = Path(__file__).resolve().parent.parent
SITE = "https://www.literaryworm.com"
TODAY = date.today().isoformat()


def ids(path: Path, pattern: str) -> list[str]:
    found = re.findall(pattern, path.read_text(encoding="utf-8"), re.M)
    return list(dict.fromkeys(found))  # keep order, drop repeats


def main() -> None:
    books = ids(APP / "src/data/books.ts", r'^    id: "([^"]+)",$')
    series = ids(APP / "src/data/series.ts", r'name: "([^"]+)"')
    legal = [page["slug"] for page in json.loads((APP / "src/data/legalPages.json").read_text(encoding="utf-8"))]
    if len(books) < 100 or not legal:
        raise SystemExit(f"Found only {len(books)} books and {len(legal)} footer pages: has the data's shape changed?")

    urls: list[tuple[str, str | None]] = [("/", TODAY), ("/plans", TODAY), ("/whats-new", TODAY), ("/search", None), ("/signup", None)]
    urls += [(f"/legal/{slug}", None) for slug in legal]
    urls += [(f"/books/{quote(book)}", None) for book in books]
    urls += [(f"/series/{quote(name, safe='')}", None) for name in series]

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, modified in urls:
        when = f"<lastmod>{modified}</lastmod>" if modified else ""
        lines.append(f"  <url><loc>{escape(SITE + path)}</loc>{when}</url>")
    lines.append("</urlset>")
    (APP / "public/sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"public/sitemap.xml: {len(urls)} pages ({len(books)} books, {len(series)} series, {len(legal)} footer pages)")


if __name__ == "__main__":
    main()
