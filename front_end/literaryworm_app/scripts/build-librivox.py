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
    # A third 250 public-domain titles (October 2026)
    "the-small-house-at-allington": 16404,  # solo
    "the-last-chronicle-of-barset": 10313,  # solo
    "orley-farm": 4554,  # solo
    "the-three-clerks": 7533,  # solo
    "the-dukes-children": 21492,  # solo
    "phineas-finn": 18981,  # solo
    "cousin-henry": 5969,  # solo
    "phineas-redux": 20387,  # solo
    "the-eustace-diamonds": 19703,  # solo
    "the-prime-minister": 20988,  # solo
    "miss-mackenzie": 6620,  # solo
    "he-knew-he-was-right": 2935,  # solo
    "the-law-and-the-lady": 4000,  # solo
    "quentin-durward": 16193,  # solo
    "scenes-of-clerical-life": 4765,  # solo
    "ruth": 1809,  # solo
    "the-virginians": 8065,  # solo
    "the-odd-women": 6027,  # solo
    "uncle-bernac": 5776,  # solo
    "love-and-mr-lewisham": 8577,  # solo
    "the-fur-country": 1138,  # solo
    "godfrey-morgan": 14580,  # solo
    "the-blockade-runners": 3783,  # solo
    "eric-brighteyes": 4317,  # solo
    "jungle-tales-of-tarzan": 2806,  # solo
    "tarzan-and-the-jewels-of-opar": 2703,  # solo
    "tarzan-and-the-ant-men": 15152,  # solo
    "tarzan-the-terrible": 5962,  # solo
    "the-people-that-time-forgot": 2464,  # solo
    "the-monster-men": 11891,  # solo
    "the-cave-girl": 18537,  # solo
    "sky-island": 301,  # solo
    "hospital-sketches": 1733,  # solo
    "just-david": 17963,  # solo
    "michael-ohalloran": 459,  # solo
    "the-birds-christmas-carol": 4897,  # solo
    "moths-of-the-limberlost": 1786,  # solo
    "when-patty-went-to-college": 6808,  # solo
    "clover": 3244,  # solo
    "in-the-high-valley": 3520,  # solo
    "nights-with-uncle-remus": 4978,  # solo
    "the-bobbsey-twins-in-the-country": 4663,  # solo
    "tom-swift-and-his-electric-runabout": 1877,  # solo
    "the-adventures-of-jerry-muskrat": 17855,  # solo
    "the-adventures-of-prickly-porky": 18703,  # solo
    "mother-west-winds-children": 3123,  # solo
    "bowser-the-hound": 15614,  # solo
    "whitefoot-the-wood-mouse": 7942,  # solo
    "the-girl-in-the-golden-atom": 6038,  # solo
    "wieland": 10471,  # solo
    "the-return": 5796,  # solo
    "the-crystal-stopper": 6439,  # solo
    "the-eye-of-osiris": 21721,  # solo
    "the-man-who-knew-too-much": 354,  # solo
    "the-maltese-falcon": 22259,  # solo
    "bardelys-the-magnificent": 21174,  # solo
    "fortunes-fool": 21662,  # solo
    "king-of-the-khyber-rifles": 4127,  # solo
    "the-border-legion": 11424,  # solo
    "the-untamed": 4429,  # solo
    "the-spoilers": 4621,  # solo
    "the-game": 5710,  # solo
    "a-daughter-of-the-snows": 9673,  # solo
    "the-golden-bowl": 2534,  # solo
    "the-aspern-papers": 3278,  # solo
    "the-glimpses-of-the-moon": 1641,  # solo
    "the-fruit-of-the-tree": 3958,  # solo
    "the-professors-house": 17221,  # solo
    "one-of-ours": 3486,  # solo
    "jennie-gerhardt": 6204,  # solo
    "free-air": 3034,  # solo
    "the-sun-also-rises": 21084,  # solo
    "poor-white": 17014,  # solo
    "crome-yellow": 9744,  # solo
    "the-country-house": 11253,  # solo
    "riceyman-steps": 13717,  # solo
    "buried-alive": 7762,  # solo
    "liza-of-lambeth": 11725,  # solo
    "the-patrician": 10195,  # solo
    "the-club-of-queer-trades": 1431,  # solo
    "the-unbearable-bassington": 7193,  # solo
    "the-coming-of-bill": 4740,  # solo
    "jill-the-reckless": 4957,  # solo
    "uneasy-money": 2492,  # solo
    "the-prince-and-betty": 17547,  # solo
    "love-among-the-chickens": 856,  # solo
    "indiscretions-of-archie": 2038,  # solo
    "the-house-of-the-dead": 8354,  # solo
    "chicot-the-jester": 10127,  # solo
    "moni-the-goat-boy": 6313,  # solo
    "growth-of-the-soil": 4395,  # solo
    "evangeline": 5159,  # solo
    "rachel-ray": 5343,  # LibriVox volunteers
    "the-american-senator": 5163,  # LibriVox volunteers
    "my-lady-ludlow": 5829,  # LibriVox volunteers
    "the-newcomes": 16677,  # LibriVox volunteers
    "diana-of-the-crossways": 10120,  # LibriVox volunteers
    "the-ordeal-of-richard-feverel": 13582,  # LibriVox volunteers
    "off-on-a-comet": 4060,  # LibriVox volunteers
    "the-underground-city": 3726,  # LibriVox volunteers
    "eight-hundred-leagues-on-the-amazon": 1127,  # LibriVox volunteers
    "tarzan-the-untamed": 6974,  # LibriVox volunteers
    "the-outlaw-of-torn": 3632,  # LibriVox volunteers
    "moods": 12323,  # LibriVox volunteers
    "a-fair-barbarian": 5536,  # LibriVox volunteers
    "the-head-of-the-house-of-coombe": 19727,  # LibriVox volunteers
    "just-patty": 2695,  # LibriVox volunteers
    "davy-and-the-goblin": 7845,  # LibriVox volunteers
    "the-story-of-a-bad-boy": 5487,  # LibriVox volunteers
    "the-bobbsey-twins-at-the-seashore": 4906,  # LibriVox volunteers
    "the-bobbsey-twins-at-school": 9828,  # LibriVox volunteers
    "tom-swift-and-his-airship": 6528,  # LibriVox volunteers
    "tom-swift-and-his-submarine-boat": 8271,  # LibriVox volunteers
    "tom-swift-and-his-wireless-message": 7468,  # LibriVox volunteers
    "tom-swift-among-the-diamond-makers": 8007,  # LibriVox volunteers
    "tom-swift-and-his-sky-racer": 6784,  # LibriVox volunteers
    "the-adventures-of-unc-billy-possum": 9960,  # LibriVox volunteers
    "the-adventures-of-grandfather-frog": 7710,  # LibriVox volunteers
    "edisons-conquest-of-mars": 1886,  # LibriVox volunteers
    "the-mystery-of-the-sea": 7858,  # LibriVox volunteers
    "the-tavern-knight": 5216,  # LibriVox volunteers
    "the-league-of-the-scarlet-pimpernel": 3865,  # LibriVox volunteers
    "the-reef": 3326,  # LibriVox volunteers
    "so-big": 16250,  # LibriVox volunteers
    "show-boat": 18111,  # LibriVox volunteers
    "the-ball-and-the-cross": 2405,  # LibriVox volunteers
    "the-clicking-of-cuthbert": 3452,  # LibriVox volunteers
    "ten-years-later": 5863,  # LibriVox volunteers
    "louise-de-la-valliere": 7451,  # LibriVox volunteers
    "tartarin-of-tarascon": 3956,  # LibriVox volunteers
    "the-problems-of-philosophy": 1317,  # LibriVox volunteers
    "the-history-of-pendennis": 11799,  # LibriVox volunteers
    "a-laodicean": 9628,  # solo
    "two-on-a-tower": 4209,  # solo
    "old-mortality": 17204,  # solo
    "the-firm-of-girdlestone": 19187,  # solo
    "montezumas-daughter": 12113,  # solo
    "a-hazard-of-new-fortunes": 9790,  # solo
    "the-titan": 5896,  # solo
    "germinal": 12810,  # solo
    "the-egoist": 3129,  # LibriVox volunteers
    "the-tragic-muse": 10647,  # LibriVox volunteers
    "sketches-by-boz": 13992,  # solo
    "the-haunted-hotel": 3634,  # solo
    "the-bride-of-lammermoor": 12318,  # solo
    "the-mystery-of-a-hansom-cab": 2424,  # solo
    "what-maisie-knew": 4303,  # solo
    "death-comes-for-the-archbishop": 18797,  # solo
    "the-financier": 5445,  # solo
    "smoke": 11434,  # solo
    "the-red-and-the-black": 19903,  # solo
    "the-new-magdalen": 12301,  # LibriVox volunteers
    "the-man-who-laughs": 4314,  # LibriVox volunteers
    "the-chessmen-of-mars": 8699,  # solo
    "the-blind-spot": 22887,  # solo
    "the-lone-star-ranger": 1773,  # solo
    "the-valley-of-the-moon": 7529,  # solo
    "piccadilly-jim": 14277,  # solo
    "the-song-of-hiawatha": 3447,  # solo
    "the-book-of-snobs": 3299,  # LibriVox volunteers
    "ayesha": 1781,  # LibriVox volunteers
    "the-worlds-desire": 11632,  # LibriVox volunteers
    "tom-swift-in-the-caves-of-ice": 11826,  # LibriVox volunteers
    "under-drakes-flag": 8666,  # LibriVox volunteers
    "in-freedoms-cause": 4653,  # LibriVox volunteers
    "the-pirate": 17673,  # solo
    "the-fortunes-of-nigel": 16631,  # solo
    "the-people-of-the-mist": 7431,  # solo
    "robin": 5702,  # solo
    "the-little-nugget": 7719,  # solo
    "the-rose-and-the-ring": 9902,  # LibriVox volunteers
    "with-lee-in-virginia": 9108,  # LibriVox volunteers
    "tanar-of-pellucidar": 20083,  # solo
    "813": 6281,  # solo
    "the-land-of-mist": 19159,  # LibriVox volunteers
    "the-stark-munro-letters": 8634,  # LibriVox volunteers
    "the-cruise-of-the-snark": 1384,  # LibriVox volunteers
    "allans-wife": 3718,  # solo
    "the-moon-maid": 14292,  # solo
    "wessex-tales": 5615,  # solo
    "wildfire": 11196,  # solo
    "the-heritage-of-the-desert": 6358,  # solo
    "at-the-foot-of-the-rainbow": 7519,  # LibriVox volunteers
    "american-notes": 14834,  # solo
    "hide-and-seek": 9940,  # solo
    "beyond-good-and-evil": 152,  # LibriVox volunteers
    "the-red-thumb-mark": 3505,  # LibriVox volunteers
    "the-hill-of-dreams": 8176,  # solo
    "desert-gold": 21139,  # solo
    "the-scalp-hunters": 2272,  # LibriVox volunteers
    "rudin": 10338,  # solo
    "the-fair-maid-of-perth": 13752,  # LibriVox volunteers
    "mary-marie": 5732,  # LibriVox volunteers
    "desperate-remedies": 5415,  # LibriVox volunteers
    "out-of-times-abyss": 2509,  # solo
    "new-grub-street": 3276,  # LibriVox volunteers
    "basil": 5066,  # LibriVox volunteers
    "east-lynne": 2575,  # LibriVox volunteers
    "the-duel": 9309,  # solo
    "lifes-little-ironies": 8459,  # solo
    "the-possessed": 8782,  # solo
    "bel-ami": 3857,  # solo
    "the-rainbow-trail": 7241,  # solo
    "the-harvester": 17678,  # solo
    "the-communist-manifesto": 4011,  # solo
    "the-virginian": 2730,  # solo
    "the-adventures-of-odysseus-and-the-tale": 5817,  # solo
    "the-little-lame-prince": 352,  # solo
    "the-varieties-of-religious-experience": 2828,  # LibriVox volunteers
    "armadale": 2797,  # LibriVox volunteers
    "a-vindication-of-the-rights-of-woman": 83,  # LibriVox volunteers
    "hardings-luck": 4110,  # LibriVox volunteers
    "kim": 1332,  # solo
    "the-woman-in-white": 11401,  # solo
    "redgauntlet": 15622,  # solo
    "island-nights-entertainments": 10406,  # solo
    "the-coming-race": 2194,  # solo
    "the-light-that-failed": 3530,  # LibriVox volunteers
    "eminent-victorians": 5961,  # solo
    "chronicles-of-avonlea": 1100,  # solo
    "the-teeth-of-the-tiger": 5755,  # solo
    "new-arabian-nights": 6417,  # solo
    "laddie": 3964,  # solo
    "the-swiss-family-robinson": 3347,  # solo
    "some-do-not": 16509,  # solo
    "hypatia": 3044,  # LibriVox volunteers
    "the-dawn-of-a-to-morrow": 5182,  # solo
    "villette": 14892,  # solo
    "the-rainbow": 9571,  # solo
    "after-dark": 11404,  # LibriVox volunteers
    "dead-souls": 1390,  # LibriVox volunteers
    "aarons-rod": 9254,  # LibriVox volunteers
    "travels-with-a-donkey-in-the-cevennes": 7282,  # solo
    "further-chronicles-of-avonlea": 1413,  # solo
    "the-night-land": 9322,  # solo
    "roderick-hudson": 5814,  # solo
    "guy-mannering": 13152,  # LibriVox volunteers
    "i-will-repay": 2863,  # solo
    "five-weeks-in-a-balloon": 2024,  # solo
    "the-garden-party": 19467,  # solo
    "a-portrait-of-the-artist-as-a-young-man": 8618,  # solo
    "the-portrait-of-a-lady": 8391,  # solo
    "sons-and-lovers": 9436,  # solo
    "queen-victoria": 2169,  # solo
    "the-voyage-of-the-beagle": 1211,  # LibriVox volunteers
    "the-prelude": 21142,  # solo
    # A third 250 public-domain titles (October 2026), three replacements
    "the-beautiful-and-damned": 12664,  # solo
    "john-silence": 7459,  # LibriVox volunteers
    "the-war-in-the-air": 5621,  # LibriVox volunteers
    # A third 250 public-domain titles (October 2026), one more replacement
    "the-song-of-the-lark": 2763,  # LibriVox volunteers
    # 300 more public-domain titles (October 2026)
    "the-cat-of-bubastes": 3673,  # solo
    "by-pike-and-dyke": 3870,  # solo
    "with-clive-in-india": 6173,  # solo
    "the-master-of-the-world": 1755,  # solo
    "the-last-trail": 2572,  # solo
    "the-day-of-the-beast": 17654,  # solo
    "the-mysterious-rider": 10439,  # solo
    "buster-bears-twins": 18139,  # solo
    "the-vanished-messenger": 9303,  # solo
    "the-double-traitor": 7267,  # solo
    "the-great-impersonation": 3904,  # solo
    "the-flaming-forest": 2771,  # solo
    "the-golden-snare": 4031,  # solo
    "nomads-of-the-north": 8395,  # solo
    "the-danger-trail": 3575,  # solo
    "isobel": 6625,  # solo
    "the-white-feather": 4642,  # solo
    "the-adventures-of-sally": 2393,  # solo
    "the-swoop": 1840,  # solo
    "the-gem-collector": 20117,  # solo
    "the-innocents": 4890,  # solo
    "madame-de-treymes": 5716,  # solo
    "jurgen": 10923,  # solo
    "the-magnificent-ambersons": 3369,  # solo
    "alice-adams": 2896,  # solo
    "penrod-and-sam": 3057,  # solo
    "seventeen": 3122,  # solo
    "monsieur-beaucaire": 6013,  # solo
    "gentle-julia": 4160,  # solo
    "the-conquest-of-canaan": 11863,  # solo
    "nature": 10073,  # solo
    "the-oregon-trail": 2648,  # solo
    "the-metropolis": 11508,  # solo
    "the-mutiny-of-the-elsinore": 4907,  # solo
    "tales-of-the-fish-patrol": 9576,  # solo
    "the-gold-hunters": 4999,  # solo
    "the-honor-of-the-big-snows": 2980,  # solo
    "the-riddle-of-the-frozen-flame": 4380,  # solo
    "the-man-who-knew": 19913,  # solo
    "the-clue-of-the-twisted-candle": 14527,  # solo
    "the-great-shadow": 4116,  # solo
    "jack-o-judgment": 21232,  # solo
    "the-doings-of-raffles-haw": 6434,  # solo
    "the-eight-strokes-of-the-clock": 9262,  # solo
    "the-woman-of-mystery": 10324,  # solo
    "the-middle-temple-murder": 13832,  # solo
    "scarhaven-keep": 7443,  # solo
    "the-charing-cross-mystery": 15833,  # solo
    "the-talleyrand-maxim": 8396,  # solo
    "the-chestermarke-instinct": 3888,  # solo
    "the-further-adventures-of-jimmie-dale": 10407,  # solo
    "tremendous-trifles": 2794,  # solo
    "the-trees-of-pride": 4441,  # solo
    "eugenics-and-other-evils": 2514,  # solo
    "a-short-history-of-england": 1853,  # solo
    "for-the-temple": 13773,  # LibriVox volunteers
    "bonnie-prince-charlie": 9050,  # LibriVox volunteers
    "the-vicomte-de-bragelonne": 4485,  # LibriVox volunteers
    "the-corsican-brothers": 9106,  # LibriVox volunteers
    "the-adventures-of-poor-mrs-quack": 18626,  # LibriVox volunteers
    "mother-west-wind-why-stories": 20194,  # LibriVox volunteers
    "mother-west-wind-how-stories": 8506,  # LibriVox volunteers
    "the-hunted-woman": 8712,  # LibriVox volunteers
    "the-pothunters": 14447,  # LibriVox volunteers
    "the-turmoil": 3049,  # LibriVox volunteers
    "a-childs-history-of-england": 1142,  # LibriVox volunteers
    "the-history-of-the-peloponnesian-war": 422,  # LibriVox volunteers
    "the-courage-of-marge-odoone": 9102,  # LibriVox volunteers
    "the-wolf-hunters": 5500,  # LibriVox volunteers
    "the-alaskan": 2025,  # LibriVox volunteers
    "through-the-magic-door": 10369,  # LibriVox volunteers
    "the-paradise-mystery": 818,  # LibriVox volunteers
    "dead-mens-money": 1119,  # LibriVox volunteers
    "peter-and-wendy": 16450,  # LibriVox volunteers
    "tommy-and-grizel": 11164,  # LibriVox volunteers
    "my-lady-nicotine": 20370,  # LibriVox volunteers
    "sentimental-tommy": 9612,  # LibriVox volunteers
    "the-little-white-bird": 9201,  # LibriVox volunteers
    "the-story-of-the-greeks": 8345,  # LibriVox volunteers
    "the-queens-necklace": 13980,  # solo
    "the-nest-of-the-sparrowhawk": 14509,  # solo
    "whats-wrong-with-the-world": 1544,  # LibriVox volunteers
    "the-spirit-of-the-border": 4293,  # solo
    "the-man-with-the-black-feather": 18013,  # solo
    "the-daffodil-mystery": 1546,  # LibriVox volunteers
    "wulf-the-saxon": 7280,  # solo
    "a-knight-of-the-white-cross": 13597,  # solo
    "the-valley-of-silent-men": 2651,  # solo
    "green-mansions": 2397,  # solo
    "the-lions-skin": 13455,  # solo
    "the-young-carthaginian": 7963,  # LibriVox volunteers
    "windy-mcphersons-son": 10600,  # LibriVox volunteers
    "democracy-and-education": 4492,  # LibriVox volunteers
    "the-dragon-and-the-raven": 4479,  # solo
    "beric-the-briton": 5300,  # solo
    "the-young-buglers": 22864,  # solo
    "the-cruise-of-the-dazzler": 10897,  # solo
    "heretics": 1738,  # solo
    "the-snare": 13805,  # solo
    "true-to-the-old-flag": 3434,  # LibriVox volunteers
    "the-age-of-chivalry": 2752,  # LibriVox volunteers
    "twenty-years-at-hull-house": 4673,  # LibriVox volunteers
    "the-last-of-the-plainsmen": 2760,  # solo
    "how-we-think": 10157,  # solo
    "the-science-of-getting-rich": 20014,  # solo
    "in-the-reign-of-terror": 5685,  # LibriVox volunteers
    "the-purple-land": 11495,  # LibriVox volunteers
    "personal-memoirs-of-u-s-grant": 3909,  # solo
    "travels-in-alaska": 4067,  # LibriVox volunteers
    "the-blonde-lady": 2716,  # solo
    "john-thorndykes-cases": 13463,  # solo
    "the-job": 3439,  # solo
    "the-mountains-of-california": 699,  # LibriVox volunteers
    "the-jacket": 5594,  # solo
    "representative-men": 4411,  # solo
    "the-girl-on-the-boat": 5567,  # solo
    "three-men-and-a-maid": 2263,  # solo
    "two-years-before-the-mast": 2742,  # LibriVox volunteers
    "the-mystery-of-31-new-inn": 3802,  # LibriVox volunteers
    "the-art-of-public-speaking": 4655,  # LibriVox volunteers
    "the-yosemite": 464,  # LibriVox volunteers
    "the-adventures-of-jimmie-dale": 1778,  # LibriVox volunteers
    "the-old-man-in-the-corner": 1196,  # solo
    "the-confessions-of-arsene-lupin": 6929,  # solo
    "orthodoxy": 19272,  # solo
    "tales-of-st-austins": 16646,  # solo
    "to-the-last-man": 6541,  # solo
    "the-son-of-the-wolf": 20327,  # solo
    "cape-cod": 15271,  # solo
    "far-away-and-long-ago": 20150,  # solo
    "manalive": 2579,  # solo
    "paradise-lost": 8815,  # solo
    "the-theory-of-the-leisure-class": 2635,  # LibriVox volunteers
    "the-adventures-of-gerard": 4239,  # solo
    "looking-backward": 3226,  # solo
    "the-green-flag": 8386,  # LibriVox volunteers
    "the-monk": 15546,  # LibriVox volunteers
    "the-maine-woods": 8964,  # solo
    "the-green-fairy-book": 2525,  # LibriVox volunteers
    "hard-times": 845,  # LibriVox volunteers
    "andersens-fairy-tales": 7883,  # LibriVox volunteers
    "the-divine-comedy": 67,  # LibriVox volunteers
    "the-ladies-paradise": 22348,  # solo
    "the-crimes-of-england": 2966,  # solo
    "the-haunted-man-and-the-ghosts-bargain": 5187,  # solo
    "the-king-in-yellow": 13568,  # solo
    "the-wheels-of-chance": 659,  # LibriVox volunteers
    "the-pit": 13357,  # solo
    "on-liberty": 21507,  # solo
    "alarms-and-discursions": 1816,  # solo
    "the-octopus": 6401,  # solo
    "the-heart-of-mid-lothian": 15265,  # solo
    "specimen-days": 1192,  # LibriVox volunteers
    "legends-of-charlemagne": 14859,  # LibriVox volunteers
    "man-and-wife": 9165,  # LibriVox volunteers
    "the-antiquary": 3738,  # solo
    "rob-roy": 2545,  # LibriVox volunteers
    "the-blue-fairy-book": 903,  # LibriVox volunteers
    "in-chancery": 22537,  # solo
    "myths-and-legends-of-ancient-greece-and": 2264,  # LibriVox volunteers
    "the-analects": 6647,  # solo
    "twice-told-tales": 5926,  # solo
    "the-hunchback-of-notre-dame": 2661,  # solo
    "ulysses": 4344,  # LibriVox volunteers
    "the-monastery": 9119,  # solo
    "beautiful-joe": 2005,  # solo
    "the-blue-castle": 20437,  # solo
    "the-count-of-monte-cristo": 6697,  # solo
    "the-abysmal-brute": 13958,  # solo
    "the-grand-babylon-hotel": 2446,  # solo
    "the-way-of-all-flesh": 1798,  # solo
    "the-angel-of-terror": 1716,  # solo
    "john-barleycorn": 1975,  # solo
    "new-chronicles-of-rebecca": 1412,  # LibriVox volunteers
    "the-toilers-of-the-sea": 4622,  # LibriVox volunteers
    "tess-of-the-durbervilles": 7043,  # solo
    "coningsby": 10979,  # solo
    "zanoni": 5960,  # solo
    "the-history-of-mr-polly": 5491,  # solo
    "old-mother-west-wind": 2131,  # solo
    "on-the-eve": 8017,  # solo
    "the-moon-and-sixpence": 3316,  # solo
    "mike": 1323,  # solo
    "beowulf": 11348,  # solo
    "the-adventures-of-bobby-coon": 10801,  # solo
    "the-adventures-of-peter-cottontail": 11452,  # solo
    "old-granny-fox": 13209,  # solo
    "happy-jack": 11687,  # solo
    "the-intrusion-of-jimmy": 4387,  # solo
    "before-adam": 8891,  # solo
    "blacky-the-crow": 8267,  # solo
    "the-prince": 9482,  # solo
    "all-the-sad-young-men": 18482,  # solo
    "tales-of-the-jazz-age": 6732,  # solo
    "money-for-nothing": 20084,  # solo
    "the-adventures-of-bob-white": 9596,  # solo
    "notes-from-the-underground": 6789,  # solo
    "of-human-bondage": 4749,  # solo
    "the-adventures-of-old-man-coyote": 9416,  # solo
    "the-adventures-of-jimmy-skunk": 1812,  # solo
    "the-adventures-of-buster-bear": 1624,  # solo
    "the-new-machiavelli": 9821,  # solo
    "the-sea-lady": 9646,  # solo
    "the-adventures-of-johnny-chuck": 3307,  # solo
    "redburn": 7820,  # solo
    "flappers-and-philosophers": 5480,  # solo
    "the-food-of-the-gods": 1931,  # solo
    "a-childs-garden-of-verses": 16572,  # solo
    "leaves-of-grass": 13878,  # solo
    "the-king-of-irelands-son": 5913,  # solo
    "the-imitation-of-christ": 575,  # solo
    "sonnets-from-the-portuguese": 4199,  # solo
    "a-shropshire-lad": 11042,  # solo
    "lives-of-the-twelve-caesars": 2376,  # LibriVox volunteers
    "five-little-peppers-grown-up": 3720,  # solo
    "the-five-little-peppers-midway": 2848,  # solo
    "the-canterville-ghost": 9523,  # solo
    "donal-grant": 11872,  # solo
    "whats-mines-mine": 10853,  # solo
    "heather-and-snow": 16891,  # solo
    "the-bertrams": 10486,  # solo
    "castle-richmond": 8929,  # solo
    "the-kellys-and-the-okellys": 19509,  # solo
    "nina-balatka": 9329,  # solo
    "linda-tressel": 13586,  # solo
    "the-belton-estate": 6519,  # solo
    "sir-harry-hotspur-of-humblethwaite": 10466,  # solo
    "ralph-the-heir": 8432,  # solo
    "harry-heathcote-of-gangoil": 14021,  # solo
    "lady-anna": 5828,  # solo
    "john-caldigate": 6117,  # solo
    "marion-fay": 9371,  # solo
    "the-landleaguers": 9068,  # solo
    "an-old-mans-love": 10386,  # solo
    "the-struggles-of-brown-jones-and": 7746,  # solo
    "brother-jacob": 8245,  # solo
    "impressions-of-theophrastus-such": 19749,  # solo
    "the-little-colonels-house-party": 5232,  # LibriVox volunteers
    "ranald-bannermans-boyhood": 79,  # LibriVox volunteers
    "sir-gibbie": 10130,  # LibriVox volunteers
    "the-seaboard-parish": 8653,  # LibriVox volunteers
    "the-elect-lady": 15728,  # LibriVox volunteers
    "the-flight-of-the-shadow": 9022,  # LibriVox volunteers
    "the-golden-lion-of-granpere": 6487,  # LibriVox volunteers
    "is-he-popenjoy": 6032,  # LibriVox volunteers
    "the-fixed-period": 4605,  # LibriVox volunteers
    "kept-in-the-dark": 3163,  # LibriVox volunteers
    "the-moorland-cottage": 8069,  # LibriVox volunteers
    "a-dark-nights-work": 9063,  # LibriVox volunteers
    "henrietta-temple": 5794,  # LibriVox volunteers
    "robert-falconer": 2692,  # solo
    "the-vicar-of-bullhampton": 5074,  # solo
    "tom-brown-at-oxford": 17525,  # LibriVox volunteers
    "mr-scarboroughs-family": 6951,  # LibriVox volunteers
    "the-hoosier-schoolmaster": 6803,  # solo
    "once-on-a-time": 3337,  # LibriVox volunteers
    "an-autobiography": 3114,  # solo
    "the-claverings": 5770,  # LibriVox volunteers
    "annals-of-a-quiet-neighbourhood": 7829,  # LibriVox volunteers
    "the-king-of-the-golden-river": 4036,  # solo
    "paul-clifford": 12751,  # solo
    "the-macdermots-of-ballycloran": 7864,  # LibriVox volunteers
    "the-caxtons": 15903,  # LibriVox volunteers
    "mopsa-the-fairy": 6688,  # solo
    "the-young-trailers": 6004,  # solo
    "the-moving-picture-girls": 2433,  # solo
    "aunt-janes-nieces-in-society": 7172,  # solo
    "the-phantom-ship": 21079,  # solo
    "fame-and-fortune": 1525,  # LibriVox volunteers
    "the-outdoor-girls-of-deepdale": 5561,  # LibriVox volunteers
    "aunt-janes-nieces-abroad": 3683,  # LibriVox volunteers
    "aunt-janes-nieces-at-millville": 4131,  # LibriVox volunteers
    "aunt-janes-nieces-at-work": 5579,  # LibriVox volunteers
    "snarleyyow": 8752,  # solo
    "the-tree-of-appomattox": 8800,  # LibriVox volunteers
    "peter-simple": 11965,  # LibriVox volunteers
    "ran-away-to-sea": 15301,  # LibriVox volunteers
    "the-rulers-of-the-lakes": 11067,  # solo
    "the-shades-of-the-wilderness": 8070,  # LibriVox volunteers
    "the-hunters-of-the-hills": 9519,  # LibriVox volunteers
    "the-shadow-of-the-north": 8005,  # solo
    "the-guns-of-bull-run": 6183,  # LibriVox volunteers
    "the-rock-of-chickamauga": 7664,  # LibriVox volunteers
    "the-sword-of-antietam": 7436,  # LibriVox volunteers
    "the-scouts-of-stonewall": 6713,  # LibriVox volunteers
    "the-guns-of-shiloh": 6091,  # LibriVox volunteers
    "osceola-the-seminole": 20122,  # LibriVox volunteers
    "the-headless-horseman": 5326,  # LibriVox volunteers
    "the-star-of-gettysburg": 4446,  # LibriVox volunteers
    "mark-the-match-boy": 12577,  # solo
    # 300 more public-domain titles (October 2026), ten replacements
    "the-adventures-of-pinocchio": 6787,  # solo
    "a-house-of-pomegranates": 6900,  # solo
    "south-sea-tales": 15528,  # solo
    "children-of-the-frost": 18260,  # LibriVox volunteers
    "love-of-life-and-other-stories": 20575,  # LibriVox volunteers
    "the-flying-inn": 20631,  # LibriVox volunteers
    "tales-of-terror-and-mystery": 925,  # LibriVox volunteers
    "the-singing-bone": 15935,  # solo
    "king-coal": 3116,  # solo
    "ragged-dick": 257,  # solo
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
        for r in s.get("readers") or []:
            # A few sections list a reader without a name; they can't be credited, so skip them.
            name = (r.get("display_name") or "").split(" (")[0].strip()
            if name and name not in names:
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
