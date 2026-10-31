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
    "a-christmas-carol": {"ebook": 46, "heading": rf"STAVE {ROMAN}: .*"},
    "the-call-of-the-wild": {"ebook": 215, "heading": rf"Chapter {ROMAN}\. .*"},
    "the-picture-of-dorian-gray": {"ebook": 174, "heading": rf"(?:THE PREFACE|CHAPTER {ROMAN}\.)"},
    # The Introduction isn't in the recording; chapters start the text. "Home Again" is a few lines.
    "the-wonderful-wizard-of-oz": {"ebook": 55, "heading": rf"Chapter {ROMAN}", "min": 100},
    # More public-domain titles (October 2026): headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "emma": {"ebook": 158, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "sense-and-sensibility": {"ebook": 161, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "persuasion": {"ebook": 105, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "northanger-abbey": {"ebook": 121, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "end": r"^ A NOTE ON THE TEXT$(?![\s\S]*^ A NOTE ON THE TEXT$)"},  # the last one: the contents list names it too
    "wuthering-heights": {"ebook": 768, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "great-expectations": {"ebook": 1400, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-tale-of-two-cities": {"ebook": 98, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-adventures-of-tom-sawyer": {"ebook": 74, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "start": r"^CHAPTER I$"},  # past the list of illustrations
    # The last chapter is "CHAPTER THE LAST". The text starts at the "CHAPTER I." not followed by the
    # contents list's "CHAPTER THE LAST." (the chapter itself has no full stop).
    "adventures-of-huckleberry-finn": {"ebook": 76, "heading": rf"CHAPTER (?:{ROMAN}\.|THE LAST\.?)", "start": r"^CHAPTER I\.$(?![\s\S]*?^CHAPTER THE LAST\.$)"},
    "the-war-of-the-worlds": {"ebook": 36, "heading": rf" *{ROMAN}\.?"},
    "the-invisible-man": {"ebook": 5230, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-island-of-doctor-moreau": {"ebook": 159, "heading": rf" *{ROMAN}\.?", "proportional": True, "end": r"^NOTE\.$"},  # notes and printers' lines aren't read aloud
    "twenty-thousand-leagues-under-the-sea": {"ebook": 2488, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-hound-of-the-baskervilles": {"ebook": 2852, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "a-study-in-scarlet": {"ebook": 244, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-sign-of-the-four": {"ebook": 2097, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "dr-jekyll-and-mr-hyde": {"ebook": 43, "heading": None, "proportional": True, "start": r"^STORY OF THE DOOR$"},  # past the title page and contents
    "kidnapped": {"ebook": 421, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-jungle-book": {"ebook": 236, "heading": None, "proportional": True, "start": r"^Mowgli’s Brothers$"},  # past the title page and contents
    "heart-of-darkness": {"ebook": 219, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-scarlet-letter": {"ebook": 33, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-last-of-the-mohicans": {"ebook": 940, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "robinson-crusoe": {"ebook": 521, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "gullivers-travels": {"ebook": 829, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "end": r"^FOOTNOTES:$"},  # notes and printers' lines aren't read aloud
    "heidi": {"ebook": 1448, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-railway-children": {"ebook": 1874, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-little-princess": {"ebook": 146, "heading": r" *\d+\.?", "end": r"^End of Project Gutenberg"},  # notes and printers' lines aren't read aloud
    "five-children-and-it": {"ebook": 778, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "end": r"^\*Project Gutenberg Etext"},  # notes and printers' lines aren't read aloud
    "the-princess-and-the-goblin": {"ebook": 708, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "through-the-looking-glass": {"ebook": 12, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-prince-and-the-pauper": {"ebook": 1837, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "end": r"^FOOTNOTES AND TWAIN’S NOTES$"},  # notes and printers' lines aren't read aloud
    "silas-marner": {"ebook": 550, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "cranford": {"ebook": 394, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^ +PRINTED BY$"},  # notes and printers' lines aren't read aloud
    "the-turn-of-the-screw": {"ebook": 209, "heading": rf" *{ROMAN}\.?"},
    "the-age-of-innocence": {"ebook": 541, "heading": rf" *{ROMAN}\.?", "end": r"^A Note on the Text"},  # notes and printers' lines aren't read aloud
    "the-awakening": {"ebook": 160, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "ethan-frome": {"ebook": 4517, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-red-badge-of-courage": {"ebook": 463, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^\[Transcriber's Note"},  # notes and printers' lines aren't read aloud
    "the-man-who-was-thursday": {"ebook": 1695, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-phantom-of-the-opera": {"ebook": 175, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "end": r"^THE END$"},  # notes and printers' lines aren't read aloud
    "king-solomons-mines": {"ebook": 2166, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-prisoner-of-zenda": {"ebook": 95, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "a-room-with-a-view": {"ebook": 2641, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "autobiography-of-benjamin-franklin": {"ebook": 20203, "heading": rf" *{ROMAN}\.?", "proportional": True, "end": r"^APPENDIX$"},  # notes and printers' lines aren't read aloud
    "pinocchio": {"ebook": 500, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "rebecca-of-sunnybrook-farm": {"ebook": 498, "heading": rf" *{ROMAN}\.?"},
    "pollyanna": {"ebook": 1450, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "white-fang": {"ebook": 910, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-sea-wolf": {"ebook": 1074, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^ +PRINTED IN GREAT BRITAIN"},  # notes and printers' lines aren't read aloud
    "the-scarlet-pimpernel": {"ebook": 60, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    # 250 more public-domain titles (October 2026): headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "agnes-grey": {"ebook": 767, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "mansfield-park": {"ebook": 141, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "dombey-and-son": {"ebook": 821, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-old-curiosity-shop": {"ebook": 700, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-mystery-of-edwin-drood": {"ebook": 564, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-chimes": {"ebook": 653, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "north-and-south": {"ebook": 4276, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "wives-and-daughters": {"ebook": 4274, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "sylvias-lovers": {"ebook": 4537, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-mayor-of-casterbridge": {"ebook": 143, "heading": rf" *{ROMAN}\.?"},
    "jude-the-obscure": {"ebook": 153, "heading": rf" *{ROMAN}\.?"},
    "the-woodlanders": {"ebook": 482, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "daniel-deronda": {"ebook": 7469, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-warden": {"ebook": 619, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "barchester-towers": {"ebook": 3409, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "doctor-thorne": {"ebook": 3166, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "can-you-forgive-her": {"ebook": 19500, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-way-we-live-now": {"ebook": 5231, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "vanity-fair": {"ebook": 599, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "framley-parsonage": {"ebook": 2860, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "kenilworth": {"ebook": 1606, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^NOTES\.$(?![\s\S]*^NOTES\.$)"},  # the last one: the contents list names the notes too
    "the-first-men-in-the-moon": {"ebook": 1013, "heading": rf" *{ROMAN}\.?"},
    "the-wrong-box": {"ebook": 1585, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "kipps": {"ebook": 39162, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^THE END$"},  # the publisher's list isn't read aloud
    "the-valley-of-fear": {"ebook": 3776, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "michael-strogoff": {"ebook": 1842, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-poison-belt": {"ebook": 126, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-white-company": {"ebook": 903, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-connecticut-yankee-in-king-arthurs": {"ebook": 86, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tom-sawyer-abroad": {"ebook": 91, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "martin-eden": {"ebook": 1056, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "burning-daylight": {"ebook": 746, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-people-of-the-abyss": {"ebook": 1688, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-pathfinder": {"ebook": 1880, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tarzan-of-the-apes": {"ebook": 78, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-return-of-tarzan": {"ebook": 81, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-beasts-of-tarzan": {"ebook": 85, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-son-of-tarzan": {"ebook": 90, "heading": rf" *{ROMAN}\.?"},
    "the-land-that-time-forgot": {"ebook": 551, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "dorothy-and-the-wizard-in-oz": {"ebook": 22566, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-lost-princess-of-oz": {"ebook": 959, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-tin-woodman-of-oz": {"ebook": 960, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-scarecrow-of-oz": {"ebook": 957, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "rinkitink-in-oz": {"ebook": 958, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "anne-of-the-island": {"ebook": 51, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "anne-of-avonlea": {"ebook": 47, "heading": rf" *{ROMAN}\.?"},
    "glinda-of-oz": {"ebook": 961, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "annes-house-of-dreams": {"ebook": 544, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "rainbow-valley": {"ebook": 5343, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "little-lord-fauntleroy": {"ebook": 479, "heading": rf" *{ROMAN}\.?"},
    "the-lost-prince": {"ebook": 384, "heading": rf" *{ROMAN}\.?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-shuttle": {"ebook": 506, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "under-the-lilacs": {"ebook": 3795, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "jack-and-jill": {"ebook": 2786, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-story-of-the-amulet": {"ebook": 837, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-enchanted-castle": {"ebook": 34219, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-story-of-the-treasure-seekers": {"ebook": 770, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-magic-city": {"ebook": 20606, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "peter-pan-in-kensington-gardens": {"ebook": 26998, "heading": rf" *{ROMAN}\.?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "at-the-back-of-the-north-wind": {"ebook": 225, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-princess-and-curdie": {"ebook": 36612, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^THE END\.$"},  # the publisher's list isn't read aloud
    "tom-browns-school-days": {"ebook": 1480, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-phoenix-and-the-carpet": {"ebook": 836, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "pollyanna-grows-up": {"ebook": 6100, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "what-katy-did-at-school": {"ebook": 5141, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "what-katy-did": {"ebook": 8994, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-coral-island": {"ebook": 21721, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-children-of-the-new-forest": {"ebook": 6471, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "rupert-of-hentzau": {"ebook": 1145, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-elusive-pimpernel": {"ebook": 2785, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-black-tulip": {"ebook": 965, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "madame-bovary": {"ebook": 2413, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-idiot": {"ebook": 2638, "heading": rf" *{ROMAN}\.?"},
    "the-brothers-karamazov": {"ebook": 28054, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-vicar-of-wakefield": {"ebook": 2667, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-great-god-pan": {"ebook": 389, "heading": rf" *{ROMAN}\.?"},
    "the-lair-of-the-white-worm": {"ebook": 1188, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-jewel-of-seven-stars": {"ebook": 3781, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-red-house-mystery": {"ebook": 1872, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-lodger": {"ebook": 2014, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "captain-blood": {"ebook": 1965, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "scaramouche": {"ebook": 1947, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "riders-of-the-purple-sage": {"ebook": 1300, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "uncle-toms-cabin": {"ebook": 203, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-house-of-mirth": {"ebook": 284, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-custom-of-the-country": {"ebook": 11052, "heading": rf" *{ROMAN}\.?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "summer": {"ebook": 166, "heading": rf" *{ROMAN}\.?"},
    "alexanders-bridge": {"ebook": 94, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-country-of-the-pointed-firs": {"ebook": 367, "heading": rf" *{ROMAN}\. .*"},
    "night-and-day": {"ebook": 1245, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-voyage-out": {"ebook": 144, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "babbitt": {"ebook": 1156, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "howards-end": {"ebook": 2891, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "where-angels-fear-to-tread": {"ebook": 2948, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "a-voyage-to-arcturus": {"ebook": 1329, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "understood-betsy": {"ebook": 5347, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-damnation-of-theron-ware": {"ebook": 133, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "mcteague": {"ebook": 165, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-jungle": {"ebook": 140, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-europeans": {"ebook": 179, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-secret-sharer": {"ebook": 220, "heading": rf" *{ROMAN}\.?"},
    "typhoon": {"ebook": 1142, "heading": rf" *{ROMAN}\.?"},
    "three-men-on-the-bummel": {"ebook": 2183, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-inimitable-jeeves": {"ebook": 59254, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "zuleika-dobson": {"ebook": 1845, "heading": rf" *{ROMAN}\.?"},
    "the-scarlet-plague": {"ebook": 21970, "heading": rf" *{ROMAN}\.?"},
    "the-card": {"ebook": 12986, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-moon-pool": {"ebook": 765, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "gladiator": {"ebook": 42914, "heading": rf" *{ROMAN}\.?"},
    "the-skylark-of-space": {"ebook": 20869, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-autobiography-of-an-ex-colored-man": {"ebook": 11012, "heading": rf" *{ROMAN}\.?"},
    "the-house-behind-the-cedars": {"ebook": 472, "heading": rf" *{ROMAN}\.?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-book-of-tea": {"ebook": 769, "heading": rf" *{ROMAN}\. .*"},
    "the-burgess-animal-book-for-children": {"ebook": 2441, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-adventures-of-danny-meadow-mouse": {"ebook": 25529, "heading": rf" *{ROMAN}\.?"},
    "the-sea-fairies": {"ebook": 4358, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "wet-magic": {"ebook": 50361, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-mysterious-stranger": {"ebook": 50109, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^THE END$"},  # the publisher's list isn't read aloud
    "the-stolen-white-elephant": {"ebook": 3181, "heading": rf" *{ROMAN}\.?"},
    "greenmantle": {"ebook": 559, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-tragedy-of-the-korosko": {"ebook": 12555, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-mystery-of-cloomber": {"ebook": 7964, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-parasite": {"ebook": 355, "heading": rf" *{ROMAN}\.?"},
    "shirley": {"ebook": 30486, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True, "end": r"^ESTABLISHED 1798$"},  # notes, transcriber's notes and publishers' lists cut; the Nelson imprint isn't read aloud
    "ivanhoe": {"ebook": 82, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^NOTE TO CHAPTER I\.$"},  # Scott's notes aren't read aloud
    "a-journey-to-the-centre-of-the-earth": {"ebook": 18857, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-deerslayer": {"ebook": 3285, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-story-girl": {"ebook": 5342, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "kilmeny-of-the-orchard": {"ebook": 5341, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "jos-boys": {"ebook": 3499, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "little-men": {"ebook": 2788, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-wouldbegoods": {"ebook": 794, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "a-girl-of-the-limberlost": {"ebook": 125, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "freckles": {"ebook": 111, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "twenty-years-after": {"ebook": 1259, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-gambler": {"ebook": 2197, "heading": rf" *{ROMAN}\.?"},
    "the-circular-staircase": {"ebook": 434, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-hollow-needle": {"ebook": 4017, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-four-feathers": {"ebook": 18883, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "herland": {"ebook": 32, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "jacobs-room": {"ebook": 5670, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-longest-journey": {"ebook": 2604, "heading": rf" *{ROMAN}\.?"},
    "toby-tyler": {"ebook": 32393, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-rise-of-silas-lapham": {"ebook": 154, "heading": rf" *{ROMAN}\.?", "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "leave-it-to-psmith": {"ebook": 60067, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-damsel-in-distress": {"ebook": 2233, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "otto-of-the-silver-hand": {"ebook": 2865, "heading": rf" *{ROMAN}\. .*"},
    "little-dorrit": {"ebook": 963, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "bleak-house": {"ebook": 1023, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "our-mutual-friend": {"ebook": 883, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "lorna-doone": {"ebook": 840, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "david-copperfield": {"ebook": 766, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "nicholas-nickleby": {"ebook": 967, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-pickwick-papers": {"ebook": 580, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "start": r"^CHAPTER I\. THE PICKWICKIANS$"},  # past the detailed contents
    "barnaby-rudge": {"ebook": 917, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "middlemarch": {"ebook": 145, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "far-from-the-madding-crowd": {"ebook": 107, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "a-pair-of-blue-eyes": {"ebook": 224, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "white-jacket": {"ebook": 10712, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "lilith": {"ebook": 1640, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "incidents-in-the-life-of-a-slave-girl": {"ebook": 11030, "heading": rf" *{ROMAN}\. .*", "proportional": True, "start": r"^ +I\. Childhood$"},  # past the contents
    "uncle-silas": {"ebook": 14851, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "lord-jim": {"ebook": 5658, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "victory": {"ebook": 6378, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-wonderful-visit": {"ebook": 33913, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-return-of-the-native": {"ebook": 122, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-pioneers": {"ebook": 2275, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-last-days-of-pompeii": {"ebook": 1565, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "mary-barton": {"ebook": 2153, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-black-arrow": {"ebook": 848, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-innocents-abroad": {"ebook": 3176, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-blithedale-romance": {"ebook": 2081, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "a-princess-of-mars": {"ebook": 62, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-prairie": {"ebook": 6450, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-patchwork-girl-of-oz": {"ebook": 955, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-three-musketeers": {"ebook": 1257, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "candide": {"ebook": 19942, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-education-of-henry-adams": {"ebook": 2044, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "o-pioneers": {"ebook": 24, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "main-street": {"ebook": 543, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "news-from-nowhere": {"ebook": 3261, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-ambassadors": {"ebook": 432, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "iola-leroy": {"ebook": 12352, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "romola": {"ebook": 24020, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "no-name": {"ebook": 1438, "heading": rf"{ROMAN}\.\n[^\n]+", "proportional": True},
    "the-golden-road": {"ebook": 316, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-mystery-of-the-yellow-room": {"ebook": 1685, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-sea-hawk": {"ebook": 3294, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "erewhon": {"ebook": 1906, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-metal-monster": {"ebook": 3479, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-golden-fleece-and-the-heroes-who": {"ebook": 2395, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "roughing-it": {"ebook": 3177, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "start": r"^CHAPTER I\.$"},  # past the contents and list of illustrations
    "the-iron-heel": {"ebook": 1164, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-gods-of-mars": {"ebook": 64, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "rose-in-bloom": {"ebook": 2804, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "eight-cousins": {"ebook": 2726, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "phantastes": {"ebook": 325, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "sylvie-and-bruno": {"ebook": 620, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "allan-quatermain": {"ebook": 711, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "sir-nigel": {"ebook": 2845, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-adventures-of-reddy-fox": {"ebook": 1825, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-burgess-bird-book-for-children": {"ebook": 3074, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-house-of-the-seven-gables": {"ebook": 77, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "crime-and-punishment": {"ebook": 2554, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-leavenworth-case": {"ebook": 4047, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "three-men-in-a-boat": {"ebook": 308, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-spy": {"ebook": 9845, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-red-fairy-book": {"ebook": 540, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "life-on-the-mississippi": {"ebook": 245, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "typee": {"ebook": 1900, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "at-the-earths-core": {"ebook": 123, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "pellucidar": {"ebook": 605, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-man-in-the-iron-mask": {"ebook": 2759, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "joseph-andrews": {"ebook": 9611, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "up-from-slavery": {"ebook": 2376, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "carmilla": {"ebook": 10007, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-napoleon-of-notting-hill": {"ebook": 20058, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-cloister-and-the-hearth": {"ebook": 1366, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-hampdenshire-wonder": {"ebook": 53028, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "men-of-iron": {"ebook": 1557, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "huntingtower": {"ebook": 3782, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-riddle-of-the-sands": {"ebook": 2360, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-professor": {"ebook": 1028, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-narrative-of-arthur-gordon-pym-of": {"ebook": 2149, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-mill-on-the-floss": {"ebook": 6688, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-master-of-ballantrae": {"ebook": 30939, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-memoirs-of-sherlock-holmes": {"ebook": 834, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-diary-of-a-nobody": {"ebook": 1026, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "rilla-of-ingleside": {"ebook": 3796, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "captains-courageous": {"ebook": 2186, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "martin-chuzzlewit": {"ebook": 968, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "adam-bede": {"ebook": 507, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "english-fairy-tales": {"ebook": 7439, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-moonstone": {"ebook": 155, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-talisman": {"ebook": 1377, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-tragedy-of-puddnhead-wilson": {"ebook": 102, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-book-of-dragons": {"ebook": 23661, "heading": rf" *{ROMAN}\. .*", "proportional": True, "start": r"^I\. The Book of Beasts$", "trim": True},  # past the contents and list of illustrations; notes, transcriber's notes and publishers' lists cut
    "trents-last-case": {"ebook": 21854, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "micah-clarke": {"ebook": 9504, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "catriona": {"ebook": 589, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "what-katy-did-next": {"ebook": 8995, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "celtic-fairy-tales": {"ebook": 7885, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "the-good-soldier": {"ebook": 2775, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-castle-of-otranto": {"ebook": 696, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "nostromo": {"ebook": 2021, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # notes, transcriber's notes and publishers' lists cut
    "something-new": {"ebook": 2042, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    # 250 more public-domain titles (October 2026), three replacements: headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "the-old-wives-tale": {"ebook": 5247, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-souls-of-black-folk": {"ebook": 408, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-secret-agent": {"ebook": 974, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    # 250 more public-domain titles (October 2026), one more replacement: headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "women-in-love": {"ebook": 4240, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
}

# Shorter than this after a heading means a table-of-contents line, not a chapter.
MIN_UNIT = 400

# What ends the book itself in many editions: Gutenberg's closing line, notes, indexes, printers'
# lines and publishers' lists. A book with "trim" is cut at the first of these in its last quarter
# (opt-in, so a text built before never changes and saved highlights stay put).
BACK_MATTER = re.compile(
    # Headings can sit inside =signs=, _italics_ or a drawn box (+—+ |).
    r"^[\s=_*+|—-]*(?:End of (?:the )?Project Gutenberg|\[?Transcriber[’']s Notes?|Footnotes?[.:]?[\s=_]*$"
    r"|NOTES?[.:]?[\s=_]*$|INDEX[.:]?[\s=_]*$|PRINTED (?:BY|IN)\b|THE NELSON CLASSICS|Uniform with this|ADVERTISEMENTS?[.:]?[\s=_]*$|BY THE SAME AUTHOR)",
    re.M | re.I,
)


def trim_back_matter(body: str) -> str:
    m = next((m for m in BACK_MATTER.finditer(body) if m.start() >= len(body) * 0.75), None)
    return body[: m.start()] if m else body


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
    if conf.get("trim"):
        body = trim_back_matter(body)
    # No heading: the whole text, split by the tracks' lengths (an edition without chapter headings).
    pieces = units(body, conf["heading"], conf.get("split"), conf.get("min", MIN_UNIT)) if conf.get("heading") else [clean(body)]
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
