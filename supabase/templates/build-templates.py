#!/usr/bin/env python3
"""Builds supabase/templates/{confirmation,recovery,email_change}.html from src/<name>.html and
src/i18n.json: each [[English text]] becomes a Go template choice on the member's language
(Supabase Auth's .Data.ui_language, the user metadata the app keeps equal to the email language),
English when it's missing or unknown. The button names inside <em> are taken from the app's own
dictionaries (front_end/literaryworm_app/src/data/i18n), so the email names them as the app shows
them. Run after changing a source or a translation, then put the templates on each project
(the dashboard, or supabase/set-email-change-templates.sh for the email-change ones).

    python3 supabase/templates/build-templates.py
"""
import json
import re
from pathlib import Path

here = Path(__file__).resolve().parent
app_i18n = here.parent.parent / "front_end" / "literaryworm_app" / "src" / "data" / "i18n"
texts = json.loads((here / "src" / "i18n.json").read_text())
LANGS = ["es", "fr", "de", "pt", "it", "nl", "ja", "zh", "ko", "hi", "ar", "pl", "ru", "tr", "sv", "uk", "tl", "bg", "ro", "el"]
BUTTONS = ["Send the email again", "Forgot password?"]

app = {lang: json.loads((app_i18n / f"{lang}.json").read_text()) for lang in LANGS}

def markers(s):
    return sorted(re.findall(r"\{\{[^}]*\}\}|</?(?:strong|em)>", s))

problems = []
for key, by_lang in texts.items():
    for lang in LANGS:
        value = by_lang.get(lang)
        if not value:
            problems.append(f"{lang}: missing {key!r}")
            continue
        # The app's own button name inside <em>.
        for button in BUTTONS:
            if f"<em>{button}</em>" in key and app[lang].get(button):
                value = re.sub(r"<em>.*?</em>", f"<em>{app[lang][button]}</em>", value)
        by_lang[lang] = value
        if markers(value) != markers(key):
            problems.append(f"{lang}: {key[:50]!r} has {markers(value)} not {markers(key)}")
        if "{{ if" in value or "{{ end" in value:
            problems.append(f"{lang}: template logic in {key[:40]!r}")
if problems:
    raise SystemExit("\n".join(problems))

def choice(key):
    if key == "lang":
        return "{{ $l }}"
    if key == "dir":
        return '{{ if eq $l "ar" }} dir="rtl"{{ end }}'
    out = []
    for i, lang in enumerate(LANGS):
        out.append(("{{ if" if i == 0 else "{{ else if") + f' eq $l "{lang}" }}}}' + texts[key][lang])
    out.append("{{ else }}" + key + "{{ end }}")
    return "".join(out)

# Always a string, whatever the metadata holds; English when it's absent.
PRELUDE = '{{- $l := printf "%v" (or .Data.ui_language "en") -}}\n'
for name in ["confirmation.html", "recovery.html", "email_change.html"]:
    source = (here / "src" / name).read_text()
    unknown = [k for k in re.findall(r"\[\[(.+?)\]\]", source) if k not in texts and k not in ("lang", "dir")]
    if unknown:
        raise SystemExit(f"{name}: no translations for {unknown}")
    built = PRELUDE + re.sub(r"\[\[(.+?)\]\]", lambda m: choice(m.group(1)), source)
    (here / name).write_text(built)
    print(f"{name}: {len(built)} characters")
