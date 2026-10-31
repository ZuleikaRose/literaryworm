// The LiteraryWorm catalog's titles, for functions that need to know a catalog book.
// Copied from front_end/literaryworm_app/src/data/books.ts: keep the two in step
// when a title is added (any id not listed here is treated as a Google Books volume).

export type CatalogBook = { title: string; author: string; year: number; synopsis: string; publicDomain: boolean };

export const CATALOG: Record<string, CatalogBook> = {
  "the-midnight-library": {
    "title": "The Midnight Library",
    "author": "Matt Haig",
    "year": 2020,
    "synopsis": "Between life and death there is a library. When Nora Seed finds herself there, she discovers each book offers a chance to try another life she might have lived.",
    "publicDomain": false
  },
  "tomorrow": {
    "title": "Tomorrow, and Tomorrow, and Tomorrow",
    "author": "Gabrielle Zevin",
    "year": 2022,
    "synopsis": "Two friends, often in love but never lovers, come together as creative partners in the world of video game design.",
    "publicDomain": false
  },
  "dune": {
    "title": "Dune",
    "author": "Frank Herbert",
    "year": 1965,
    "synopsis": "Set on the desert planet Arrakis, Dune is the story of Paul Atreides and a destiny greater than he could ever have imagined.",
    "publicDomain": false
  },
  "educated": {
    "title": "Educated",
    "author": "Tara Westover",
    "year": 2018,
    "synopsis": "A memoir about a young woman who leaves her survivalist family and goes on to earn a PhD from Cambridge University.",
    "publicDomain": false
  },
  "circe": {
    "title": "Circe",
    "author": "Madeline Miller",
    "year": 2018,
    "synopsis": "A bold retelling of the goddess Circe's story: exile, transformation, and a life lived on her own terms.",
    "publicDomain": false
  },
  "atomic-habits": {
    "title": "Atomic Habits",
    "author": "James Clear",
    "year": 2018,
    "synopsis": "A practical guide to creating good habits, breaking bad ones, and mastering the tiny behaviors that lead to remarkable results.",
    "publicDomain": false
  },
  "sea-of-tranquility": {
    "title": "Sea of Tranquility",
    "author": "Emily St. John Mandel",
    "year": 2022,
    "synopsis": "A novel of art, time, love, and plague that takes the reader from Vancouver Island in 1912 to a dark colony on the moon.",
    "publicDomain": false
  },
  "babel": {
    "title": "Babel",
    "author": "R. F. Kuang",
    "year": 2022,
    "synopsis": "In an alternate 1830s Oxford, a translator-in-training learns that the magic powering the British Empire is built on languages taken from the places it rules.",
    "publicDomain": false
  },
  "project-hail-mary": {
    "title": "Project Hail Mary",
    "author": "Andy Weir",
    "year": 2021,
    "synopsis": "A science teacher wakes up alone on a spacecraft with no memory of how he got there, and slowly realises he may be humanity's last chance.",
    "publicDomain": false
  },
  "klara-and-the-sun": {
    "title": "Klara and the Sun",
    "author": "Kazuo Ishiguro",
    "year": 2021,
    "synopsis": "An Artificial Friend watches the world from a shop window, hoping to be chosen, and learns what it means to love someone.",
    "publicDomain": false
  },
  "the-wild-robot": {
    "title": "The Wild Robot",
    "author": "Peter Brown",
    "year": 2016,
    "synopsis": "When a robot named Roz washes up on a wild island, she has to learn from the animals how to survive, and how to belong.",
    "publicDomain": false
  },
  "the-hunger-games": {
    "title": "The Hunger Games",
    "author": "Suzanne Collins",
    "year": 2008,
    "synopsis": "In a nation built on the ruins of North America, sixteen-year-old Katniss Everdeen volunteers to take her sister's place in a televised fight to survive.",
    "publicDomain": false
  },
  "pride-and-prejudice": {
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "year": 1813,
    "synopsis": "Elizabeth Bennet and the proud Mr Darcy misjudge each other at every turn, in a sharp comedy about money, marriage and first impressions.",
    "publicDomain": true
  },
  "frankenstein": {
    "title": "Frankenstein",
    "author": "Mary Shelley",
    "year": 1818,
    "synopsis": "A young scientist brings a creature to life and then abandons it, setting off a chase across Europe and the Arctic ice.",
    "publicDomain": true
  },
  "sherlock-holmes": {
    "title": "The Adventures of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "year": 1892,
    "synopsis": "Twelve cases for the detective of Baker Street and his friend Dr Watson, from a red-headed league to a speckled band.",
    "publicDomain": true
  },
  "alice-in-wonderland": {
    "title": "Alice's Adventures in Wonderland",
    "author": "Lewis Carroll",
    "year": 1865,
    "synopsis": "Alice follows a white rabbit down a hole into a world of shrinking potions, mad tea parties and a queen who wants everyone's head.",
    "publicDomain": true
  },
  "the-secret-garden": {
    "title": "The Secret Garden",
    "author": "Frances Hodgson Burnett",
    "year": 1911,
    "synopsis": "Sent to live in a gloomy Yorkshire manor, Mary Lennox finds a key to a locked garden and brings it, and herself, back to life.",
    "publicDomain": true
  },
  "the-wind-in-the-willows": {
    "title": "The Wind in the Willows",
    "author": "Kenneth Grahame",
    "year": 1908,
    "synopsis": "Mole, Rat, Badger and the reckless Mr Toad mess about in boats, get lost in the Wild Wood and take back Toad Hall.",
    "publicDomain": true
  },
  "treasure-island": {
    "title": "Treasure Island",
    "author": "Robert Louis Stevenson",
    "year": 1883,
    "synopsis": "Young Jim Hawkins finds a map to buried gold and sails with a crew that includes the charming, dangerous Long John Silver.",
    "publicDomain": true
  },
  "little-women": {
    "title": "Little Women",
    "author": "Louisa May Alcott",
    "year": 1868,
    "synopsis": "Meg, Jo, Beth and Amy March grow up through hard winters and small joys while their father is away at war.",
    "publicDomain": true
  },
  "the-time-machine": {
    "title": "The Time Machine",
    "author": "H. G. Wells",
    "year": 1895,
    "synopsis": "A Victorian inventor travels eight hundred thousand years ahead and finds humanity split into two very different species.",
    "publicDomain": true
  },
  "moby-dick": {
    "title": "Moby-Dick",
    "author": "Herman Melville",
    "year": 1851,
    "synopsis": "Ishmael signs on to the whaler Pequod and learns too late that Captain Ahab means to hunt one white whale at any cost.",
    "publicDomain": true
  },
  "dracula": {
    "title": "Dracula",
    "author": "Bram Stoker",
    "year": 1897,
    "synopsis": "Told in letters and diaries, a group of friends tracks a centuries-old count from Transylvania to the streets of London.",
    "publicDomain": true
  },
  "jane-eyre": {
    "title": "Jane Eyre",
    "author": "Charlotte Brontë",
    "year": 1847,
    "synopsis": "An orphaned governess at Thornfield Hall falls for her employer, Mr Rochester, and discovers the secret kept in the attic.",
    "publicDomain": true
  },
  "peter-pan": {
    "title": "Peter Pan",
    "author": "J. M. Barrie",
    "year": 1911,
    "synopsis": "Wendy, John and Michael fly out of their nursery window to Neverland with the boy who won't grow up.",
    "publicDomain": true
  },
  "anne-of-green-gables": {
    "title": "Anne of Green Gables",
    "author": "L. M. Montgomery",
    "year": 1908,
    "synopsis": "A talkative, red-haired orphan arrives at a Prince Edward Island farm that was expecting a boy, and stays to win everyone over.",
    "publicDomain": true
  },
  "the-great-gatsby": {
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "year": 1925,
    "synopsis": "Nick Carraway watches his mysterious neighbour throw dazzling parties on Long Island, all to win back one woman across the bay.",
    "publicDomain": true
  },
  "the-metamorphosis": {
    "title": "The Metamorphosis",
    "author": "Franz Kafka",
    "year": 1915,
    "synopsis": "Gregor Samsa wakes one morning transformed into an enormous insect, and his family must decide what he still is to them.",
    "publicDomain": true
  },
  "the-odyssey": {
    "title": "The Odyssey",
    "author": "Homer",
    "year": 1900,
    "synopsis": "After the fall of Troy, Odysseus spends ten years trying to get home to Ithaca, past monsters, gods and his own pride.",
    "publicDomain": true
  },
  "a-christmas-carol": {
    "title": "A Christmas Carol",
    "author": "Charles Dickens",
    "year": 1843,
    "synopsis": "On Christmas Eve the miser Ebenezer Scrooge is visited by his old partner's ghost and three spirits who show him his past, present and future.",
    "publicDomain": true
  },
  "the-call-of-the-wild": {
    "title": "The Call of the Wild",
    "author": "Jack London",
    "year": 1903,
    "synopsis": "Buck, a big house dog stolen from California, is sold into the hard life of a sled dog in the Yukon and learns to answer the wild.",
    "publicDomain": true
  },
  "the-picture-of-dorian-gray": {
    "title": "The Picture of Dorian Gray",
    "author": "Oscar Wilde",
    "year": 1891,
    "synopsis": "A beautiful young man wishes that his portrait would age instead of him, and the painting begins to show every sin he commits.",
    "publicDomain": true
  },
  "the-wonderful-wizard-of-oz": {
    "title": "The Wonderful Wizard of Oz",
    "author": "L. Frank Baum",
    "year": 1900,
    "synopsis": "A Kansas cyclone carries Dorothy to the land of Oz, where she follows the yellow brick road with a Scarecrow, a Tin Woodman and a Cowardly Lion.",
    "publicDomain": true
  },
  "emma": {
    "title": "Emma",
    "author": "Jane Austen",
    "year": 1815,
    "synopsis": "Clever, comfortable Emma Woodhouse is sure she knows best whom everyone in Highbury should marry, until her matchmaking goes wrong.",
    "publicDomain": true
  },
  "sense-and-sensibility": {
    "title": "Sense and Sensibility",
    "author": "Jane Austen",
    "year": 1811,
    "synopsis": "Two sisters, one guarded and one ruled by her heart, face love, money and heartbreak after their family loses its home.",
    "publicDomain": true
  },
  "persuasion": {
    "title": "Persuasion",
    "author": "Jane Austen",
    "year": 1817,
    "synopsis": "Eight years after she was talked out of marrying him, Anne Elliot meets Captain Wentworth again, now a rich and admired naval officer.",
    "publicDomain": true
  },
  "northanger-abbey": {
    "title": "Northanger Abbey",
    "author": "Jane Austen",
    "year": 1817,
    "synopsis": "Catherine Morland has read too many gothic novels, and a visit to a real abbey sets her imagination running far ahead of the facts.",
    "publicDomain": true
  },
  "wuthering-heights": {
    "title": "Wuthering Heights",
    "author": "Emily Brontë",
    "year": 1847,
    "synopsis": "On the Yorkshire moors, the foundling Heathcliff and Catherine Earnshaw share a love so fierce it poisons two families for a generation.",
    "publicDomain": true
  },
  "great-expectations": {
    "title": "Great Expectations",
    "author": "Charles Dickens",
    "year": 1861,
    "synopsis": "Pip, an orphan apprenticed to a blacksmith, is suddenly given a fortune by an unknown benefactor and sent to London to become a gentleman.",
    "publicDomain": true
  },
  "a-tale-of-two-cities": {
    "title": "A Tale of Two Cities",
    "author": "Charles Dickens",
    "year": 1859,
    "synopsis": "Lives in London and Paris are pulled into the French Revolution, where a debt of love is repaid at the foot of the guillotine.",
    "publicDomain": true
  },
  "the-adventures-of-tom-sawyer": {
    "title": "The Adventures of Tom Sawyer",
    "author": "Mark Twain",
    "year": 1876,
    "synopsis": "Tom Sawyer whitewashes fences, plays pirate on the Mississippi and witnesses a murder in a small river town.",
    "publicDomain": true
  },
  "adventures-of-huckleberry-finn": {
    "title": "Adventures of Huckleberry Finn",
    "author": "Mark Twain",
    "year": 1884,
    "synopsis": "Huck escapes his father and rafts down the Mississippi with Jim, a man fleeing slavery, in a journey that tests everything Huck was taught.",
    "publicDomain": true
  },
  "the-war-of-the-worlds": {
    "title": "The War of the Worlds",
    "author": "H. G. Wells",
    "year": 1898,
    "synopsis": "Martian cylinders land in Surrey, and their fighting machines march across England while a narrator struggles to survive.",
    "publicDomain": true
  },
  "the-invisible-man": {
    "title": "The Invisible Man",
    "author": "H. G. Wells",
    "year": 1897,
    "synopsis": "A bandaged stranger arrives at a village inn in winter, hiding the secret of a discovery that is slowly driving him mad.",
    "publicDomain": true
  },
  "the-island-of-doctor-moreau": {
    "title": "The Island of Doctor Moreau",
    "author": "H. G. Wells",
    "year": 1896,
    "synopsis": "A shipwrecked man is left on a remote island where a banished scientist shapes animals into the likeness of people.",
    "publicDomain": true
  },
  "twenty-thousand-leagues-under-the-sea": {
    "title": "Twenty Thousand Leagues Under the Sea",
    "author": "Jules Verne",
    "year": 1870,
    "synopsis": "A naturalist and his companions are taken aboard Captain Nemo's submarine, the Nautilus, for a voyage through the world's oceans.",
    "publicDomain": true
  },
  "the-hound-of-the-baskervilles": {
    "title": "The Hound of the Baskervilles",
    "author": "Arthur Conan Doyle",
    "year": 1902,
    "synopsis": "Sherlock Holmes and Dr Watson investigate the legend of a spectral hound said to haunt the Baskerville family on Dartmoor.",
    "publicDomain": true
  },
  "a-study-in-scarlet": {
    "title": "A Study in Scarlet",
    "author": "Arthur Conan Doyle",
    "year": 1887,
    "synopsis": "Dr Watson meets Sherlock Holmes, and their first case begins with a body in an empty house and a word written in blood.",
    "publicDomain": true
  },
  "the-sign-of-the-four": {
    "title": "The Sign of the Four",
    "author": "Arthur Conan Doyle",
    "year": 1890,
    "synopsis": "A young woman receives a pearl every year from an unknown sender, and Holmes follows the trail to stolen treasure and a chase on the Thames.",
    "publicDomain": true
  },
  "dr-jekyll-and-mr-hyde": {
    "title": "Strange Case of Dr Jekyll and Mr Hyde",
    "author": "Robert Louis Stevenson",
    "year": 1886,
    "synopsis": "A London lawyer investigates the link between his respectable friend Dr Jekyll and the brutal Mr Hyde.",
    "publicDomain": true
  },
  "kidnapped": {
    "title": "Kidnapped",
    "author": "Robert Louis Stevenson",
    "year": 1886,
    "synopsis": "Cheated of his inheritance and sold onto a ship, young David Balfour escapes across the Scottish Highlands with the outlaw Alan Breck.",
    "publicDomain": true
  },
  "the-jungle-book": {
    "title": "The Jungle Book",
    "author": "Rudyard Kipling",
    "year": 1894,
    "synopsis": "Mowgli, raised by wolves, learns the law of the jungle from Baloo and Bagheera while the tiger Shere Khan waits for him.",
    "publicDomain": true
  },
  "heart-of-darkness": {
    "title": "Heart of Darkness",
    "author": "Joseph Conrad",
    "year": 1899,
    "synopsis": "Marlow travels up the Congo River in search of Kurtz, an ivory trader whose station has become a place of horror.",
    "publicDomain": true
  },
  "the-scarlet-letter": {
    "title": "The Scarlet Letter",
    "author": "Nathaniel Hawthorne",
    "year": 1850,
    "synopsis": "In Puritan Boston, Hester Prynne is made to wear a scarlet A and refuses to name the father of her child.",
    "publicDomain": true
  },
  "the-last-of-the-mohicans": {
    "title": "The Last of the Mohicans",
    "author": "James Fenimore Cooper",
    "year": 1826,
    "synopsis": "During the French and Indian War, the scout Hawkeye and his Mohican friends guide two sisters through the frontier wilderness.",
    "publicDomain": true
  },
  "robinson-crusoe": {
    "title": "Robinson Crusoe",
    "author": "Daniel Defoe",
    "year": 1719,
    "synopsis": "Shipwrecked alone on an island, a sailor builds a life from what he can salvage, for twenty-eight years.",
    "publicDomain": true
  },
  "gullivers-travels": {
    "title": "Gulliver's Travels",
    "author": "Jonathan Swift",
    "year": 1726,
    "synopsis": "A ship's surgeon is washed up among tiny people, giants, floating scientists and wise horses, in a satire on human nature.",
    "publicDomain": true
  },
  "heidi": {
    "title": "Heidi",
    "author": "Johanna Spyri",
    "year": 1881,
    "synopsis": "An orphan girl is sent to live with her grandfather in the Swiss Alps, and is heartbroken when she is taken away to the city.",
    "publicDomain": true
  },
  "the-railway-children": {
    "title": "The Railway Children",
    "author": "E. Nesbit",
    "year": 1906,
    "synopsis": "When their father is taken away, three children move to the country with their mother and make friends with the railway that runs past their house.",
    "publicDomain": true
  },
  "a-little-princess": {
    "title": "A Little Princess",
    "author": "Frances Hodgson Burnett",
    "year": 1905,
    "synopsis": "Sara Crewe goes from favoured pupil to servant in a London boarding school, but keeps her kindness and imagination.",
    "publicDomain": true
  },
  "five-children-and-it": {
    "title": "Five Children and It",
    "author": "E. Nesbit",
    "year": 1902,
    "synopsis": "Five children dig up a grumpy sand-fairy who grants a wish a day, and every wish goes wrong by sunset.",
    "publicDomain": true
  },
  "the-princess-and-the-goblin": {
    "title": "The Princess and the Goblin",
    "author": "George MacDonald",
    "year": 1872,
    "synopsis": "Princess Irene and Curdie, a miner's son, discover that the goblins under the mountain are plotting against her father's kingdom.",
    "publicDomain": true
  },
  "through-the-looking-glass": {
    "title": "Through the Looking-Glass",
    "author": "Lewis Carroll",
    "year": 1871,
    "synopsis": "Alice climbs through the mirror into a land laid out like a chessboard, and sets out to become a queen.",
    "publicDomain": true
  },
  "the-prince-and-the-pauper": {
    "title": "The Prince and the Pauper",
    "author": "Mark Twain",
    "year": 1881,
    "synopsis": "A London beggar boy and the young Prince Edward swap clothes for fun, and find they can't swap back.",
    "publicDomain": true
  },
  "silas-marner": {
    "title": "Silas Marner",
    "author": "George Eliot",
    "year": 1861,
    "synopsis": "A lonely weaver robbed of his gold finds a little girl on his hearth, and his life begins again.",
    "publicDomain": true
  },
  "cranford": {
    "title": "Cranford",
    "author": "Elizabeth Gaskell",
    "year": 1853,
    "synopsis": "In a small town run by genteel ladies of modest means, kindness and gossip carry them through hard times.",
    "publicDomain": true
  },
  "the-turn-of-the-screw": {
    "title": "The Turn of the Screw",
    "author": "Henry James",
    "year": 1898,
    "synopsis": "A governess at a remote country house becomes convinced that two ghosts are reaching for the children in her care.",
    "publicDomain": true
  },
  "the-age-of-innocence": {
    "title": "The Age of Innocence",
    "author": "Edith Wharton",
    "year": 1920,
    "synopsis": "In 1870s New York society, Newland Archer is engaged to the proper May Welland when her unconventional cousin Ellen returns from Europe.",
    "publicDomain": true
  },
  "the-awakening": {
    "title": "The Awakening",
    "author": "Kate Chopin",
    "year": 1899,
    "synopsis": "On a summer holiday on the Gulf coast, Edna Pontellier begins to question the life expected of a wife and mother.",
    "publicDomain": true
  },
  "ethan-frome": {
    "title": "Ethan Frome",
    "author": "Edith Wharton",
    "year": 1911,
    "synopsis": "In a snowbound New England village, a poor farmer tied to a sickly wife falls in love with her young cousin.",
    "publicDomain": true
  },
  "the-red-badge-of-courage": {
    "title": "The Red Badge of Courage",
    "author": "Stephen Crane",
    "year": 1895,
    "synopsis": "A young Union soldier runs from his first battle in the American Civil War and struggles with what it means to be brave.",
    "publicDomain": true
  },
  "the-man-who-was-thursday": {
    "title": "The Man Who Was Thursday",
    "author": "G. K. Chesterton",
    "year": 1908,
    "synopsis": "A poet turned detective infiltrates a council of anarchists, each named for a day of the week, in a dreamlike comic thriller.",
    "publicDomain": true
  },
  "the-phantom-of-the-opera": {
    "title": "The Phantom of the Opera",
    "author": "Gaston Leroux",
    "year": 1910,
    "synopsis": "A masked genius haunts the Paris Opera House and falls obsessively in love with the young singer Christine Daaé.",
    "publicDomain": true
  },
  "king-solomons-mines": {
    "title": "King Solomon's Mines",
    "author": "H. Rider Haggard",
    "year": 1885,
    "synopsis": "Allan Quatermain leads a search across desert and mountains for a lost brother and a legendary treasure.",
    "publicDomain": true
  },
  "the-prisoner-of-zenda": {
    "title": "The Prisoner of Zenda",
    "author": "Anthony Hope",
    "year": 1894,
    "synopsis": "An English gentleman who looks just like the king of Ruritania takes his place when the king is kidnapped before his coronation.",
    "publicDomain": true
  },
  "a-room-with-a-view": {
    "title": "A Room with a View",
    "author": "E. M. Forster",
    "year": 1908,
    "synopsis": "A young Englishwoman on holiday in Florence meets the unconventional George Emerson and has to choose between him and propriety.",
    "publicDomain": true
  },
  "autobiography-of-benjamin-franklin": {
    "title": "The Autobiography of Benjamin Franklin",
    "author": "Benjamin Franklin",
    "year": 1791,
    "synopsis": "A printer's apprentice tells how he became a writer, scientist and statesman, with his rules for a well-ordered life.",
    "publicDomain": true
  },
  "pinocchio": {
    "title": "The Adventures of Pinocchio",
    "author": "Carlo Collodi",
    "year": 1883,
    "synopsis": "A wooden puppet who longs to be a real boy keeps landing in trouble, and his nose gives away every lie.",
    "publicDomain": true
  },
  "rebecca-of-sunnybrook-farm": {
    "title": "Rebecca of Sunnybrook Farm",
    "author": "Kate Douglas Wiggin",
    "year": 1903,
    "synopsis": "Bright, talkative Rebecca goes to live with her two strict aunts in Maine and slowly wins over the whole town.",
    "publicDomain": true
  },
  "pollyanna": {
    "title": "Pollyanna",
    "author": "Eleanor H. Porter",
    "year": 1913,
    "synopsis": "An orphan sent to her stern aunt plays the glad game, finding something to be glad about in everything, and changes a whole town.",
    "publicDomain": true
  },
  "white-fang": {
    "title": "White Fang",
    "author": "Jack London",
    "year": 1906,
    "synopsis": "Born in the wild during the Klondike gold rush, a wolf-dog is shaped by cruelty and, at last, by kindness.",
    "publicDomain": true
  },
  "the-sea-wolf": {
    "title": "The Sea-Wolf",
    "author": "Jack London",
    "year": 1904,
    "synopsis": "A gentleman critic is rescued from a shipwreck by Wolf Larsen, the brutal and brilliant captain of a sealing schooner.",
    "publicDomain": true
  },
  "the-scarlet-pimpernel": {
    "title": "The Scarlet Pimpernel",
    "author": "Baroness Orczy",
    "year": 1905,
    "synopsis": "During the Terror, a mysterious Englishman smuggles French aristocrats away from the guillotine, and no one suspects the foppish Sir Percy.",
    "publicDomain": true
  }
};
