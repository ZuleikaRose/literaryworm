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
    # 250 more public-domain titles (October 2026)
    "agnes-grey": 8493,  # solo
    "mansfield-park": 5267,  # solo
    "dombey-and-son": 10032,  # solo
    "the-old-curiosity-shop": 11980,  # solo
    "the-mystery-of-edwin-drood": 1082,  # solo
    "the-chimes": 4924,  # solo
    "north-and-south": 9570,  # solo
    "wives-and-daughters": 6376,  # solo
    "sylvias-lovers": 21805,  # solo
    "the-mayor-of-casterbridge": 8109,  # solo
    "jude-the-obscure": 6747,  # solo
    "the-woodlanders": 4101,  # solo
    "daniel-deronda": 655,  # solo
    "the-warden": 9780,  # solo
    "barchester-towers": 10450,  # solo
    "doctor-thorne": 12437,  # solo
    "can-you-forgive-her": 18175,  # solo
    "the-way-we-live-now": 1330,  # solo
    "vanity-fair": 11325,  # solo
    "framley-parsonage": 14034,  # solo
    "kenilworth": 3511,  # solo
    "the-first-men-in-the-moon": 16521,  # solo
    "the-wrong-box": 2330,  # solo
    "kipps": 6921,  # solo
    "the-valley-of-fear": 10214,  # solo
    "michael-strogoff": 3306,  # solo
    "the-poison-belt": 2706,  # solo
    "the-white-company": 1727,  # solo
    "a-connecticut-yankee-in-king-arthurs": 1942,  # solo
    "tom-sawyer-abroad": 3681,  # solo
    "martin-eden": 4954,  # solo
    "burning-daylight": 6966,  # solo
    "the-people-of-the-abyss": 3570,  # solo
    "the-pathfinder": 2488,  # solo
    "tarzan-of-the-apes": 1303,  # solo
    "the-return-of-tarzan": 1199,  # solo
    "the-beasts-of-tarzan": 1849,  # solo
    "the-son-of-tarzan": 2610,  # solo
    "the-land-that-time-forgot": 2435,  # solo
    "dorothy-and-the-wizard-in-oz": 6431,  # solo
    "the-lost-princess-of-oz": 9113,  # solo
    "the-tin-woodman-of-oz": 9805,  # solo
    "the-scarecrow-of-oz": 8594,  # solo
    "rinkitink-in-oz": 8926,  # solo
    "anne-of-the-island": 7383,  # solo
    "anne-of-avonlea": 1754,  # solo
    "glinda-of-oz": 10617,  # solo
    "annes-house-of-dreams": 5895,  # solo
    "rainbow-valley": 10744,  # solo
    "little-lord-fauntleroy": 3179,  # solo
    "the-lost-prince": 1873,  # solo
    "the-shuttle": 3892,  # solo
    "under-the-lilacs": 7660,  # solo
    "jack-and-jill": 954,  # solo
    "the-story-of-the-amulet": 9232,  # solo
    "the-enchanted-castle": 20430,  # solo
    "the-story-of-the-treasure-seekers": 579,  # solo
    "the-magic-city": 3124,  # solo
    "peter-pan-in-kensington-gardens": 3008,  # solo
    "at-the-back-of-the-north-wind": 9195,  # solo
    "the-princess-and-curdie": 12892,  # solo
    "tom-browns-school-days": 1961,  # solo
    "the-phoenix-and-the-carpet": 9059,  # solo
    "pollyanna-grows-up": 1243,  # solo
    "what-katy-did-at-school": 1152,  # solo
    "what-katy-did": 4187,  # solo
    "the-coral-island": 3144,  # solo
    "the-children-of-the-new-forest": 8868,  # solo
    "rupert-of-hentzau": 1046,  # solo
    "the-elusive-pimpernel": 1690,  # solo
    "the-black-tulip": 5555,  # solo
    "madame-bovary": 17229,  # solo
    "the-idiot": 22122,  # solo
    "the-brothers-karamazov": 13837,  # solo
    "the-vicar-of-wakefield": 5019,  # solo
    "the-great-god-pan": 4801,  # solo
    "the-lair-of-the-white-worm": 853,  # solo
    "the-jewel-of-seven-stars": 2833,  # solo
    "the-red-house-mystery": 17105,  # solo
    "the-lodger": 1695,  # solo
    "captain-blood": 22729,  # solo
    "scaramouche": 646,  # solo
    "riders-of-the-purple-sage": 1741,  # solo
    "uncle-toms-cabin": 75,  # solo
    "the-house-of-mirth": 8799,  # solo
    "the-custom-of-the-country": 8165,  # solo
    "summer": 5489,  # solo
    "alexanders-bridge": 2663,  # solo
    "the-country-of-the-pointed-firs": 19573,  # solo
    "night-and-day": 667,  # solo
    "the-voyage-out": 13933,  # solo
    "babbitt": 2829,  # solo
    "howards-end": 1049,  # solo
    "where-angels-fear-to-tread": 1638,  # solo
    "a-voyage-to-arcturus": 5269,  # solo
    "understood-betsy": 2341,  # solo
    "the-damnation-of-theron-ware": 4203,  # solo
    "mcteague": 1824,  # solo
    "the-jungle": 3269,  # solo
    "the-europeans": 3193,  # solo
    "the-secret-sharer": 4388,  # solo
    "typhoon": 15303,  # solo
    "three-men-on-the-bummel": 5365,  # solo
    "the-inimitable-jeeves": 20757,  # solo
    "zuleika-dobson": 2846,  # solo
    "the-scarlet-plague": 3151,  # solo
    "the-card": 344,  # solo
    "the-moon-pool": 4057,  # solo
    "gladiator": 7973,  # solo
    "the-skylark-of-space": 4963,  # solo
    "the-autobiography-of-an-ex-colored-man": 9930,  # solo
    "the-house-behind-the-cedars": 8444,  # solo
    "the-book-of-tea": 15994,  # solo
    "the-burgess-animal-book-for-children": 18912,  # solo
    "the-adventures-of-danny-meadow-mouse": 18017,  # solo
    "the-sea-fairies": 2315,  # solo
    "wet-magic": 10376,  # solo
    "the-mysterious-stranger": 13459,  # solo
    "the-stolen-white-elephant": 6568,  # solo
    "greenmantle": 16707,  # solo
    "the-tragedy-of-the-korosko": 3461,  # solo
    "the-mystery-of-cloomber": 5924,  # solo
    "the-parasite": 7030,  # solo
    "shirley": 14193,  # LibriVox volunteers
    "ivanhoe": 430,  # LibriVox volunteers
    "a-journey-to-the-centre-of-the-earth": 5332,  # LibriVox volunteers
    "the-deerslayer": 4351,  # LibriVox volunteers
    "the-story-girl": 415,  # LibriVox volunteers
    "kilmeny-of-the-orchard": 1782,  # LibriVox volunteers
    "jos-boys": 1628,  # LibriVox volunteers
    "little-men": 4845,  # LibriVox volunteers
    "the-wouldbegoods": 1042,  # LibriVox volunteers
    "a-girl-of-the-limberlost": 124,  # LibriVox volunteers
    "freckles": 13879,  # LibriVox volunteers
    "twenty-years-after": 57,  # LibriVox volunteers
    "the-gambler": 4017,  # LibriVox volunteers
    "the-circular-staircase": 882,  # LibriVox volunteers
    "the-hollow-needle": 705,  # LibriVox volunteers
    "the-four-feathers": 5494,  # LibriVox volunteers
    "herland": 769,  # LibriVox volunteers
    "jacobs-room": 8552,  # LibriVox volunteers
    "the-longest-journey": 1715,  # LibriVox volunteers
    "toby-tyler": 4400,  # LibriVox volunteers
    "the-rise-of-silas-lapham": 4791,  # LibriVox volunteers
    "leave-it-to-psmith": 14289,  # LibriVox volunteers
    "a-damsel-in-distress": 1501,  # LibriVox volunteers
    "otto-of-the-silver-hand": 814,  # LibriVox volunteers
    "little-dorrit": 6771,  # solo
    "bleak-house": 10764,  # solo
    "our-mutual-friend": 4676,  # solo
    "lorna-doone": 2386,  # LibriVox volunteers
    "david-copperfield": 16302,  # solo
    "nicholas-nickleby": 10908,  # solo
    "the-pickwick-papers": 10434,  # solo
    "barnaby-rudge": 20885,  # solo
    "middlemarch": 6584,  # solo
    "far-from-the-madding-crowd": 3862,  # solo
    "a-pair-of-blue-eyes": 3656,  # solo
    "white-jacket": 5104,  # solo
    "lilith": 1815,  # solo
    "incidents-in-the-life-of-a-slave-girl": 1706,  # solo
    "uncle-silas": 13097,  # solo
    "lord-jim": 17737,  # solo
    "victory": 18840,  # solo
    "the-wonderful-visit": 9625,  # solo
    "the-return-of-the-native": 398,  # LibriVox volunteers
    "the-pioneers": 1930,  # LibriVox volunteers
    "the-last-days-of-pompeii": 2956,  # LibriVox volunteers
    "mary-barton": 10132,  # solo
    "the-black-arrow": 11950,  # solo
    "the-innocents-abroad": 8853,  # solo
    "the-blithedale-romance": 3867,  # solo
    "a-princess-of-mars": 17597,  # solo
    "the-prairie": 6868,  # solo
    "the-patchwork-girl-of-oz": 7680,  # solo
    "the-three-musketeers": 12805,  # solo
    "candide": 12995,  # solo
    "the-education-of-henry-adams": 4244,  # solo
    "o-pioneers": 6993,  # solo
    "main-street": 12305,  # solo
    "news-from-nowhere": 5766,  # solo
    "the-ambassadors": 5013,  # solo
    "iola-leroy": 8053,  # solo
    "romola": 4018,  # LibriVox volunteers
    "no-name": 3185,  # LibriVox volunteers
    "the-golden-road": 526,  # LibriVox volunteers
    "the-mystery-of-the-yellow-room": 2420,  # LibriVox volunteers
    "the-sea-hawk": 592,  # LibriVox volunteers
    "erewhon": 1874,  # LibriVox volunteers
    "the-metal-monster": 2501,  # LibriVox volunteers
    "the-golden-fleece-and-the-heroes-who": 6675,  # LibriVox volunteers
    "roughing-it": 1101,  # solo
    "the-iron-heel": 4342,  # solo
    "the-gods-of-mars": 7872,  # solo
    "rose-in-bloom": 20921,  # solo
    "eight-cousins": 16376,  # solo
    "phantastes": 8447,  # solo
    "sylvie-and-bruno": 15852,  # solo
    "allan-quatermain": 830,  # solo
    "sir-nigel": 4747,  # solo
    "the-adventures-of-reddy-fox": 6369,  # LibriVox volunteers
    "the-burgess-bird-book-for-children": 1321,  # LibriVox volunteers
    "the-house-of-the-seven-gables": 2961,  # solo
    "crime-and-punishment": 12129,  # solo
    "the-leavenworth-case": 10562,  # solo
    "three-men-in-a-boat": 8870,  # solo
    "the-spy": 413,  # LibriVox volunteers
    "the-red-fairy-book": 2382,  # LibriVox volunteers
    "life-on-the-mississippi": 701,  # solo
    "typee": 452,  # solo
    "at-the-earths-core": 9216,  # solo
    "pellucidar": 9218,  # solo
    "the-man-in-the-iron-mask": 2770,  # solo
    "joseph-andrews": 3542,  # solo
    "up-from-slavery": 11745,  # solo
    "carmilla": 15020,  # solo
    "the-napoleon-of-notting-hill": 2281,  # solo
    "the-cloister-and-the-hearth": 13065,  # solo
    "the-hampdenshire-wonder": 19402,  # solo
    "men-of-iron": 19209,  # solo
    "huntingtower": 6539,  # solo
    "the-riddle-of-the-sands": 684,  # solo
    "the-professor": 2912,  # LibriVox volunteers
    "the-narrative-of-arthur-gordon-pym-of": 100,  # LibriVox volunteers
    "the-mill-on-the-floss": 15647,  # solo
    "the-master-of-ballantrae": 9965,  # solo
    "the-memoirs-of-sherlock-holmes": 21615,  # solo
    "the-diary-of-a-nobody": 336,  # solo
    "rilla-of-ingleside": 260,  # solo
    "captains-courageous": 2044,  # solo
    "martin-chuzzlewit": 15318,  # solo
    "adam-bede": 15029,  # solo
    "english-fairy-tales": 819,  # solo
    "the-moonstone": 11215,  # solo
    "the-talisman": 1329,  # solo
    "the-tragedy-of-puddnhead-wilson": 2136,  # solo
    "the-book-of-dragons": 2972,  # solo
    "trents-last-case": 5662,  # solo
    "micah-clarke": 10769,  # LibriVox volunteers
    "catriona": 22470,  # solo
    "what-katy-did-next": 3279,  # LibriVox volunteers
    "celtic-fairy-tales": 1837,  # LibriVox volunteers
    "the-good-soldier": 16423,  # solo
    "the-castle-of-otranto": 15992,  # solo
    "nostromo": 16761,  # solo
    "something-new": 1182,  # solo
    # 250 more public-domain titles (October 2026), three replacements
    "the-old-wives-tale": 1613,  # solo
    "the-souls-of-black-folk": 727,  # solo
    "the-secret-agent": 16233,  # solo
    # 250 more public-domain titles (October 2026), one more replacement
    "women-in-love": 2287,  # solo
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
