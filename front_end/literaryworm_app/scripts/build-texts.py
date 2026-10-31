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
    # A third 250 public-domain titles (October 2026): headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "the-small-house-at-allington": {"ebook": 4599, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-last-chronicle-of-barset": {"ebook": 3045, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "orley-farm": {"ebook": 23000, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-three-clerks": {"ebook": 7481, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-dukes-children": {"ebook": 3622, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "phineas-finn": {"ebook": 18000, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "cousin-henry": {"ebook": 24103, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "phineas-redux": {"ebook": 18640, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-eustace-diamonds": {"ebook": 7381, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-prime-minister": {"ebook": 2158, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "miss-mackenzie": {"ebook": 24000, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "he-knew-he-was-right": {"ebook": 5140, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-law-and-the-lady": {"ebook": 1622, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "quentin-durward": {"ebook": 7853, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "scenes-of-clerical-life": {"ebook": 17780, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "ruth": {"ebook": 4275, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-virginians": {"ebook": 8123, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-odd-women": {"ebook": 4313, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "uncle-bernac": {"ebook": 10581, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "love-and-mr-lewisham": {"ebook": 11640, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-fur-country": {"ebook": 8991, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "godfrey-morgan": {"ebook": 23489, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-blockade-runners": {"ebook": 8992, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "eric-brighteyes": {"ebook": 2721, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "jungle-tales-of-tarzan": {"ebook": 106, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tarzan-and-the-jewels-of-opar": {"ebook": 92, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tarzan-and-the-ant-men": {"ebook": 61837, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "tarzan-the-terrible": {"ebook": 2020, "heading": r" *\d+\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-people-that-time-forgot": {"ebook": 552, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-monster-men": {"ebook": 96, "heading": r" *\d+\.?"},
    "the-cave-girl": {"ebook": 69191, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2, "end": r"^_There.s More to Follow!_$"},  # the publisher's list isn't read aloud
    "sky-island": {"ebook": 4356, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "hospital-sketches": {"ebook": 3837, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2, "end": r"^New Publication\.$"},  # closing lines, notes, glossary and publishers' lists cut; the publisher's list isn't read aloud
    "just-david": {"ebook": 440, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "michael-ohalloran": {"ebook": 9489, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-birds-christmas-carol": {"ebook": 721, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "moths-of-the-limberlost": {"ebook": 4907, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "when-patty-went-to-college": {"ebook": 21639, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "clover": {"ebook": 15798, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "in-the-high-valley": {"ebook": 28724, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "nights-with-uncle-remus": {"ebook": 24430, "heading": rf" *{ROMAN}\.?", "end": r"^ +\+-+\+\n +\|Transcriber's Note:"},  # footnotes follow many stories, so no trim; the transcriber's note isn't read aloud
    "the-bobbsey-twins-in-the-country": {"ebook": 714, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "tom-swift-and-his-electric-runabout": {"ebook": 950, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-adventures-of-jerry-muskrat": {"ebook": 5110, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-adventures-of-prickly-porky": {"ebook": 15521, "heading": rf" *{ROMAN}\.?"},
    "mother-west-winds-children": {"ebook": 20877, "heading": rf" *{ROMAN}\.?"},
    "bowser-the-hound": {"ebook": 15168, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "whitefoot-the-wood-mouse": {"ebook": 4698, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-girl-in-the-golden-atom": {"ebook": 21094, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "wieland": {"ebook": 792, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-return": {"ebook": 3075, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-crystal-stopper": {"ebook": 1563, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-eye-of-osiris": {"ebook": 24201, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-man-who-knew-too-much": {"ebook": 1720, "heading": rf" *{ROMAN}\. .*", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-maltese-falcon": {"ebook": 77600, "heading": r" *\d+\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "bardelys-the-magnificent": {"ebook": 2389, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "fortunes-fool": {"ebook": 65939, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "king-of-the-khyber-rifles": {"ebook": 6066, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-border-legion": {"ebook": 4552, "heading": r" *\d+\.?"},
    "the-untamed": {"ebook": 10886, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-spoilers": {"ebook": 5076, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-game": {"ebook": 1160, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-daughter-of-the-snows": {"ebook": 14654, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-golden-bowl": {"ebook": 4264, "heading": rf" *{ROMAN}\.?"},
    "the-aspern-papers": {"ebook": 211, "heading": rf" *{ROMAN}\.?"},
    "the-glimpses-of-the-moon": {"ebook": 1263, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-fruit-of-the-tree": {"ebook": 19191, "heading": rf" *{ROMAN}\.?", "trim": 2, "end": r"^\+-+\+\n\|\s+\|\n\|\s+BOOKS BY EDITH WHARTON"},  # closing lines, notes, glossary and publishers' lists cut; the publisher's list isn't read aloud
    "the-professors-house": {"ebook": 65465, "heading": rf" *{ROMAN}\.?"},
    "one-of-ours": {"ebook": 2369, "heading": rf" *{ROMAN}\.?"},
    "jennie-gerhardt": {"ebook": 28988, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "free-air": {"ebook": 26732, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-sun-also-rises": {"ebook": 67138, "heading": r" *\d+\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "poor-white": {"ebook": 7414, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "crome-yellow": {"ebook": 1999, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-country-house": {"ebook": 2772, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "riceyman-steps": {"ebook": 58666, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "buried-alive": {"ebook": 10911, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "liza-of-lambeth": {"ebook": 16517, "heading": r" *\d+\.?"},
    "the-patrician": {"ebook": 2774, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-club-of-queer-trades": {"ebook": 1696, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-unbearable-bassington": {"ebook": 555, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-coming-of-bill": {"ebook": 6880, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "jill-the-reckless": {"ebook": 20533, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "uneasy-money": {"ebook": 6684, "heading": r" *\d+\.?"},
    "the-prince-and-betty": {"ebook": 6955, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "love-among-the-chickens": {"ebook": 3829, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "indiscretions-of-archie": {"ebook": 3756, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-house-of-the-dead": {"ebook": 37536, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^THE END$"},  # footnotes follow many chapters, so no trim; ends at THE END
    "chicot-the-jester": {"ebook": 7426, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "moni-the-goat-boy": {"ebook": 9383, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "growth-of-the-soil": {"ebook": 10984, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "evangeline": {"ebook": 2039, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "rachel-ray": {"ebook": 34000, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-american-senator": {"ebook": 5118, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "my-lady-ludlow": {"ebook": 2524, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-newcomes": {"ebook": 7467, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "diana-of-the-crossways": {"ebook": 4470, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-ordeal-of-richard-feverel": {"ebook": 4412, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "off-on-a-comet": {"ebook": 1353, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-underground-city": {"ebook": 1355, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "eight-hundred-leagues-on-the-amazon": {"ebook": 3091, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tarzan-the-untamed": {"ebook": 1401, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-outlaw-of-torn": {"ebook": 369, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "moods": {"ebook": 28203, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2, "end": r"^FAITH GARTNEY.S GIRLHOOD,"},  # closing lines, notes, glossary and publishers' lists cut; the publisher's list isn't read aloud
    "a-fair-barbarian": {"ebook": 9487, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-head-of-the-house-of-coombe": {"ebook": 6491, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "just-patty": {"ebook": 21048, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "davy-and-the-goblin": {"ebook": 25031, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-story-of-a-bad-boy": {"ebook": 1948, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "the-bobbsey-twins-at-the-seashore": {"ebook": 6950, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-bobbsey-twins-at-school": {"ebook": 737, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "tom-swift-and-his-airship": {"ebook": 3005, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "tom-swift-and-his-submarine-boat": {"ebook": 949, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "tom-swift-and-his-wireless-message": {"ebook": 4227, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tom-swift-among-the-diamond-makers": {"ebook": 1282, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^THE END$"},  # the publisher's list isn't read aloud
    "tom-swift-and-his-sky-racer": {"ebook": 951, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-adventures-of-unc-billy-possum": {"ebook": 14732, "heading": rf" *{ROMAN}\.?"},
    "the-adventures-of-grandfather-frog": {"ebook": 14375, "heading": rf" *{ROMAN}\.?"},
    "edisons-conquest-of-mars": {"ebook": 19141, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-mystery-of-the-sea": {"ebook": 42455, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2, "end": r"^_BOOKS BY THE SAME AUTHOR_$"},  # the publisher's list isn't read aloud
    "the-tavern-knight": {"ebook": 3030, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-league-of-the-scarlet-pimpernel": {"ebook": 5805, "heading": rf" *{ROMAN}\.?"},
    "the-reef": {"ebook": 283, "heading": rf" *{ROMAN}\.?"},
    "so-big": {"ebook": 61686, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "show-boat": {"ebook": 67123, "heading": rf" *{ROMAN}\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-ball-and-the-cross": {"ebook": 5265, "heading": rf" *{ROMAN}\. .*"},
    "the-clicking-of-cuthbert": {"ebook": 7028, "heading": r" *\d+\.?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "ten-years-later": {"ebook": 2681, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "louise-de-la-valliere": {"ebook": 2710, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "tartarin-of-tarascon": {"ebook": 1862, "heading": rf" *{ROMAN}\. .*"},
    "the-problems-of-philosophy": {"ebook": 5827, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-history-of-pendennis": {"ebook": 7265, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "a-laodicean": {"ebook": 3258, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "two-on-a-tower": {"ebook": 3146, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "old-mortality": {"ebook": 6941, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-firm-of-girdlestone": {"ebook": 13152, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "montezumas-daughter": {"ebook": 1848, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "a-hazard-of-new-fortunes": {"ebook": 4600, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-titan": {"ebook": 3629, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "germinal": {"ebook": 56528, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-egoist": {"ebook": 1684, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-tragic-muse": {"ebook": 20085, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "sketches-by-boz": {"ebook": 882, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-haunted-hotel": {"ebook": 170, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-bride-of-lammermoor": {"ebook": 471, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-mystery-of-a-hansom-cab": {"ebook": 4223, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "what-maisie-knew": {"ebook": 7118, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "death-comes-for-the-archbishop": {"ebook": 69730, "heading": r" *\d+\.?", "proportional": True},
    "the-financier": {"ebook": 1840, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "smoke": {"ebook": 40813, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-red-and-the-black": {"ebook": 44747, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-new-magdalen": {"ebook": 1623, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-man-who-laughs": {"ebook": 12587, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-chessmen-of-mars": {"ebook": 1153, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-blind-spot": {"ebook": 4920, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-lone-star-ranger": {"ebook": 1027, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-valley-of-the-moon": {"ebook": 1449, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "piccadilly-jim": {"ebook": 2005, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-song-of-hiawatha": {"ebook": 19, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-book-of-snobs": {"ebook": 2686, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "ayesha": {"ebook": 5228, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-worlds-desire": {"ebook": 2763, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "tom-swift-in-the-caves-of-ice": {"ebook": 3734, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "under-drakes-flag": {"ebook": 19206, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "in-freedoms-cause": {"ebook": 4792, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-pirate": {"ebook": 42389, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-fortunes-of-nigel": {"ebook": 5950, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-people-of-the-mist": {"ebook": 6769, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "robin": {"ebook": 18945, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-little-nugget": {"ebook": 6683, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-rose-and-the-ring": {"ebook": 897, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "with-lee-in-virginia": {"ebook": 2805, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "tanar-of-pellucidar": {"ebook": 70199, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "813": {"ebook": 34758, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-land-of-mist": {"ebook": 68903, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-stark-munro-letters": {"ebook": 290, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-cruise-of-the-snark": {"ebook": 2512, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "allans-wife": {"ebook": 2727, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-moon-maid": {"ebook": 59752, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "wessex-tales": {"ebook": 3056, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "wildfire": {"ebook": 2066, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-heritage-of-the-desert": {"ebook": 1262, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "at-the-foot-of-the-rainbow": {"ebook": 532, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "american-notes": {"ebook": 675, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "hide-and-seek": {"ebook": 7893, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "beyond-good-and-evil": {"ebook": 4363, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-red-thumb-mark": {"ebook": 11128, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-hill-of-dreams": {"ebook": 13969, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "desert-gold": {"ebook": 502, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-scalp-hunters": {"ebook": 23268, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "rudin": {"ebook": 6900, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-fair-maid-of-perth": {"ebook": 7987, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "mary-marie": {"ebook": 11143, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "desperate-remedies": {"ebook": 3044, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "out-of-times-abyss": {"ebook": 553, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "new-grub-street": {"ebook": 1709, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "basil": {"ebook": 4605, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "east-lynne": {"ebook": 3322, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-duel": {"ebook": 13505, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "lifes-little-ironies": {"ebook": 3047, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-possessed": {"ebook": 8117, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "bel-ami": {"ebook": 3733, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-rainbow-trail": {"ebook": 5067, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-harvester": {"ebook": 349, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-communist-manifesto": {"ebook": 61, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-virginian": {"ebook": 1298, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-adventures-of-odysseus-and-the-tale": {"ebook": 16867, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-little-lame-prince": {"ebook": 496, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-varieties-of-religious-experience": {"ebook": 621, "heading": r" *\d+\.?", "proportional": True, "start": r"^PREFACE\.$"},  # past the contents and title page
    "armadale": {"ebook": 1895, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "a-vindication-of-the-rights-of-woman": {"ebook": 3420, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "hardings-luck": {"ebook": 28725, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "kim": {"ebook": 2226, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-woman-in-white": {"ebook": 583, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "redgauntlet": {"ebook": 2516, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "island-nights-entertainments": {"ebook": 329, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-coming-race": {"ebook": 1951, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-light-that-failed": {"ebook": 2876, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "eminent-victorians": {"ebook": 2447, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "chronicles-of-avonlea": {"ebook": 1354, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "the-teeth-of-the-tiger": {"ebook": 13058, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "new-arabian-nights": {"ebook": 839, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "laddie": {"ebook": 286, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-swiss-family-robinson": {"ebook": 41659, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "some-do-not": {"ebook": 64248, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "hypatia": {"ebook": 6308, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-dawn-of-a-to-morrow": {"ebook": 460, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "villette": {"ebook": 9182, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-rainbow": {"ebook": 28948, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "after-dark": {"ebook": 1626, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "dead-souls": {"ebook": 1081, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "aarons-rod": {"ebook": 4520, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "travels-with-a-donkey-in-the-cevennes": {"ebook": 21686, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "further-chronicles-of-avonlea": {"ebook": 5340, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-night-land": {"ebook": 10662, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "roderick-hudson": {"ebook": 176, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "guy-mannering": {"ebook": 5999, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "i-will-repay": {"ebook": 5090, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "five-weeks-in-a-balloon": {"ebook": 3526, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-garden-party": {"ebook": 1429, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "a-portrait-of-the-artist-as-a-young-man": {"ebook": 4217, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-portrait-of-a-lady": {"ebook": 2833, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "sons-and-lovers": {"ebook": 47634, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    "queen-victoria": {"ebook": 1265, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-voyage-of-the-beagle": {"ebook": 944, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-prelude": {"ebook": 12383, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # closing lines, notes, glossary and publishers' lists cut
    # A third 250 public-domain titles (October 2026), three replacements: headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "the-beautiful-and-damned": {"ebook": 9830, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "john-silence": {"ebook": 10624, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-war-in-the-air": {"ebook": 780, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    # A third 250 public-domain titles (October 2026), one more replacement: headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "the-song-of-the-lark": {"ebook": 44, "heading": rf" *{ROMAN}\.?", "proportional": True},
    # 300 more public-domain titles (October 2026): headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "the-cat-of-bubastes": {"ebook": 29756, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "by-pike-and-dyke": {"ebook": 6952, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "with-clive-in-india": {"ebook": 18833, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-master-of-the-world": {"ebook": 3809, "heading": rf" *{ROMAN}\.?"},
    "the-last-trail": {"ebook": 9932, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-day-of-the-beast": {"ebook": 15673, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # the publisher's list isn't read aloud
    "the-mysterious-rider": {"ebook": 13937, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "buster-bears-twins": {"ebook": 59282, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-vanished-messenger": {"ebook": 1699, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-double-traitor": {"ebook": 10534, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-great-impersonation": {"ebook": 5815, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-flaming-forest": {"ebook": 4702, "heading": rf" *{ROMAN}\.?", "trim": True},  # closing lines and notes cut
    "the-golden-snare": {"ebook": 4515, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "nomads-of-the-north": {"ebook": 4704, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-danger-trail": {"ebook": 10696, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "isobel": {"ebook": 6715, "heading": rf" *{ROMAN}\.?"},
    "the-white-feather": {"ebook": 6927, "heading": rf" *{ROMAN}\.?"},
    "the-adventures-of-sally": {"ebook": 7464, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-swoop": {"ebook": 7050, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "the-gem-collector": {"ebook": 8931, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-innocents": {"ebook": 25430, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "madame-de-treymes": {"ebook": 4518, "heading": rf" *{ROMAN}\.?"},
    "jurgen": {"ebook": 8771, "heading": r" *\d+\.?"},
    "the-magnificent-ambersons": {"ebook": 8867, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "alice-adams": {"ebook": 980, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "penrod-and-sam": {"ebook": 1158, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "seventeen": {"ebook": 1611, "heading": rf" *{ROMAN}\.?"},
    "monsieur-beaucaire": {"ebook": 1983, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "gentle-julia": {"ebook": 18259, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "trim": 2},  # the publisher's list isn't read aloud
    "the-conquest-of-canaan": {"ebook": 483, "heading": rf" *{ROMAN}\.?", "trim": True},  # closing lines and notes cut
    "nature": {"ebook": 29433, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-oregon-trail": {"ebook": 1015, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-metropolis": {"ebook": 5421, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-mutiny-of-the-elsinore": {"ebook": 2415, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tales-of-the-fish-patrol": {"ebook": 28693, "heading": rf" *{ROMAN}\.?"},
    "the-gold-hunters": {"ebook": 11668, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-honor-of-the-big-snows": {"ebook": 5895, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-riddle-of-the-frozen-flame": {"ebook": 17180, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-man-who-knew": {"ebook": 24933, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-clue-of-the-twisted-candle": {"ebook": 2688, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-great-shadow": {"ebook": 11656, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^THE CRIME OF THE BRIGADIER\.$"},  # the extra story isn't in the recording
    "jack-o-judgment": {"ebook": 24767, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-doings-of-raffles-haw": {"ebook": 8394, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-eight-strokes-of-the-clock": {"ebook": 7896, "heading": rf" *{ROMAN}\.?", "trim": True},  # closing lines and notes cut
    "the-woman-of-mystery": {"ebook": 34931, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-middle-temple-murder": {"ebook": 10373, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?"},
    "scarhaven-keep": {"ebook": 9807, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-charing-cross-mystery": {"ebook": 59893, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-talleyrand-maxim": {"ebook": 9834, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-chestermarke-instinct": {"ebook": 27965, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-further-adventures-of-jimmie-dale": {"ebook": 9440, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tremendous-trifles": {"ebook": 8092, "heading": rf" *{ROMAN}\. .*"},
    "the-trees-of-pride": {"ebook": 1721, "heading": rf" *{ROMAN}\. .*"},
    "eugenics-and-other-evils": {"ebook": 25308, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^INDEX$"},  # the index isn't read aloud
    "a-short-history-of-england": {"ebook": 20897, "heading": rf" *{ROMAN}\.?"},
    "for-the-temple": {"ebook": 21614, "heading": None, "start": r"^Preface\.\s+In all history", "proportional": True},  # past the contents; chapter 10 is two tracks
    "bonnie-prince-charlie": {"ebook": 7006, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-vicomte-de-bragelonne": {"ebook": 2609, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-corsican-brothers": {"ebook": 41881, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^Transcriber.s Note"},  # the transcriber's note isn't read aloud
    "the-adventures-of-poor-mrs-quack": {"ebook": 5846, "heading": rf" *{ROMAN}\.?"},
    "mother-west-wind-why-stories": {"ebook": 14958, "heading": rf" *{ROMAN}\.?"},
    "mother-west-wind-how-stories": {"ebook": 21286, "heading": rf" *{ROMAN}\.?"},
    "the-hunted-woman": {"ebook": 11328, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-pothunters": {"ebook": 6984, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-turmoil": {"ebook": 1098, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-childs-history-of-england": {"ebook": 699, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-history-of-the-peloponnesian-war": {"ebook": 7142, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-courage-of-marge-odoone": {"ebook": 17745, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": 2},  # the publisher's list isn't read aloud
    "the-wolf-hunters": {"ebook": 12170, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-alaskan": {"ebook": 11867, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "through-the-magic-door": {"ebook": 5317, "heading": rf" *{ROMAN}\.?"},
    "the-paradise-mystery": {"ebook": 5308, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "dead-mens-money": {"ebook": 12239, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "peter-and-wendy": {"ebook": 26654, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "tommy-and-grizel": {"ebook": 11901, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "my-lady-nicotine": {"ebook": 18934, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "sentimental-tommy": {"ebook": 14961, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-little-white-bird": {"ebook": 1376, "heading": rf" *{ROMAN}\. .*"},
    "the-story-of-the-greeks": {"ebook": 23495, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-queens-necklace": {"ebook": 20122, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-nest-of-the-sparrowhawk": {"ebook": 12175, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "whats-wrong-with-the-world": {"ebook": 1717, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-spirit-of-the-border": {"ebook": 1239, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-man-with-the-black-feather": {"ebook": 46343, "heading": None, "proportional": True, "start": r"^HISTORICAL PREFACE$", "end": r"^A new novel by the author of"},  # from the preface, which the recording reads; the publisher's list isn't read aloud
    "the-daffodil-mystery": {"ebook": 20912, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "wulf-the-saxon": {"ebook": 8745, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "a-knight-of-the-white-cross": {"ebook": 4932, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-valley-of-silent-men": {"ebook": 4707, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "green-mansions": {"ebook": 942, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-lions-skin": {"ebook": 2702, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-young-carthaginian": {"ebook": 5128, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "windy-mcphersons-son": {"ebook": 7443, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "democracy-and-education": {"ebook": 852, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-dragon-and-the-raven": {"ebook": 3674, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "beric-the-briton": {"ebook": 7037, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-young-buglers": {"ebook": 9613, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-cruise-of-the-dazzler": {"ebook": 11051, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "heretics": {"ebook": 470, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-snare": {"ebook": 2687, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "true-to-the-old-flag": {"ebook": 8859, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-age-of-chivalry": {"ebook": 4926, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "twenty-years-at-hull-house": {"ebook": 1325, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-last-of-the-plainsmen": {"ebook": 2057, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "how-we-think": {"ebook": 37423, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-science-of-getting-rich": {"ebook": 59844, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "end": r"^FURTHER AIDS TOWARD GETTING RICH RIGHT"},  # the publisher's list isn't read aloud
    "in-the-reign-of-terror": {"ebook": 3785, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-purple-land": {"ebook": 7132, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "personal-memoirs-of-u-s-grant": {"ebook": 4367, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "travels-in-alaska": {"ebook": 7345, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": 2},  # the glossary isn't read aloud
    "the-blonde-lady": {"ebook": 24839, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "john-thorndykes-cases": {"ebook": 13882, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-job": {"ebook": 25474, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-mountains-of-california": {"ebook": 10012, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-jacket": {"ebook": 1162, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "representative-men": {"ebook": 6312, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-girl-on-the-boat": {"ebook": 20717, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "three-men-and-a-maid": {"ebook": 6836, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "two-years-before-the-mast": {"ebook": 2055, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-mystery-of-31-new-inn": {"ebook": 12187, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-art-of-public-speaking": {"ebook": 16317, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-yosemite": {"ebook": 7091, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-adventures-of-jimmie-dale": {"ebook": 1218, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-old-man-in-the-corner": {"ebook": 10556, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-confessions-of-arsene-lupin": {"ebook": 28093, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": True},  # closing lines and notes cut
    "orthodoxy": {"ebook": 16769, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "tales-of-st-austins": {"ebook": 6980, "heading": rf" *{ROMAN}\.?", "proportional": True, "end": r"^End of Project Gutenberg"},  # no trim: Notes is one of the essays; the closing line isn't read aloud
    "to-the-last-man": {"ebook": 2070, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-son-of-the-wolf": {"ebook": 2377, "heading": None, "proportional": True, "start": r"^The White Silence$"},  # past the contents
    "cape-cod": {"ebook": 34392, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "far-away-and-long-ago": {"ebook": 6093, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "manalive": {"ebook": 1718, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "paradise-lost": {"ebook": 1745, "heading": None, "proportional": True, "start": r"^ON Paradise Lost\.\s+WHEN I beheld", "end": r"^Transcriber's Note: Title page of first edition"},  # past the editor's preface; the poems printed after it aren't in the recording
    "the-theory-of-the-leisure-class": {"ebook": 833, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-adventures-of-gerard": {"ebook": 1644, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # closing lines and notes cut
    "looking-backward": {"ebook": 624, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-green-flag": {"ebook": 10446, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-monk": {"ebook": 601, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-maine-woods": {"ebook": 42500, "heading": None, "proportional": True, "start": r"^KTAADN$", "end": r"^INDEX$"},  # past the contents; the index isn't read aloud
    "the-green-fairy-book": {"ebook": 7277, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "hard-times": {"ebook": 786, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "andersens-fairy-tales": {"ebook": 1597, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-divine-comedy": {"ebook": 1004, "heading": None, "proportional": True, "start": r"^Inferno: Canto I$", "trim": True},  # past the contents
    "the-ladies-paradise": {"ebook": 54726, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-crimes-of-england": {"ebook": 11554, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-haunted-man-and-the-ghosts-bargain": {"ebook": 644, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-king-in-yellow": {"ebook": 8492, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-wheels-of-chance": {"ebook": 1264, "heading": rf"{ROMAN}\.\n[^\n]+", "proportional": True},
    "the-pit": {"ebook": 4382, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "on-liberty": {"ebook": 34901, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "alarms-and-discursions": {"ebook": 9656, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-octopus": {"ebook": 268, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-heart-of-mid-lothian": {"ebook": 6944, "heading": None, "proportional": True, "start": r"^CHAPTER FIRST\.$", "end": r"^\s*NOTES TO THE HEART OF MID-LOTHIAN"},  # the recording starts at chapter one; the notes aren't read aloud
    "specimen-days": {"ebook": 8813, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "legends-of-charlemagne": {"ebook": 4927, "heading": None, "proportional": True, "start": r"^INTRODUCTION$", "end": r"^GLOSSARY$"},  # past the contents; the glossary isn't read aloud
    "man-and-wife": {"ebook": 1586, "heading": None, "proportional": True, "start": r"^PROLOGUE\.--THE IRISH MARRIAGE\.$", "trim": True},  # past the title page
    "the-antiquary": {"ebook": 7005, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},  # past the title page and contents
    "rob-roy": {"ebook": 7025, "heading": None, "proportional": True, "start": r"^INTRODUCTION---\(1829\)$", "trim": True},  # past the title page
    "the-blue-fairy-book": {"ebook": 503, "heading": None, "proportional": True, "start": r"^THE BRONZE RING$", "trim": True},  # past the contents
    "in-chancery": {"ebook": 2594, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "myths-and-legends-of-ancient-greece-and": {"ebook": 22381, "heading": None, "proportional": True, "start": r"^PREFACE\.$", "end": r"^PRONOUNCING INDEX\.$"},  # the index isn't read aloud
    "the-analects": {"ebook": 10056, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "end": r"^~THE SORROWS OF HAN~$"},  # the play printed after it isn't in the recording
    "twice-told-tales": {"ebook": 13707, "heading": None, "proportional": True, "start": r"^THE GRAY CHAMPION$", "trim": True},  # past the contents
    "the-hunchback-of-notre-dame": {"ebook": 2610, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "ulysses": {"ebook": 4300, "heading": None, "proportional": True, "start": r"^Stately, plump Buck Mulligan", "trim": True},  # past the title page
    "the-monastery": {"ebook": 6406, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "beautiful-joe": {"ebook": 10226, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-blue-castle": {"ebook": 67979, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-count-of-monte-cristo": {"ebook": 1184, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-abysmal-brute": {"ebook": 55948, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-grand-babylon-hotel": {"ebook": 2813, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-way-of-all-flesh": {"ebook": 2084, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-angel-of-terror": {"ebook": 21530, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "john-barleycorn": {"ebook": 318, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "new-chronicles-of-rebecca": {"ebook": 1375, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-toilers-of-the-sea": {"ebook": 32338, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "tess-of-the-durbervilles": {"ebook": 110, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "coningsby": {"ebook": 7412, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "zanoni": {"ebook": 2664, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?", "proportional": True},
    "the-history-of-mr-polly": {"ebook": 7308, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "old-mother-west-wind": {"ebook": 2557, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "on-the-eve": {"ebook": 6902, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-moon-and-sixpence": {"ebook": 222, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "mike": {"ebook": 7423, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "beowulf": {"ebook": 16328, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-adventures-of-bobby-coon": {"ebook": 46951, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-adventures-of-peter-cottontail": {"ebook": 46866, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "old-granny-fox": {"ebook": 4980, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "happy-jack": {"ebook": 13355, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-intrusion-of-jimmy": {"ebook": 4075, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "before-adam": {"ebook": 310, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "blacky-the-crow": {"ebook": 4979, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-prince": {"ebook": 1232, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "all-the-sad-young-men": {"ebook": 68229, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "tales-of-the-jazz-age": {"ebook": 6695, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "money-for-nothing": {"ebook": 72972, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-adventures-of-bob-white": {"ebook": 46950, "heading": rf" *{ROMAN}\. .*", "proportional": True, "trim": True},  # closing lines and notes cut
    "notes-from-the-underground": {"ebook": 600, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "of-human-bondage": {"ebook": 351, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-adventures-of-old-man-coyote": {"ebook": 46952, "heading": rf" *{ROMAN}\. .*", "proportional": True},
    "the-adventures-of-jimmy-skunk": {"ebook": 21015, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-adventures-of-buster-bear": {"ebook": 22816, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": 2},  # the publisher's list isn't read aloud
    "the-new-machiavelli": {"ebook": 1047, "heading": r" *\d+\.?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-sea-lady": {"ebook": 35920, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-adventures-of-johnny-chuck": {"ebook": 5844, "heading": rf" *{ROMAN}\. .*", "proportional": True, "start": r"^ *.Good news, good news for every one"},  # past the title page and contents
    "redburn": {"ebook": 8118, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "flappers-and-philosophers": {"ebook": 4368, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "the-food-of-the-gods": {"ebook": 11696, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "a-childs-garden-of-verses": {"ebook": 28722, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": True},  # closing lines and notes cut
    "leaves-of-grass": {"ebook": 1322, "heading": r" *\d+\.?", "proportional": True},
    "the-king-of-irelands-son": {"ebook": 3495, "heading": rf" *{ROMAN}\.?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-imitation-of-christ": {"ebook": 1653, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "sonnets-from-the-portuguese": {"ebook": 2002, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "a-shropshire-lad": {"ebook": 5720, "heading": rf" *{ROMAN}\.?", "proportional": True},
    "lives-of-the-twelve-caesars": {"ebook": 6400, "heading": None, "proportional": True, "start": r"^PREFACE$", "end": r"^\s*INDEX\.$", "trim": True},  # the index isn't read aloud; closing lines and notes cut
    "five-little-peppers-grown-up": {"ebook": 7498, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-five-little-peppers-midway": {"ebook": 5632, "heading": rf" *{ROMAN}\.?", "trim": True},  # closing lines and notes cut
    "the-canterville-ghost": {"ebook": 14522, "heading": rf" *{ROMAN}\.?"},
    "donal-grant": {"ebook": 2433, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "whats-mines-mine": {"ebook": 5969, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "heather-and-snow": {"ebook": 9155, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-bertrams": {"ebook": 26001, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "castle-richmond": {"ebook": 5897, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-kellys-and-the-okellys": {"ebook": 4917, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^Footnotes$"},  # the footnotes aren't read aloud
    "nina-balatka": {"ebook": 8897, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "linda-tressel": {"ebook": 26002, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-belton-estate": {"ebook": 4969, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "sir-harry-hotspur-of-humblethwaite": {"ebook": 27712, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "ralph-the-heir": {"ebook": 25579, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "harry-heathcote-of-gangoil": {"ebook": 5642, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "lady-anna": {"ebook": 31274, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "john-caldigate": {"ebook": 11643, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "marion-fay": {"ebook": 30100, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-landleaguers": {"ebook": 30606, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "an-old-mans-love": {"ebook": 25001, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-struggles-of-brown-jones-and": {"ebook": 27533, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "brother-jacob": {"ebook": 2171, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "impressions-of-theophrastus-such": {"ebook": 10762, "heading": rf" *{ROMAN}\.?", "trim": True},  # closing lines and notes cut
    "the-little-colonels-house-party": {"ebook": 15741, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^BOOKS FOR YOUNG PEOPLE"},  # the publisher's list isn't read aloud
    "ranald-bannermans-boyhood": {"ebook": 9301, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "sir-gibbie": {"ebook": 2370, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^BROAD SCOTS GLOSSARY"},  # the glossary isn't read aloud
    "the-seaboard-parish": {"ebook": 8562, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-elect-lady": {"ebook": 8944, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-flight-of-the-shadow": {"ebook": 8902, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "the-golden-lion-of-granpere": {"ebook": 5202, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "is-he-popenjoy": {"ebook": 29828, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-fixed-period": {"ebook": 27067, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "kept-in-the-dark": {"ebook": 22000, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-moorland-cottage": {"ebook": 11371, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "a-dark-nights-work": {"ebook": 2522, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "henrietta-temple": {"ebook": 19771, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "robert-falconer": {"ebook": 2561, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^FOOTNOTES:$", "proportional": True},  # the footnotes and glossary aren't read aloud
    "the-vicar-of-bullhampton": {"ebook": 26541, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "tom-brown-at-oxford": {"ebook": 26851, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "mr-scarboroughs-family": {"ebook": 12234, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-hoosier-schoolmaster": {"ebook": 15099, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "end": r"^FOOTNOTES:\s+\[Footnote 29"},  # footnote blocks follow chapters, so no trim
    "once-on-a-time": {"ebook": 27771, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "an-autobiography": {"ebook": 5978, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-claverings": {"ebook": 15766, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "annals-of-a-quiet-neighbourhood": {"ebook": 5773, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-king-of-the-golden-river": {"ebook": 701, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "paul-clifford": {"ebook": 7735, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-macdermots-of-ballycloran": {"ebook": 29000, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-caxtons": {"ebook": 7605, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "mopsa-the-fairy": {"ebook": 32867, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-young-trailers": {"ebook": 19477, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-moving-picture-girls": {"ebook": 19171, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "aunt-janes-nieces-in-society": {"ebook": 10468, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-phantom-ship": {"ebook": 12954, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "fame-and-fortune": {"ebook": 21632, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "the-outdoor-girls-of-deepdale": {"ebook": 10465, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?"},
    "aunt-janes-nieces-abroad": {"ebook": 16566, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^ *This story is one of the delightful"},  # the publisher's list isn't read aloud
    "aunt-janes-nieces-at-millville": {"ebook": 10359, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "end": r"^ *This story is one of the delightful"},  # the publisher's list isn't read aloud
    "aunt-janes-nieces-at-work": {"ebook": 13110, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "trim": True},  # closing lines and notes cut
    "snarleyyow": {"ebook": 12558, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-tree-of-appomattox": {"ebook": 17677, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "peter-simple": {"ebook": 21577, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "ran-away-to-sea": {"ebook": 23853, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-rulers-of-the-lakes": {"ebook": 14891, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-shades-of-the-wilderness": {"ebook": 12532, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-hunters-of-the-hills": {"ebook": 14890, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
    "the-shadow-of-the-north": {"ebook": 11881, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-guns-of-bull-run": {"ebook": 3653, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-rock-of-chickamauga": {"ebook": 9745, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-sword-of-antietam": {"ebook": 7862, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-scouts-of-stonewall": {"ebook": 6094, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "the-guns-of-shiloh": {"ebook": 5207, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "osceola-the-seminole": {"ebook": 35620, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-headless-horseman": {"ebook": 35587, "heading": r"(?:CHAPTER|Chapter) (?:(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY)(?:-(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Thirty|Forty)(?:-(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine))?)\.?(?:[ .:—-].*)?", "proportional": True},
    "the-star-of-gettysburg": {"ebook": 3811, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    "mark-the-match-boy": {"ebook": 53071, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True, "trim": True},  # closing lines and notes cut
    # 300 more public-domain titles (October 2026), ten replacements: headings found by matching the recording's tracks;
    # "proportional" where this edition's chapters don't line up with them.
    "the-adventures-of-pinocchio": {"ebook": 500, "heading": r"(?:CHAPTER|Chapter) \d+\.?(?:[ .:—-].*)?"},
    "a-house-of-pomegranates": {"ebook": 873, "heading": None, "proportional": True, "start": r"^ *THE YOUNG KING\s+TO\s+MARGARET LADY BROOKE"},  # past the title page and contents
    "south-sea-tales": {"ebook": 1208, "heading": None, "proportional": True, "start": r"^ *THE HOUSE OF MAPUHI\s+Despite"},  # past the title page and contents
    "children-of-the-frost": {"ebook": 10736, "heading": None, "proportional": True, "start": r"^ *IN THE FORESTS OF THE NORTH\s+A weary"},  # past the title page and contents
    "love-of-life-and-other-stories": {"ebook": 710, "heading": None, "proportional": True, "start": r"^ *LOVE OF LIFE\s+.This out of all"},  # past the title page and contents
    "the-flying-inn": {"ebook": 59239, "heading": None, "proportional": True, "trim": True, "end": r"^ *● Transcriber’s Notes:", "start": r"^ *A SERMON ON INNS\s+THE sea"},  # the transcriber's note isn't read aloud; past the title page and contents
    "tales-of-terror-and-mystery": {"ebook": 537, "heading": None, "proportional": True, "trim": True, "start": r"^ *The Horror of the Heights\s+The idea"},  # closing lines and notes cut; past the title page and contents
    "the-singing-bone": {"ebook": 59478, "heading": None, "proportional": True},
    "king-coal": {"ebook": 7522, "heading": None, "proportional": True},
    "ragged-dick": {"ebook": 5348, "heading": rf"(?:CHAPTER|Chapter) {ROMAN}\.?(?:[ .:—-].*)?", "proportional": True},
}

# Shorter than this after a heading means a table-of-contents line, not a chapter.
MIN_UNIT = 400

# What ends the book itself in many editions: Gutenberg's closing line, notes, indexes, printers'
# lines and publishers' lists. A book with "trim" is cut at the first of these in its last quarter
# (opt-in, so a text built before never changes and saved highlights stay put). "trim": 2 also cuts
# at a glossary and after the book's own last "THE END" (the rules added for the third round of
# titles; "trim": True keeps the first round's rules exactly).
BACK_MATTER = re.compile(
    # Headings can sit inside =signs=, _italics_ or a drawn box (+—+ |).
    r"^[\s=_*+|—-]*(?:End of (?:the )?Project Gutenberg|\[?Transcriber[’']s Notes?|Footnotes?[.:]?[\s=_]*$"
    r"|NOTES?[.:]?[\s=_]*$|INDEX[.:]?[\s=_]*$|PRINTED (?:BY|IN)\b|THE NELSON CLASSICS|Uniform with this|ADVERTISEMENTS?[.:]?[\s=_]*$|BY THE SAME AUTHOR)",
    re.M | re.I,
)
GLOSSARY = re.compile(r"^[\s=_*]*GLOSSARY[.:]?[\s=_]*$", re.M | re.I)
THE_END = re.compile(r"^[\s_*]*(?:THE END|FINIS)[.!]?[\s_*]*$", re.M | re.I)


def trim_back_matter(body: str, level: int = 1) -> str:
    patterns = [BACK_MATTER] + ([GLOSSARY] if level >= 2 else [])
    starts = [m.start() for pat in patterns for m in pat.finditer(body) if m.start() >= len(body) * 0.75]
    cut = min(starts, default=len(body))
    if level >= 2:
        # Whatever follows the book's own last "THE END" (in its last tenth) is the publisher's.
        ends = [e for e in THE_END.finditer(body[:cut]) if e.start() >= len(body) * 0.9]
        if ends:
            cut = ends[-1].end()
    return body[:cut]


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
        body = trim_back_matter(body, 2 if conf["trim"] == 2 else 1)
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
