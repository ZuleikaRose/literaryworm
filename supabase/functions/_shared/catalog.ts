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
  },
  "agnes-grey": {
    "title": "Agnes Grey",
    "author": "Anne Brontë",
    "year": 1847,
    "synopsis": "A clergyman's daughter becomes a governess to two spoilt families and holds on to her principles and her hope of love.",
    "publicDomain": true
  },
  "mansfield-park": {
    "title": "Mansfield Park",
    "author": "Jane Austen",
    "year": 1814,
    "synopsis": "Shy Fanny Price, raised by rich relatives at Mansfield Park, watches quietly as charming visitors from London unsettle the household.",
    "publicDomain": true
  },
  "dombey-and-son": {
    "title": "Dombey and Son",
    "author": "Charles Dickens",
    "year": 1848,
    "synopsis": "A proud London merchant cares only for his son and heir, and overlooks the loving daughter who might save him.",
    "publicDomain": true
  },
  "the-old-curiosity-shop": {
    "title": "The Old Curiosity Shop",
    "author": "Charles Dickens",
    "year": 1841,
    "synopsis": "Little Nell and her grandfather flee London and the grasping moneylender Quilp, wandering the roads of England.",
    "publicDomain": true
  },
  "the-mystery-of-edwin-drood": {
    "title": "The Mystery of Edwin Drood",
    "author": "Charles Dickens",
    "year": 1870,
    "synopsis": "In a cathedral town, young Edwin Drood vanishes one stormy Christmas Eve, in the novel Dickens never lived to finish.",
    "publicDomain": true
  },
  "the-chimes": {
    "title": "The Chimes",
    "author": "Charles Dickens",
    "year": 1844,
    "synopsis": "On New Year's Eve, a poor ticket-porter is shown by the spirits of the church bells what the year ahead could hold.",
    "publicDomain": true
  },
  "north-and-south": {
    "title": "North and South",
    "author": "Elizabeth Gaskell",
    "year": 1855,
    "synopsis": "Margaret Hale moves from the gentle south of England to an industrial northern town and clashes with the mill owner John Thornton.",
    "publicDomain": true
  },
  "wives-and-daughters": {
    "title": "Wives and Daughters",
    "author": "Elizabeth Gaskell",
    "year": 1866,
    "synopsis": "Molly Gibson's quiet life in a country town changes when her father marries a vain widow with a dazzling daughter.",
    "publicDomain": true
  },
  "sylvias-lovers": {
    "title": "Sylvia's Lovers",
    "author": "Elizabeth Gaskell",
    "year": 1863,
    "synopsis": "In a Yorkshire whaling port during the Napoleonic wars, Sylvia is torn between a dashing harpooner and her devoted cousin.",
    "publicDomain": true
  },
  "the-mayor-of-casterbridge": {
    "title": "The Mayor of Casterbridge",
    "author": "Thomas Hardy",
    "year": 1886,
    "synopsis": "A young man sells his wife at a country fair in a drunken rage, then rises to become mayor, until his past comes back.",
    "publicDomain": true
  },
  "jude-the-obscure": {
    "title": "Jude the Obscure",
    "author": "Thomas Hardy",
    "year": 1895,
    "synopsis": "A stonemason dreams of studying at Christminster, but class, marriage and his love for his cousin Sue stand in the way.",
    "publicDomain": true
  },
  "the-woodlanders": {
    "title": "The Woodlanders",
    "author": "Thomas Hardy",
    "year": 1887,
    "synopsis": "A timber merchant's educated daughter returns to her woodland village and must choose between a loyal woodsman and a restless doctor.",
    "publicDomain": true
  },
  "daniel-deronda": {
    "title": "Daniel Deronda",
    "author": "George Eliot",
    "year": 1876,
    "synopsis": "The proud Gwendolen Harleth makes a loveless marriage, while Daniel Deronda searches for his own past and purpose.",
    "publicDomain": true
  },
  "the-warden": {
    "title": "The Warden",
    "author": "Anthony Trollope",
    "year": 1855,
    "synopsis": "A gentle clergyman's comfortable income from a charity becomes a public scandal in the cathedral town of Barchester.",
    "publicDomain": true
  },
  "barchester-towers": {
    "title": "Barchester Towers",
    "author": "Anthony Trollope",
    "year": 1857,
    "synopsis": "A new bishop, his formidable wife and his oily chaplain throw the clergy of Barchester into a comic battle for power.",
    "publicDomain": true
  },
  "doctor-thorne": {
    "title": "Doctor Thorne",
    "author": "Anthony Trollope",
    "year": 1858,
    "synopsis": "The heir to a debt-ridden estate is told to marry money, but he loves the doctor's niece, who has none.",
    "publicDomain": true
  },
  "can-you-forgive-her": {
    "title": "Can You Forgive Her?",
    "author": "Anthony Trollope",
    "year": 1865,
    "synopsis": "Alice Vavasor wavers between a steady suitor and her reckless cousin, in the first of Trollope's political novels.",
    "publicDomain": true
  },
  "the-way-we-live-now": {
    "title": "The Way We Live Now",
    "author": "Anthony Trollope",
    "year": 1875,
    "synopsis": "A mysterious financier dazzles London society with a railway scheme, in a satire of greed and speculation.",
    "publicDomain": true
  },
  "vanity-fair": {
    "title": "Vanity Fair",
    "author": "William Makepeace Thackeray",
    "year": 1848,
    "synopsis": "Clever, penniless Becky Sharp schemes her way up through English society during the Napoleonic wars.",
    "publicDomain": true
  },
  "framley-parsonage": {
    "title": "Framley Parsonage",
    "author": "Anthony Trollope",
    "year": 1861,
    "synopsis": "An ambitious young vicar falls in with fashionable friends and debts, while his sister falls in love with a lord.",
    "publicDomain": true
  },
  "kenilworth": {
    "title": "Kenilworth",
    "author": "Walter Scott",
    "year": 1821,
    "synopsis": "The Earl of Leicester hides his marriage to Amy Robsart while courting the favour of Queen Elizabeth.",
    "publicDomain": true
  },
  "the-first-men-in-the-moon": {
    "title": "The First Men in the Moon",
    "author": "H. G. Wells",
    "year": 1901,
    "synopsis": "A businessman and an eccentric scientist fly to the Moon in a sphere and find a civilisation living beneath its surface.",
    "publicDomain": true
  },
  "the-wrong-box": {
    "title": "The Wrong Box",
    "author": "Robert Louis Stevenson",
    "year": 1889,
    "synopsis": "Two brothers are the last survivors of a lucrative wager, and a mislaid body sets off a farce of mistaken barrels and boxes.",
    "publicDomain": true
  },
  "kipps": {
    "title": "Kipps",
    "author": "H. G. Wells",
    "year": 1905,
    "synopsis": "A draper's assistant inherits a fortune and tries, awkwardly, to become a gentleman.",
    "publicDomain": true
  },
  "the-valley-of-fear": {
    "title": "The Valley of Fear",
    "author": "Arthur Conan Doyle",
    "year": 1915,
    "synopsis": "Sherlock Holmes investigates a murder at a moated manor house, and the trail leads back to a secret society in an American mining valley.",
    "publicDomain": true
  },
  "michael-strogoff": {
    "title": "Michael Strogoff",
    "author": "Jules Verne",
    "year": 1876,
    "synopsis": "A courier of the Tsar races across Siberia, through rebel armies, to carry a warning to the Grand Duke in Irkutsk.",
    "publicDomain": true
  },
  "the-poison-belt": {
    "title": "The Poison Belt",
    "author": "Arthur Conan Doyle",
    "year": 1913,
    "synopsis": "Professor Challenger and his companions seal themselves in a room as the Earth passes through a belt of poisonous ether.",
    "publicDomain": true
  },
  "the-white-company": {
    "title": "The White Company",
    "author": "Arthur Conan Doyle",
    "year": 1891,
    "synopsis": "A young man raised by monks joins a company of English archers fighting in France and Spain in the Hundred Years' War.",
    "publicDomain": true
  },
  "a-connecticut-yankee-in-king-arthurs": {
    "title": "A Connecticut Yankee in King Arthur's Court",
    "author": "Mark Twain",
    "year": 1889,
    "synopsis": "A factory superintendent is knocked out and wakes in Camelot, where he sets about bringing the nineteenth century to King Arthur.",
    "publicDomain": true
  },
  "tom-sawyer-abroad": {
    "title": "Tom Sawyer Abroad",
    "author": "Mark Twain",
    "year": 1894,
    "synopsis": "Tom, Huck and Jim are carried off in an airship over the Sahara and on to Egypt.",
    "publicDomain": true
  },
  "martin-eden": {
    "title": "Martin Eden",
    "author": "Jack London",
    "year": 1909,
    "synopsis": "A rough young sailor falls in love with an educated woman and teaches himself to become a writer.",
    "publicDomain": true
  },
  "burning-daylight": {
    "title": "Burning Daylight",
    "author": "Jack London",
    "year": 1910,
    "synopsis": "A Klondike gold-rush hero takes his fortune to San Francisco and plays the financiers at their own game.",
    "publicDomain": true
  },
  "the-people-of-the-abyss": {
    "title": "The People of the Abyss",
    "author": "Jack London",
    "year": 1903,
    "synopsis": "Jack London lives among the poor of London's East End and reports what he sees.",
    "publicDomain": true
  },
  "the-pathfinder": {
    "title": "The Pathfinder",
    "author": "James Fenimore Cooper",
    "year": 1840,
    "synopsis": "The scout Natty Bumppo guides a sergeant's daughter to a fort on Lake Ontario during the French and Indian War.",
    "publicDomain": true
  },
  "tarzan-of-the-apes": {
    "title": "Tarzan of the Apes",
    "author": "Edgar Rice Burroughs",
    "year": 1912,
    "synopsis": "An English lord's orphaned son is raised by apes in the African jungle, until the first white strangers arrive on his shore.",
    "publicDomain": true
  },
  "the-return-of-tarzan": {
    "title": "The Return of Tarzan",
    "author": "Edgar Rice Burroughs",
    "year": 1913,
    "synopsis": "Tarzan travels to Paris and North Africa before returning to the jungle and the lost city of Opar.",
    "publicDomain": true
  },
  "the-beasts-of-tarzan": {
    "title": "The Beasts of Tarzan",
    "author": "Edgar Rice Burroughs",
    "year": 1914,
    "synopsis": "When his son is kidnapped, Tarzan gathers an army of jungle animals to hunt the kidnappers.",
    "publicDomain": true
  },
  "the-son-of-tarzan": {
    "title": "The Son of Tarzan",
    "author": "Edgar Rice Burroughs",
    "year": 1915,
    "synopsis": "Tarzan's son Jack runs away to Africa and makes his own life in the jungle.",
    "publicDomain": true
  },
  "the-land-that-time-forgot": {
    "title": "The Land That Time Forgot",
    "author": "Edgar Rice Burroughs",
    "year": 1918,
    "synopsis": "The crew of a captured submarine finds a lost island where dinosaurs and early humans still live.",
    "publicDomain": true
  },
  "dorothy-and-the-wizard-in-oz": {
    "title": "Dorothy and the Wizard in Oz",
    "author": "L. Frank Baum",
    "year": 1908,
    "synopsis": "An earthquake drops Dorothy, her cousin and a kitten into an underground land, where they meet the Wizard again.",
    "publicDomain": true
  },
  "the-lost-princess-of-oz": {
    "title": "The Lost Princess of Oz",
    "author": "L. Frank Baum",
    "year": 1917,
    "synopsis": "Princess Ozma vanishes, and Dorothy and her friends search all of Oz for her.",
    "publicDomain": true
  },
  "the-tin-woodman-of-oz": {
    "title": "The Tin Woodman of Oz",
    "author": "L. Frank Baum",
    "year": 1918,
    "synopsis": "The Tin Woodman sets out to find the girl he loved when he was made of flesh.",
    "publicDomain": true
  },
  "the-scarecrow-of-oz": {
    "title": "The Scarecrow of Oz",
    "author": "L. Frank Baum",
    "year": 1915,
    "synopsis": "Trot and Cap'n Bill are swept into a whirlpool and on to Oz, where the Scarecrow helps them free a kingdom.",
    "publicDomain": true
  },
  "rinkitink-in-oz": {
    "title": "Rinkitink in Oz",
    "author": "L. Frank Baum",
    "year": 1916,
    "synopsis": "Young Prince Inga, the merry King Rinkitink and a grumpy goat set out to rescue Inga's captured family.",
    "publicDomain": true
  },
  "anne-of-the-island": {
    "title": "Anne of the Island",
    "author": "L. M. Montgomery",
    "year": 1915,
    "synopsis": "Anne Shirley leaves Avonlea for college in Kingsport, and Gilbert Blythe isn't far behind.",
    "publicDomain": true
  },
  "anne-of-avonlea": {
    "title": "Anne of Avonlea",
    "author": "L. M. Montgomery",
    "year": 1909,
    "synopsis": "Sixteen-year-old Anne becomes Avonlea's schoolteacher and takes in a pair of orphaned twins.",
    "publicDomain": true
  },
  "glinda-of-oz": {
    "title": "Glinda of Oz",
    "author": "L. Frank Baum",
    "year": 1920,
    "synopsis": "Dorothy and Ozma try to stop a war between two peoples and end up trapped on a sunken island.",
    "publicDomain": true
  },
  "annes-house-of-dreams": {
    "title": "Anne's House of Dreams",
    "author": "L. M. Montgomery",
    "year": 1917,
    "synopsis": "Newly married, Anne and Gilbert make their first home in a little house by the sea at Four Winds Harbour.",
    "publicDomain": true
  },
  "rainbow-valley": {
    "title": "Rainbow Valley",
    "author": "L. M. Montgomery",
    "year": 1919,
    "synopsis": "Anne's children make friends with the motherless children of the new minister in Glen St. Mary.",
    "publicDomain": true
  },
  "little-lord-fauntleroy": {
    "title": "Little Lord Fauntleroy",
    "author": "Frances Hodgson Burnett",
    "year": 1886,
    "synopsis": "A poor New York boy learns he is heir to an English earldom, and his kindness softens his bitter grandfather.",
    "publicDomain": true
  },
  "the-lost-prince": {
    "title": "The Lost Prince",
    "author": "Frances Hodgson Burnett",
    "year": 1915,
    "synopsis": "A boy and his crippled friend cross Europe carrying a secret sign for the people waiting for their lost prince.",
    "publicDomain": true
  },
  "the-shuttle": {
    "title": "The Shuttle",
    "author": "Frances Hodgson Burnett",
    "year": 1907,
    "synopsis": "An American heiress goes to England to rescue her sister from a cruel aristocratic husband.",
    "publicDomain": true
  },
  "under-the-lilacs": {
    "title": "Under the Lilacs",
    "author": "Louisa May Alcott",
    "year": 1878,
    "synopsis": "Two sisters find a runaway circus boy and his clever dog sleeping in their garden.",
    "publicDomain": true
  },
  "jack-and-jill": {
    "title": "Jack and Jill",
    "author": "Louisa May Alcott",
    "year": 1880,
    "synopsis": "After a sledging accident, two friends spend a long winter recovering, and their village rallies round them.",
    "publicDomain": true
  },
  "the-story-of-the-amulet": {
    "title": "The Story of the Amulet",
    "author": "E. Nesbit",
    "year": 1906,
    "synopsis": "The Psammead returns, and with half of an ancient amulet the children travel through time to find the missing half.",
    "publicDomain": true
  },
  "the-enchanted-castle": {
    "title": "The Enchanted Castle",
    "author": "E. Nesbit",
    "year": 1907,
    "synopsis": "Three children find a girl asleep in a castle garden and a ring that really is magic.",
    "publicDomain": true
  },
  "the-story-of-the-treasure-seekers": {
    "title": "The Story of the Treasure Seekers",
    "author": "E. Nesbit",
    "year": 1899,
    "synopsis": "The six Bastable children try every scheme they can think of to restore the family fortunes.",
    "publicDomain": true
  },
  "the-magic-city": {
    "title": "The Magic City",
    "author": "E. Nesbit",
    "year": 1910,
    "synopsis": "Philip builds a city of toys and books, and finds himself inside it on a quest to save it.",
    "publicDomain": true
  },
  "peter-pan-in-kensington-gardens": {
    "title": "Peter Pan in Kensington Gardens",
    "author": "J. M. Barrie",
    "year": 1906,
    "synopsis": "Baby Peter Pan flies out of his nursery to live in Kensington Gardens among the fairies and birds.",
    "publicDomain": true
  },
  "at-the-back-of-the-north-wind": {
    "title": "At the Back of the North Wind",
    "author": "George MacDonald",
    "year": 1871,
    "synopsis": "A coachman's son, Diamond, is carried through the night by the beautiful North Wind.",
    "publicDomain": true
  },
  "the-princess-and-curdie": {
    "title": "The Princess and Curdie",
    "author": "George MacDonald",
    "year": 1883,
    "synopsis": "Curdie is sent to the king's city, where the court is corrupt and the king is being slowly poisoned.",
    "publicDomain": true
  },
  "tom-browns-school-days": {
    "title": "Tom Brown's School Days",
    "author": "Thomas Hughes",
    "year": 1857,
    "synopsis": "Tom Brown arrives at Rugby School, faces the bully Flashman and grows up among friends.",
    "publicDomain": true
  },
  "the-phoenix-and-the-carpet": {
    "title": "The Phoenix and the Carpet",
    "author": "E. Nesbit",
    "year": 1904,
    "synopsis": "A carpet bought for the nursery holds a phoenix egg, and the carpet can fly anywhere the children wish.",
    "publicDomain": true
  },
  "pollyanna-grows-up": {
    "title": "Pollyanna Grows Up",
    "author": "Eleanor H. Porter",
    "year": 1915,
    "synopsis": "Pollyanna spends a winter in Boston, cheering a lonely widow, and grows into a young woman.",
    "publicDomain": true
  },
  "what-katy-did-at-school": {
    "title": "What Katy Did at School",
    "author": "Susan Coolidge",
    "year": 1873,
    "synopsis": "Katy and her sister Clover go to boarding school in New England, with its rules, friendships and pranks.",
    "publicDomain": true
  },
  "what-katy-did": {
    "title": "What Katy Did",
    "author": "Susan Coolidge",
    "year": 1872,
    "synopsis": "Headstrong Katy Carr means to be good, but a fall from a swing teaches her more than she expected.",
    "publicDomain": true
  },
  "the-coral-island": {
    "title": "The Coral Island",
    "author": "R. M. Ballantyne",
    "year": 1858,
    "synopsis": "Three boys are shipwrecked on a Pacific island and must survive on their own.",
    "publicDomain": true
  },
  "the-children-of-the-new-forest": {
    "title": "The Children of the New Forest",
    "author": "Frederick Marryat",
    "year": 1847,
    "synopsis": "Four orphans of a Royalist family hide in the New Forest during the English Civil War and learn to live as foresters.",
    "publicDomain": true
  },
  "rupert-of-hentzau": {
    "title": "Rupert of Hentzau",
    "author": "Anthony Hope",
    "year": 1898,
    "synopsis": "Rudolf Rassendyll returns to Ruritania when a stolen letter threatens Queen Flavia.",
    "publicDomain": true
  },
  "the-elusive-pimpernel": {
    "title": "The Elusive Pimpernel",
    "author": "Baroness Orczy",
    "year": 1908,
    "synopsis": "Chauvelin sets a trap for the Scarlet Pimpernel, using his wife Marguerite as bait.",
    "publicDomain": true
  },
  "the-black-tulip": {
    "title": "The Black Tulip",
    "author": "Alexandre Dumas",
    "year": 1850,
    "synopsis": "In seventeenth-century Holland, an innocent tulip grower is imprisoned while racing to grow a perfect black tulip.",
    "publicDomain": true
  },
  "madame-bovary": {
    "title": "Madame Bovary",
    "author": "Gustave Flaubert",
    "year": 1857,
    "synopsis": "A doctor's wife in provincial France, bored by her marriage, seeks romance and luxury that ruin her.",
    "publicDomain": true
  },
  "the-idiot": {
    "title": "The Idiot",
    "author": "Fyodor Dostoyevsky",
    "year": 1869,
    "synopsis": "The kind, guileless Prince Myshkin returns to St Petersburg and is caught between two women.",
    "publicDomain": true
  },
  "the-brothers-karamazov": {
    "title": "The Brothers Karamazov",
    "author": "Fyodor Dostoyevsky",
    "year": 1880,
    "synopsis": "Three brothers and their dissolute father are drawn into a murder that tests faith, doubt and guilt.",
    "publicDomain": true
  },
  "the-vicar-of-wakefield": {
    "title": "The Vicar of Wakefield",
    "author": "Oliver Goldsmith",
    "year": 1766,
    "synopsis": "A kindly country vicar and his family meet one misfortune after another with patience and good humour.",
    "publicDomain": true
  },
  "the-great-god-pan": {
    "title": "The Great God Pan",
    "author": "Arthur Machen",
    "year": 1894,
    "synopsis": "A surgeon's experiment on a young woman's brain unleashes something that haunts London society years later.",
    "publicDomain": true
  },
  "the-lair-of-the-white-worm": {
    "title": "The Lair of the White Worm",
    "author": "Bram Stoker",
    "year": 1911,
    "synopsis": "A young Australian visits his great-uncle in Derbyshire and finds an ancient serpent hiding behind a lady's face.",
    "publicDomain": true
  },
  "the-jewel-of-seven-stars": {
    "title": "The Jewel of Seven Stars",
    "author": "Bram Stoker",
    "year": 1903,
    "synopsis": "An Egyptologist lies in a strange trance while his daughter and a young lawyer guard the mummy of an ancient queen.",
    "publicDomain": true
  },
  "the-red-house-mystery": {
    "title": "The Red House Mystery",
    "author": "A. A. Milne",
    "year": 1922,
    "synopsis": "A guest at a country house turns amateur detective when the host's black-sheep brother is shot.",
    "publicDomain": true
  },
  "the-lodger": {
    "title": "The Lodger",
    "author": "Marie Belloc Lowndes",
    "year": 1913,
    "synopsis": "A struggling London couple take in a strange lodger while a killer stalks the city.",
    "publicDomain": true
  },
  "captain-blood": {
    "title": "Captain Blood",
    "author": "Rafael Sabatini",
    "year": 1922,
    "synopsis": "An Irish doctor sold into slavery in Barbados escapes to become the most daring pirate in the Caribbean.",
    "publicDomain": true
  },
  "scaramouche": {
    "title": "Scaramouche",
    "author": "Rafael Sabatini",
    "year": 1921,
    "synopsis": "A young lawyer in revolutionary France hides among travelling actors and swears revenge on the nobleman who killed his friend.",
    "publicDomain": true
  },
  "riders-of-the-purple-sage": {
    "title": "Riders of the Purple Sage",
    "author": "Zane Grey",
    "year": 1912,
    "synopsis": "A mysterious gunman rides into a Utah town to help a rancher stand against the men who want her land.",
    "publicDomain": true
  },
  "uncle-toms-cabin": {
    "title": "Uncle Tom's Cabin",
    "author": "Harriet Beecher Stowe",
    "year": 1852,
    "synopsis": "The lives of enslaved people in the American South, from Eliza's escape across the ice to Tom's faith under cruelty.",
    "publicDomain": true
  },
  "the-house-of-mirth": {
    "title": "The House of Mirth",
    "author": "Edith Wharton",
    "year": 1905,
    "synopsis": "Lily Bart, beautiful and penniless, must marry well in New York society before her chances run out.",
    "publicDomain": true
  },
  "the-custom-of-the-country": {
    "title": "The Custom of the Country",
    "author": "Edith Wharton",
    "year": 1913,
    "synopsis": "Ambitious Undine Spragg climbs from the Midwest into New York and Paris society, one marriage at a time.",
    "publicDomain": true
  },
  "summer": {
    "title": "Summer",
    "author": "Edith Wharton",
    "year": 1917,
    "synopsis": "A young woman in a small New England village falls in love with a visiting architect over one summer.",
    "publicDomain": true
  },
  "alexanders-bridge": {
    "title": "Alexander's Bridge",
    "author": "Willa Cather",
    "year": 1912,
    "synopsis": "A celebrated bridge builder, comfortably married in Boston, rekindles a love affair in London.",
    "publicDomain": true
  },
  "the-country-of-the-pointed-firs": {
    "title": "The Country of the Pointed Firs",
    "author": "Sarah Orne Jewett",
    "year": 1896,
    "synopsis": "A writer spends a summer in a Maine fishing village, listening to its people's stories.",
    "publicDomain": true
  },
  "night-and-day": {
    "title": "Night and Day",
    "author": "Virginia Woolf",
    "year": 1919,
    "synopsis": "In London before the war, Katharine Hilbery questions whether she wants marriage at all.",
    "publicDomain": true
  },
  "the-voyage-out": {
    "title": "The Voyage Out",
    "author": "Virginia Woolf",
    "year": 1915,
    "synopsis": "Young Rachel Vinrace sails to South America and discovers love and the wider world.",
    "publicDomain": true
  },
  "babbitt": {
    "title": "Babbitt",
    "author": "Sinclair Lewis",
    "year": 1922,
    "synopsis": "A prosperous Midwestern estate agent begins to doubt the comfortable, conformist life he has built.",
    "publicDomain": true
  },
  "howards-end": {
    "title": "Howards End",
    "author": "E. M. Forster",
    "year": 1910,
    "synopsis": "Two cultured sisters become entangled with a wealthy business family and a struggling clerk, over a house called Howards End.",
    "publicDomain": true
  },
  "where-angels-fear-to-tread": {
    "title": "Where Angels Fear to Tread",
    "author": "E. M. Forster",
    "year": 1905,
    "synopsis": "An English widow marries a young Italian, and her in-laws travel to Italy to undo the damage.",
    "publicDomain": true
  },
  "a-voyage-to-arcturus": {
    "title": "A Voyage to Arcturus",
    "author": "David Lindsay",
    "year": 1920,
    "synopsis": "A man travels to a planet circling Arcturus and journeys across a world of strange beings and ideas.",
    "publicDomain": true
  },
  "understood-betsy": {
    "title": "Understood Betsy",
    "author": "Dorothy Canfield Fisher",
    "year": 1916,
    "synopsis": "A timid city girl is sent to live with cousins on a Vermont farm and learns to do things for herself.",
    "publicDomain": true
  },
  "the-damnation-of-theron-ware": {
    "title": "The Damnation of Theron Ware",
    "author": "Harold Frederic",
    "year": 1896,
    "synopsis": "A young Methodist minister in a small New York town loses his faith as he meets new ideas and new people.",
    "publicDomain": true
  },
  "mcteague": {
    "title": "McTeague",
    "author": "Frank Norris",
    "year": 1899,
    "synopsis": "A San Francisco dentist's marriage is destroyed by a lottery win and his wife's greed.",
    "publicDomain": true
  },
  "the-jungle": {
    "title": "The Jungle",
    "author": "Upton Sinclair",
    "year": 1906,
    "synopsis": "A Lithuanian immigrant family works in Chicago's meatpacking plants and is ground down by poverty and exploitation.",
    "publicDomain": true
  },
  "the-europeans": {
    "title": "The Europeans",
    "author": "Henry James",
    "year": 1878,
    "synopsis": "Two European-raised cousins visit their strict New England relatives near Boston.",
    "publicDomain": true
  },
  "the-secret-sharer": {
    "title": "The Secret Sharer",
    "author": "Joseph Conrad",
    "year": 1910,
    "synopsis": "A new captain hides a stranger, a fugitive mate, in his cabin aboard ship.",
    "publicDomain": true
  },
  "typhoon": {
    "title": "Typhoon",
    "author": "Joseph Conrad",
    "year": 1902,
    "synopsis": "A stolid captain steers his steamer straight into a typhoon in the China Sea.",
    "publicDomain": true
  },
  "three-men-on-the-bummel": {
    "title": "Three Men on the Bummel",
    "author": "Jerome K. Jerome",
    "year": 1900,
    "synopsis": "The three friends from Three Men in a Boat go on a cycling tour of Germany.",
    "publicDomain": true
  },
  "the-inimitable-jeeves": {
    "title": "The Inimitable Jeeves",
    "author": "P. G. Wodehouse",
    "year": 1923,
    "synopsis": "Bertie Wooster's friend Bingo falls in love again and again, and Jeeves keeps saving them both.",
    "publicDomain": true
  },
  "zuleika-dobson": {
    "title": "Zuleika Dobson",
    "author": "Max Beerbohm",
    "year": 1911,
    "synopsis": "A beautiful conjuror visits Oxford, and every undergraduate falls in love with her, with disastrous results.",
    "publicDomain": true
  },
  "the-scarlet-plague": {
    "title": "The Scarlet Plague",
    "author": "Jack London",
    "year": 1912,
    "synopsis": "Sixty years after a plague wiped out civilisation, an old man tells his grandsons how the world ended.",
    "publicDomain": true
  },
  "the-card": {
    "title": "The Card",
    "author": "Arnold Bennett",
    "year": 1911,
    "synopsis": "A washerwoman's son in the Potteries rises by cheek and quick wits to become the town's mayor.",
    "publicDomain": true
  },
  "the-moon-pool": {
    "title": "The Moon Pool",
    "author": "A. Merritt",
    "year": 1919,
    "synopsis": "A scientist follows a shining being from a Pacific ruin down into a hidden world beneath the Earth.",
    "publicDomain": true
  },
  "gladiator": {
    "title": "Gladiator",
    "author": "Philip Wylie",
    "year": 1930,
    "synopsis": "A boy given superhuman strength by his father's experiment searches for a place in a world that fears him.",
    "publicDomain": true
  },
  "the-skylark-of-space": {
    "title": "The Skylark of Space",
    "author": "E. E. Smith",
    "year": 1928,
    "synopsis": "A chemist discovers a way to free atomic energy and builds a spaceship to rescue his kidnapped fiancée.",
    "publicDomain": true
  },
  "the-autobiography-of-an-ex-colored-man": {
    "title": "The Autobiography of an Ex-Colored Man",
    "author": "James Weldon Johnson",
    "year": 1912,
    "synopsis": "A musician of mixed race tells how he came to pass as white, and what it cost him.",
    "publicDomain": true
  },
  "the-house-behind-the-cedars": {
    "title": "The House Behind the Cedars",
    "author": "Charles W. Chesnutt",
    "year": 1900,
    "synopsis": "A brother and sister born to a Black mother in North Carolina pass as white and face what the secret means for love.",
    "publicDomain": true
  },
  "the-book-of-tea": {
    "title": "The Book of Tea",
    "author": "Kakuzo Okakura",
    "year": 1906,
    "synopsis": "A short, graceful essay on the Japanese tea ceremony and what it says about art, simplicity and living well.",
    "publicDomain": true
  },
  "the-burgess-animal-book-for-children": {
    "title": "The Burgess Animal Book for Children",
    "author": "Thornton W. Burgess",
    "year": 1920,
    "synopsis": "Peter Rabbit goes to Old Mother Nature's school to learn about the animals of North America.",
    "publicDomain": true
  },
  "the-adventures-of-danny-meadow-mouse": {
    "title": "The Adventures of Danny Meadow Mouse",
    "author": "Thornton W. Burgess",
    "year": 1915,
    "synopsis": "Little Danny Meadow Mouse keeps clear of hawks, foxes and cats on the Green Meadows.",
    "publicDomain": true
  },
  "the-sea-fairies": {
    "title": "The Sea Fairies",
    "author": "L. Frank Baum",
    "year": 1911,
    "synopsis": "Trot and Cap'n Bill are taken under the sea by mermaids and meet the wicked magician Zog.",
    "publicDomain": true
  },
  "wet-magic": {
    "title": "Wet Magic",
    "author": "E. Nesbit",
    "year": 1913,
    "synopsis": "Four children rescue a mermaid from a circus and are drawn into a war beneath the sea.",
    "publicDomain": true
  },
  "the-mysterious-stranger": {
    "title": "The Mysterious Stranger",
    "author": "Mark Twain",
    "year": 1916,
    "synopsis": "In an Austrian village in 1590, three boys meet a charming stranger with unsettling powers.",
    "publicDomain": true
  },
  "the-stolen-white-elephant": {
    "title": "The Stolen White Elephant",
    "author": "Mark Twain",
    "year": 1882,
    "synopsis": "A comic collection of Twain's tales, led by a detective farce about a missing sacred elephant.",
    "publicDomain": true
  },
  "greenmantle": {
    "title": "Greenmantle",
    "author": "John Buchan",
    "year": 1916,
    "synopsis": "Richard Hannay crosses wartime Europe to Constantinople to stop a plot to raise the East against the Allies.",
    "publicDomain": true
  },
  "the-tragedy-of-the-korosko": {
    "title": "The Tragedy of the Korosko",
    "author": "Arthur Conan Doyle",
    "year": 1898,
    "synopsis": "Tourists on a Nile steamer are captured by desert raiders.",
    "publicDomain": true
  },
  "the-mystery-of-cloomber": {
    "title": "The Mystery of Cloomber",
    "author": "Arthur Conan Doyle",
    "year": 1888,
    "synopsis": "A retired general lives in fear behind a high fence in Scotland, waiting for something from his past in India.",
    "publicDomain": true
  },
  "the-parasite": {
    "title": "The Parasite",
    "author": "Arthur Conan Doyle",
    "year": 1894,
    "synopsis": "A sceptical young professor falls under the hypnotic power of a woman mesmerist.",
    "publicDomain": true
  },
  "shirley": {
    "title": "Shirley",
    "author": "Charlotte Brontë",
    "year": 1849,
    "synopsis": "In Yorkshire during the Luddite riots, two very different young women face love and a mill owner under threat.",
    "publicDomain": true
  },
  "ivanhoe": {
    "title": "Ivanhoe",
    "author": "Walter Scott",
    "year": 1819,
    "synopsis": "A disinherited knight returns from the Crusades to an England torn between Saxons and Normans.",
    "publicDomain": true
  },
  "a-journey-to-the-centre-of-the-earth": {
    "title": "A Journey to the Centre of the Earth",
    "author": "Jules Verne",
    "year": 1864,
    "synopsis": "A professor, his nephew and their guide climb down an Icelandic volcano towards the centre of the Earth.",
    "publicDomain": true
  },
  "the-deerslayer": {
    "title": "The Deerslayer",
    "author": "James Fenimore Cooper",
    "year": 1841,
    "synopsis": "Young Natty Bumppo fights his first battle on a frontier lake.",
    "publicDomain": true
  },
  "the-story-girl": {
    "title": "The Story Girl",
    "author": "L. M. Montgomery",
    "year": 1911,
    "synopsis": "Cousins spend a summer on Prince Edward Island, enchanted by Sara Stanley, the girl who tells the best stories.",
    "publicDomain": true
  },
  "kilmeny-of-the-orchard": {
    "title": "Kilmeny of the Orchard",
    "author": "L. M. Montgomery",
    "year": 1910,
    "synopsis": "A young teacher hears a violinist in an abandoned orchard and falls in love with a girl who cannot speak.",
    "publicDomain": true
  },
  "jos-boys": {
    "title": "Jo's Boys",
    "author": "Louisa May Alcott",
    "year": 1886,
    "synopsis": "The boys of Plumfield, now grown, set out in the world while Jo keeps watch over them.",
    "publicDomain": true
  },
  "little-men": {
    "title": "Little Men",
    "author": "Louisa May Alcott",
    "year": 1871,
    "synopsis": "Jo March and her husband run Plumfield, a school full of lively boys.",
    "publicDomain": true
  },
  "the-wouldbegoods": {
    "title": "The Wouldbegoods",
    "author": "E. Nesbit",
    "year": 1901,
    "synopsis": "Sent to the country, the Bastable children form a society for being good, with chaotic results.",
    "publicDomain": true
  },
  "a-girl-of-the-limberlost": {
    "title": "A Girl of the Limberlost",
    "author": "Gene Stratton-Porter",
    "year": 1909,
    "synopsis": "Elnora pays her way through high school by collecting moths in the Limberlost swamp.",
    "publicDomain": true
  },
  "freckles": {
    "title": "Freckles",
    "author": "Gene Stratton-Porter",
    "year": 1904,
    "synopsis": "A one-handed orphan guards valuable timber in the Limberlost swamp and falls in love.",
    "publicDomain": true
  },
  "twenty-years-after": {
    "title": "Twenty Years After",
    "author": "Alexandre Dumas",
    "year": 1845,
    "synopsis": "D'Artagnan and the three musketeers reunite on opposite sides of the Fronde and the English Civil War.",
    "publicDomain": true
  },
  "the-gambler": {
    "title": "The Gambler",
    "author": "Fyodor Dostoyevsky",
    "year": 1867,
    "synopsis": "A young tutor in a German spa town is consumed by roulette and his love for a proud woman.",
    "publicDomain": true
  },
  "the-circular-staircase": {
    "title": "The Circular Staircase",
    "author": "Mary Roberts Rinehart",
    "year": 1908,
    "synopsis": "A spinster rents a country house for the summer and finds herself in the middle of a murder.",
    "publicDomain": true
  },
  "the-hollow-needle": {
    "title": "The Hollow Needle",
    "author": "Maurice Leblanc",
    "year": 1909,
    "synopsis": "A young student detective matches wits with the gentleman thief Arsène Lupin over a secret hidden in France's history.",
    "publicDomain": true
  },
  "the-four-feathers": {
    "title": "The Four Feathers",
    "author": "A. E. W. Mason",
    "year": 1902,
    "synopsis": "An officer who resigned before a war is sent white feathers for cowardice and sets out to win them back.",
    "publicDomain": true
  },
  "herland": {
    "title": "Herland",
    "author": "Charlotte Perkins Gilman",
    "year": 1915,
    "synopsis": "Three American explorers find a hidden country where women have lived without men for two thousand years.",
    "publicDomain": true
  },
  "jacobs-room": {
    "title": "Jacob's Room",
    "author": "Virginia Woolf",
    "year": 1922,
    "synopsis": "The life of a young man, Jacob Flanders, told through the people and rooms around him.",
    "publicDomain": true
  },
  "the-longest-journey": {
    "title": "The Longest Journey",
    "author": "E. M. Forster",
    "year": 1907,
    "synopsis": "A lame, idealistic young man leaves Cambridge, makes a bad marriage and finds a half-brother he never knew.",
    "publicDomain": true
  },
  "toby-tyler": {
    "title": "Toby Tyler",
    "author": "James Otis",
    "year": 1881,
    "synopsis": "A boy runs away to join a circus and finds it harder than he imagined, with a monkey for his best friend.",
    "publicDomain": true
  },
  "the-rise-of-silas-lapham": {
    "title": "The Rise of Silas Lapham",
    "author": "William Dean Howells",
    "year": 1885,
    "synopsis": "A self-made paint manufacturer tries to enter Boston society just as his business begins to fail.",
    "publicDomain": true
  },
  "leave-it-to-psmith": {
    "title": "Leave It to Psmith",
    "author": "P. G. Wodehouse",
    "year": 1923,
    "synopsis": "The unflappable Psmith goes to Blandings Castle under a false name, in a plot involving a stolen necklace.",
    "publicDomain": true
  },
  "a-damsel-in-distress": {
    "title": "A Damsel in Distress",
    "author": "P. G. Wodehouse",
    "year": 1919,
    "synopsis": "An American composer falls for a girl who jumps into his taxi, and follows her to her family's castle.",
    "publicDomain": true
  },
  "otto-of-the-silver-hand": {
    "title": "Otto of the Silver Hand",
    "author": "Howard Pyle",
    "year": 1888,
    "synopsis": "The gentle son of a robber baron is caught in a feud in medieval Germany.",
    "publicDomain": true
  },
  "little-dorrit": {
    "title": "Little Dorrit",
    "author": "Charles Dickens",
    "year": 1857,
    "synopsis": "Amy Dorrit grows up in a debtors' prison with her proud father, until a fortune changes everything.",
    "publicDomain": true
  },
  "bleak-house": {
    "title": "Bleak House",
    "author": "Charles Dickens",
    "year": 1853,
    "synopsis": "An endless lawsuit over an inheritance draws in Esther Summerson, a proud lady with a secret and a London of fog.",
    "publicDomain": true
  },
  "our-mutual-friend": {
    "title": "Our Mutual Friend",
    "author": "Charles Dickens",
    "year": 1865,
    "synopsis": "A man found drowned in the Thames was heir to a dust fortune, and the inheritance changes many lives.",
    "publicDomain": true
  },
  "lorna-doone": {
    "title": "Lorna Doone",
    "author": "R. D. Blackmore",
    "year": 1869,
    "synopsis": "John Ridd, a farmer on Exmoor, loves Lorna, who is held by the outlaw Doone clan that killed his father.",
    "publicDomain": true
  },
  "david-copperfield": {
    "title": "David Copperfield",
    "author": "Charles Dickens",
    "year": 1850,
    "synopsis": "David tells his own life, from an unhappy childhood to becoming a writer, with friends like Mr Micawber along the way.",
    "publicDomain": true
  },
  "nicholas-nickleby": {
    "title": "Nicholas Nickleby",
    "author": "Charles Dickens",
    "year": 1839,
    "synopsis": "A young man supports his mother and sister after his father's death, against his scheming uncle and a cruel Yorkshire school.",
    "publicDomain": true
  },
  "the-pickwick-papers": {
    "title": "The Pickwick Papers",
    "author": "Charles Dickens",
    "year": 1837,
    "synopsis": "Mr Pickwick and his club travel England with his loyal servant Sam Weller, in Dickens's first novel.",
    "publicDomain": true
  },
  "barnaby-rudge": {
    "title": "Barnaby Rudge",
    "author": "Charles Dickens",
    "year": 1841,
    "synopsis": "A simple young man and his raven are swept into the Gordon Riots of 1780.",
    "publicDomain": true
  },
  "middlemarch": {
    "title": "Middlemarch",
    "author": "George Eliot",
    "year": 1872,
    "synopsis": "In a provincial English town, idealistic Dorothea Brooke and an ambitious young doctor both make marriages they regret.",
    "publicDomain": true
  },
  "far-from-the-madding-crowd": {
    "title": "Far from the Madding Crowd",
    "author": "Thomas Hardy",
    "year": 1874,
    "synopsis": "Independent Bathsheba Everdene runs her own farm and is courted by a shepherd, a farmer and a dashing soldier.",
    "publicDomain": true
  },
  "a-pair-of-blue-eyes": {
    "title": "A Pair of Blue Eyes",
    "author": "Thomas Hardy",
    "year": 1873,
    "synopsis": "A clergyman's daughter in Cornwall is courted by a young architect and his older friend.",
    "publicDomain": true
  },
  "white-jacket": {
    "title": "White-Jacket",
    "author": "Herman Melville",
    "year": 1850,
    "synopsis": "A sailor describes a year aboard an American warship, its men, its floggings and his strange white jacket.",
    "publicDomain": true
  },
  "lilith": {
    "title": "Lilith",
    "author": "George MacDonald",
    "year": 1895,
    "synopsis": "A young man follows a raven through a mirror into a strange land of the dead and the not yet living.",
    "publicDomain": true
  },
  "incidents-in-the-life-of-a-slave-girl": {
    "title": "Incidents in the Life of a Slave Girl",
    "author": "Harriet Jacobs",
    "year": 1861,
    "synopsis": "Harriet Jacobs tells of her enslavement in North Carolina, seven years in hiding and her escape to freedom.",
    "publicDomain": true
  },
  "uncle-silas": {
    "title": "Uncle Silas",
    "author": "J. Sheridan Le Fanu",
    "year": 1864,
    "synopsis": "A young heiress is sent to live with her uncle, a man suspected of murder, at his decaying house.",
    "publicDomain": true
  },
  "lord-jim": {
    "title": "Lord Jim",
    "author": "Joseph Conrad",
    "year": 1900,
    "synopsis": "A young officer who once jumped from a ship he thought was sinking seeks redemption in a remote Malay settlement.",
    "publicDomain": true
  },
  "victory": {
    "title": "Victory",
    "author": "Joseph Conrad",
    "year": 1915,
    "synopsis": "A man living alone on an island rescues a young woman, and three dangerous visitors follow.",
    "publicDomain": true
  },
  "the-wonderful-visit": {
    "title": "The Wonderful Visit",
    "author": "H. G. Wells",
    "year": 1895,
    "synopsis": "A vicar shoots what he thinks is a strange bird and finds he has wounded an angel.",
    "publicDomain": true
  },
  "the-return-of-the-native": {
    "title": "The Return of the Native",
    "author": "Thomas Hardy",
    "year": 1878,
    "synopsis": "Clym Yeobright comes home from Paris to Egdon Heath and marries restless Eustacia Vye.",
    "publicDomain": true
  },
  "the-pioneers": {
    "title": "The Pioneers",
    "author": "James Fenimore Cooper",
    "year": 1823,
    "synopsis": "An aging Natty Bumppo clashes with the new laws of a frontier settlement in New York.",
    "publicDomain": true
  },
  "the-last-days-of-pompeii": {
    "title": "The Last Days of Pompeii",
    "author": "Edward Bulwer-Lytton",
    "year": 1834,
    "synopsis": "Lovers in Pompeii face a sinister priest of Isis as Vesuvius begins to rumble.",
    "publicDomain": true
  },
  "mary-barton": {
    "title": "Mary Barton",
    "author": "Elizabeth Gaskell",
    "year": 1848,
    "synopsis": "In 1840s Manchester, a mill worker's daughter is caught between two suitors as her father turns to violence.",
    "publicDomain": true
  },
  "the-black-arrow": {
    "title": "The Black Arrow",
    "author": "Robert Louis Stevenson",
    "year": 1888,
    "synopsis": "During the Wars of the Roses, young Dick Shelton joins a band of outlaws to avenge his father.",
    "publicDomain": true
  },
  "the-innocents-abroad": {
    "title": "The Innocents Abroad",
    "author": "Mark Twain",
    "year": 1869,
    "synopsis": "Twain's comic account of a cruise of American tourists through Europe and the Holy Land.",
    "publicDomain": true
  },
  "the-blithedale-romance": {
    "title": "The Blithedale Romance",
    "author": "Nathaniel Hawthorne",
    "year": 1852,
    "synopsis": "A poet joins a utopian farming community and watches its members' passions unravel.",
    "publicDomain": true
  },
  "a-princess-of-mars": {
    "title": "A Princess of Mars",
    "author": "Edgar Rice Burroughs",
    "year": 1912,
    "synopsis": "Civil War veteran John Carter is transported to Mars, where he fights for the princess Dejah Thoris.",
    "publicDomain": true
  },
  "the-prairie": {
    "title": "The Prairie",
    "author": "James Fenimore Cooper",
    "year": 1827,
    "synopsis": "The old trapper Natty Bumppo guides settlers across the Great Plains.",
    "publicDomain": true
  },
  "the-patchwork-girl-of-oz": {
    "title": "The Patchwork Girl of Oz",
    "author": "L. Frank Baum",
    "year": 1913,
    "synopsis": "A Munchkin boy searches Oz for the ingredients to free his uncle, helped by a lively patchwork girl.",
    "publicDomain": true
  },
  "the-three-musketeers": {
    "title": "The Three Musketeers",
    "author": "Alexandre Dumas",
    "year": 1844,
    "synopsis": "Young d'Artagnan joins Athos, Porthos and Aramis in Paris and becomes caught up in the schemes of Cardinal Richelieu.",
    "publicDomain": true
  },
  "candide": {
    "title": "Candide",
    "author": "Voltaire",
    "year": 1759,
    "synopsis": "Young Candide is taught that all is for the best, then thrown out into a world of war, earthquake and disaster.",
    "publicDomain": true
  },
  "the-education-of-henry-adams": {
    "title": "The Education of Henry Adams",
    "author": "Henry Adams",
    "year": 1907,
    "synopsis": "The grandson and great-grandson of presidents looks back on how little his education prepared him for the modern world.",
    "publicDomain": true
  },
  "o-pioneers": {
    "title": "O Pioneers!",
    "author": "Willa Cather",
    "year": 1913,
    "synopsis": "Alexandra Bergson takes over her family's farm on the Nebraska prairie and makes it thrive.",
    "publicDomain": true
  },
  "main-street": {
    "title": "Main Street",
    "author": "Sinclair Lewis",
    "year": 1920,
    "synopsis": "A city-bred young wife tries to bring culture and reform to a small Minnesota town.",
    "publicDomain": true
  },
  "news-from-nowhere": {
    "title": "News from Nowhere",
    "author": "William Morris",
    "year": 1890,
    "synopsis": "A man falls asleep in Victorian London and wakes in a peaceful future England without money or government.",
    "publicDomain": true
  },
  "the-ambassadors": {
    "title": "The Ambassadors",
    "author": "Henry James",
    "year": 1903,
    "synopsis": "A middle-aged American is sent to Paris to bring a young man home, and finds Paris changing him instead.",
    "publicDomain": true
  },
  "iola-leroy": {
    "title": "Iola Leroy",
    "author": "Frances E. W. Harper",
    "year": 1892,
    "synopsis": "A young woman raised as white is sold into slavery, and after the Civil War works to rebuild her family and her people.",
    "publicDomain": true
  },
  "romola": {
    "title": "Romola",
    "author": "George Eliot",
    "year": 1863,
    "synopsis": "In fifteenth-century Florence, a scholar's daughter marries a charming Greek with a hidden past, in the age of Savonarola.",
    "publicDomain": true
  },
  "no-name": {
    "title": "No Name",
    "author": "Wilkie Collins",
    "year": 1862,
    "synopsis": "Two sisters lose their name and inheritance when their parents die, and one sets out to win it back by any means.",
    "publicDomain": true
  },
  "the-golden-road": {
    "title": "The Golden Road",
    "author": "L. M. Montgomery",
    "year": 1913,
    "synopsis": "The cousins of The Story Girl spend one more golden year together on Prince Edward Island.",
    "publicDomain": true
  },
  "the-mystery-of-the-yellow-room": {
    "title": "The Mystery of the Yellow Room",
    "author": "Gaston Leroux",
    "year": 1907,
    "synopsis": "A young reporter investigates an attack on a woman inside a room locked from the inside.",
    "publicDomain": true
  },
  "the-sea-hawk": {
    "title": "The Sea Hawk",
    "author": "Rafael Sabatini",
    "year": 1915,
    "synopsis": "A Cornish gentleman, betrayed and sold into slavery, becomes a feared corsair of the Barbary coast.",
    "publicDomain": true
  },
  "erewhon": {
    "title": "Erewhon",
    "author": "Samuel Butler",
    "year": 1872,
    "synopsis": "A traveller crosses the mountains into a country where illness is a crime and machines have been banned.",
    "publicDomain": true
  },
  "the-metal-monster": {
    "title": "The Metal Monster",
    "author": "A. Merritt",
    "year": 1920,
    "synopsis": "Explorers in the mountains of Asia find a living, thinking creature made of metal.",
    "publicDomain": true
  },
  "the-golden-fleece-and-the-heroes-who": {
    "title": "The Golden Fleece and the Heroes Who Lived Before Achilles",
    "author": "Padraic Colum",
    "year": 1921,
    "synopsis": "Jason and the Argonauts sail for the Golden Fleece, with the stories of the Greek heroes told along the way.",
    "publicDomain": true
  },
  "roughing-it": {
    "title": "Roughing It",
    "author": "Mark Twain",
    "year": 1872,
    "synopsis": "Twain's comic memoir of his years in the Wild West, from stagecoaches and silver mines to Hawaii.",
    "publicDomain": true
  },
  "the-iron-heel": {
    "title": "The Iron Heel",
    "author": "Jack London",
    "year": 1908,
    "synopsis": "A manuscript found centuries later tells of an oligarchy that crushed democracy in America.",
    "publicDomain": true
  },
  "the-gods-of-mars": {
    "title": "The Gods of Mars",
    "author": "Edgar Rice Burroughs",
    "year": 1914,
    "synopsis": "John Carter returns to Mars and uncovers the dark truth of the Martians' sacred valley.",
    "publicDomain": true
  },
  "rose-in-bloom": {
    "title": "Rose in Bloom",
    "author": "Louisa May Alcott",
    "year": 1876,
    "synopsis": "Rose returns from travelling the world and must choose among her cousins and her suitors.",
    "publicDomain": true
  },
  "eight-cousins": {
    "title": "Eight Cousins",
    "author": "Louisa May Alcott",
    "year": 1875,
    "synopsis": "Orphaned Rose goes to live with her great-aunts, her uncle Alec and seven boisterous boy cousins.",
    "publicDomain": true
  },
  "phantastes": {
    "title": "Phantastes",
    "author": "George MacDonald",
    "year": 1858,
    "synopsis": "A young man wakes to find his bedroom turning into a forest, and wanders through Fairy Land.",
    "publicDomain": true
  },
  "sylvie-and-bruno": {
    "title": "Sylvie and Bruno",
    "author": "Lewis Carroll",
    "year": 1889,
    "synopsis": "A narrator drifts between Victorian England and Fairyland, where two fairy children try to save their father's kingdom.",
    "publicDomain": true
  },
  "allan-quatermain": {
    "title": "Allan Quatermain",
    "author": "H. Rider Haggard",
    "year": 1887,
    "synopsis": "Allan Quatermain and his friends journey into unknown Africa and find a hidden white civilisation.",
    "publicDomain": true
  },
  "sir-nigel": {
    "title": "Sir Nigel",
    "author": "Arthur Conan Doyle",
    "year": 1906,
    "synopsis": "Young Nigel Loring sets out to win honour in the Hundred Years' War.",
    "publicDomain": true
  },
  "the-adventures-of-reddy-fox": {
    "title": "The Adventures of Reddy Fox",
    "author": "Thornton W. Burgess",
    "year": 1913,
    "synopsis": "Clever Reddy Fox gets into trouble on the Green Meadows, with Granny Fox and Bowser the Hound after him.",
    "publicDomain": true
  },
  "the-burgess-bird-book-for-children": {
    "title": "The Burgess Bird Book for Children",
    "author": "Thornton W. Burgess",
    "year": 1919,
    "synopsis": "Peter Rabbit learns about the birds of the Old Orchard from Jenny Wren and her friends.",
    "publicDomain": true
  },
  "the-house-of-the-seven-gables": {
    "title": "The House of the Seven Gables",
    "author": "Nathaniel Hawthorne",
    "year": 1851,
    "synopsis": "A curse hangs over the Pyncheon family and their dark old house in Salem.",
    "publicDomain": true
  },
  "crime-and-punishment": {
    "title": "Crime and Punishment",
    "author": "Fyodor Dostoyevsky",
    "year": 1866,
    "synopsis": "A poor student in St Petersburg commits a murder, then wrestles with guilt and a patient detective.",
    "publicDomain": true
  },
  "the-leavenworth-case": {
    "title": "The Leavenworth Case",
    "author": "Anna Katharine Green",
    "year": 1878,
    "synopsis": "A wealthy New York merchant is shot in his library, and suspicion falls on his two nieces.",
    "publicDomain": true
  },
  "three-men-in-a-boat": {
    "title": "Three Men in a Boat",
    "author": "Jerome K. Jerome",
    "year": 1889,
    "synopsis": "Three friends and a dog take a boating holiday on the Thames, and almost everything goes wrong.",
    "publicDomain": true
  },
  "the-spy": {
    "title": "The Spy",
    "author": "James Fenimore Cooper",
    "year": 1821,
    "synopsis": "During the American Revolution, a pedlar suspected of spying for the British serves a secret master.",
    "publicDomain": true
  },
  "the-red-fairy-book": {
    "title": "The Red Fairy Book",
    "author": "Andrew Lang",
    "year": 1890,
    "synopsis": "Fairy tales from around the world, including Jack and the Beanstalk and Rapunzel.",
    "publicDomain": true
  },
  "life-on-the-mississippi": {
    "title": "Life on the Mississippi",
    "author": "Mark Twain",
    "year": 1883,
    "synopsis": "Twain remembers learning to pilot steamboats on the Mississippi and returns to the river years later.",
    "publicDomain": true
  },
  "typee": {
    "title": "Typee",
    "author": "Herman Melville",
    "year": 1846,
    "synopsis": "A sailor deserts his ship in the Marquesas Islands and lives among the feared Typee people.",
    "publicDomain": true
  },
  "at-the-earths-core": {
    "title": "At the Earth's Core",
    "author": "Edgar Rice Burroughs",
    "year": 1914,
    "synopsis": "A mining machine tunnels into the hollow Earth, where a prehistoric world lies under an unmoving sun.",
    "publicDomain": true
  },
  "pellucidar": {
    "title": "Pellucidar",
    "author": "Edgar Rice Burroughs",
    "year": 1915,
    "synopsis": "David Innes returns to the inner world to find his love and unite its tribes.",
    "publicDomain": true
  },
  "the-man-in-the-iron-mask": {
    "title": "The Man in the Iron Mask",
    "author": "Alexandre Dumas",
    "year": 1850,
    "synopsis": "Aramis plots to replace Louis XIV with his secret twin, a prisoner whose face is hidden by a mask.",
    "publicDomain": true
  },
  "joseph-andrews": {
    "title": "Joseph Andrews",
    "author": "Henry Fielding",
    "year": 1742,
    "synopsis": "A virtuous footman and his friend the absent-minded Parson Adams travel the roads of England in a comic adventure.",
    "publicDomain": true
  },
  "up-from-slavery": {
    "title": "Up from Slavery",
    "author": "Booker T. Washington",
    "year": 1901,
    "synopsis": "Booker T. Washington tells how he went from slavery to founding the Tuskegee Institute.",
    "publicDomain": true
  },
  "carmilla": {
    "title": "Carmilla",
    "author": "J. Sheridan Le Fanu",
    "year": 1872,
    "synopsis": "A lonely girl in a Styrian castle befriends a mysterious guest who has a strange effect on her.",
    "publicDomain": true
  },
  "the-napoleon-of-notting-hill": {
    "title": "The Napoleon of Notting Hill",
    "author": "G. K. Chesterton",
    "year": 1904,
    "synopsis": "In a future London, a king as a joke gives each borough its own walls, and Notting Hill's provost takes it seriously.",
    "publicDomain": true
  },
  "the-cloister-and-the-hearth": {
    "title": "The Cloister and the Hearth",
    "author": "Charles Reade",
    "year": 1861,
    "synopsis": "A young Dutch scribe travels across fifteenth-century Europe, torn between the woman he loves and the Church.",
    "publicDomain": true
  },
  "the-hampdenshire-wonder": {
    "title": "The Hampdenshire Wonder",
    "author": "J. D. Beresford",
    "year": 1911,
    "synopsis": "A child born with an extraordinary mind unsettles the English village around him.",
    "publicDomain": true
  },
  "men-of-iron": {
    "title": "Men of Iron",
    "author": "Howard Pyle",
    "year": 1891,
    "synopsis": "Myles Falworth trains to become a knight and clear his blinded father's name.",
    "publicDomain": true
  },
  "huntingtower": {
    "title": "Huntingtower",
    "author": "John Buchan",
    "year": 1922,
    "synopsis": "A retired Glasgow grocer on a walking holiday helps a band of street boys rescue a Russian princess.",
    "publicDomain": true
  },
  "the-riddle-of-the-sands": {
    "title": "The Riddle of the Sands",
    "author": "Erskine Childers",
    "year": 1903,
    "synopsis": "Two Englishmen sailing the German Frisian islands stumble on preparations for an invasion.",
    "publicDomain": true
  },
  "the-professor": {
    "title": "The Professor",
    "author": "Charlotte Brontë",
    "year": 1857,
    "synopsis": "A young Englishman teaches in Brussels and falls in love with a Swiss-English pupil.",
    "publicDomain": true
  },
  "the-narrative-of-arthur-gordon-pym-of": {
    "title": "The Narrative of Arthur Gordon Pym of Nantucket",
    "author": "Edgar Allan Poe",
    "year": 1838,
    "synopsis": "A stowaway survives mutiny, shipwreck and starvation and sails on towards the mysteries of the South Pole.",
    "publicDomain": true
  },
  "the-mill-on-the-floss": {
    "title": "The Mill on the Floss",
    "author": "George Eliot",
    "year": 1860,
    "synopsis": "Clever, passionate Maggie Tulliver and her brother Tom grow up at Dorlcote Mill, and their bond is tested.",
    "publicDomain": true
  },
  "the-master-of-ballantrae": {
    "title": "The Master of Ballantrae",
    "author": "Robert Louis Stevenson",
    "year": 1889,
    "synopsis": "Two Scottish brothers take opposite sides in the Jacobite rising, and their feud follows them across the world.",
    "publicDomain": true
  },
  "the-memoirs-of-sherlock-holmes": {
    "title": "The Memoirs of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "year": 1894,
    "synopsis": "More of Holmes's cases, from Silver Blaze to his last struggle with Professor Moriarty.",
    "publicDomain": true
  },
  "the-diary-of-a-nobody": {
    "title": "The Diary of a Nobody",
    "author": "George and Weedon Grossmith",
    "year": 1892,
    "synopsis": "The comic diary of Charles Pooter, a London clerk who takes himself very seriously.",
    "publicDomain": true
  },
  "rilla-of-ingleside": {
    "title": "Rilla of Ingleside",
    "author": "L. M. Montgomery",
    "year": 1921,
    "synopsis": "Anne's youngest daughter Rilla grows up on the home front as her brothers go to the First World War.",
    "publicDomain": true
  },
  "captains-courageous": {
    "title": "Captains Courageous",
    "author": "Rudyard Kipling",
    "year": 1897,
    "synopsis": "A spoilt rich boy falls overboard from a liner and is picked up by a fishing schooner on the Grand Banks.",
    "publicDomain": true
  },
  "martin-chuzzlewit": {
    "title": "Martin Chuzzlewit",
    "author": "Charles Dickens",
    "year": 1844,
    "synopsis": "A selfish young man seeks his fortune in America, while the hypocrite Pecksniff schemes at home.",
    "publicDomain": true
  },
  "adam-bede": {
    "title": "Adam Bede",
    "author": "George Eliot",
    "year": 1859,
    "synopsis": "A carpenter in a rural village loves pretty Hetty Sorrel, who is drawn to the young squire.",
    "publicDomain": true
  },
  "english-fairy-tales": {
    "title": "English Fairy Tales",
    "author": "Joseph Jacobs",
    "year": 1890,
    "synopsis": "Jack and the Beanstalk, Tom Thumb, the Three Little Pigs and other English tales.",
    "publicDomain": true
  },
  "the-moonstone": {
    "title": "The Moonstone",
    "author": "Wilkie Collins",
    "year": 1868,
    "synopsis": "A great Indian diamond vanishes from a Yorkshire country house on the night of a birthday party.",
    "publicDomain": true
  },
  "the-talisman": {
    "title": "The Talisman",
    "author": "Walter Scott",
    "year": 1825,
    "synopsis": "During the Third Crusade, a Scottish knight is caught between Richard the Lionheart and Saladin.",
    "publicDomain": true
  },
  "the-tragedy-of-puddnhead-wilson": {
    "title": "The Tragedy of Pudd'nhead Wilson",
    "author": "Mark Twain",
    "year": 1894,
    "synopsis": "An enslaved woman swaps her baby with her master's, and a lawyer's fingerprints reveal the truth years later.",
    "publicDomain": true
  },
  "the-book-of-dragons": {
    "title": "The Book of Dragons",
    "author": "E. Nesbit",
    "year": 1900,
    "synopsis": "Eight funny stories about dragons, from a dragon that lives in a book to one that eats the sun.",
    "publicDomain": true
  },
  "trents-last-case": {
    "title": "Trent's Last Case",
    "author": "E. C. Bentley",
    "year": 1913,
    "synopsis": "An artist and amateur detective investigates the shooting of a powerful financier.",
    "publicDomain": true
  },
  "micah-clarke": {
    "title": "Micah Clarke",
    "author": "Arthur Conan Doyle",
    "year": 1889,
    "synopsis": "A young Puritan joins the Duke of Monmouth's rebellion in 1685.",
    "publicDomain": true
  },
  "catriona": {
    "title": "Catriona",
    "author": "Robert Louis Stevenson",
    "year": 1893,
    "synopsis": "David Balfour, hero of Kidnapped, tries to save a man from the gallows and falls in love with Catriona.",
    "publicDomain": true
  },
  "what-katy-did-next": {
    "title": "What Katy Did Next",
    "author": "Susan Coolidge",
    "year": 1886,
    "synopsis": "Katy travels to Europe as the companion of a family friend and meets a naval officer.",
    "publicDomain": true
  },
  "celtic-fairy-tales": {
    "title": "Celtic Fairy Tales",
    "author": "Joseph Jacobs",
    "year": 1892,
    "synopsis": "Fairy tales from Ireland, Scotland, Wales and Cornwall.",
    "publicDomain": true
  },
  "the-good-soldier": {
    "title": "The Good Soldier",
    "author": "Ford Madox Ford",
    "year": 1915,
    "synopsis": "An American looks back on nine years of friendship with an English couple and what he never saw.",
    "publicDomain": true
  },
  "the-castle-of-otranto": {
    "title": "The Castle of Otranto",
    "author": "Horace Walpole",
    "year": 1764,
    "synopsis": "A giant helmet falls from the sky and the tyrant Manfred's line begins to crumble, in the first gothic novel.",
    "publicDomain": true
  },
  "nostromo": {
    "title": "Nostromo",
    "author": "Joseph Conrad",
    "year": 1904,
    "synopsis": "In a South American republic, a silver mine and a trusted sailor are caught up in revolution.",
    "publicDomain": true
  },
  "something-new": {
    "title": "Something New",
    "author": "P. G. Wodehouse",
    "year": 1915,
    "synopsis": "A young writer takes a job at Blandings Castle to steal back a precious scarab from Lord Emsworth.",
    "publicDomain": true
  },
  "the-old-wives-tale": {
    "title": "The Old Wives' Tale",
    "author": "Arnold Bennett",
    "year": 1908,
    "synopsis": "Two sisters grow up above their mother's draper's shop in the Potteries: one stays, one elopes to Paris, and their lives run on for fifty years.",
    "publicDomain": true
  },
  "the-souls-of-black-folk": {
    "title": "The Souls of Black Folk",
    "author": "W. E. B. Du Bois",
    "year": 1903,
    "synopsis": "Essays on Black life in America after emancipation, and the double consciousness of living behind the colour line.",
    "publicDomain": true
  },
  "the-secret-agent": {
    "title": "The Secret Agent",
    "author": "Joseph Conrad",
    "year": 1907,
    "synopsis": "A London shopkeeper who spies for a foreign embassy is pushed to plant a bomb at the Greenwich Observatory.",
    "publicDomain": true
  },
  "women-in-love": {
    "title": "Women in Love",
    "author": "D. H. Lawrence",
    "year": 1920,
    "synopsis": "Two sisters in a Midlands mining town, Ursula and Gudrun Brangwen, fall in love with two very different men.",
    "publicDomain": true
  },
  "the-small-house-at-allington": {
    "title": "The Small House at Allington",
    "author": "Anthony Trollope",
    "year": 1864,
    "synopsis": "Lily Dale gives her heart to a man who jilts her for an earl's daughter, while a shy clerk loves her faithfully.",
    "publicDomain": true
  },
  "the-last-chronicle-of-barset": {
    "title": "The Last Chronicle of Barset",
    "author": "Anthony Trollope",
    "year": 1867,
    "synopsis": "A poor, proud curate is accused of stealing a cheque, and all Barsetshire takes sides, in the last of the Barchester novels.",
    "publicDomain": true
  },
  "orley-farm": {
    "title": "Orley Farm",
    "author": "Anthony Trollope",
    "year": 1862,
    "synopsis": "Twenty years after a will gave her son the family farm, a gracious widow faces a new trial over how it was won.",
    "publicDomain": true
  },
  "the-three-clerks": {
    "title": "The Three Clerks",
    "author": "Anthony Trollope",
    "year": 1858,
    "synopsis": "Three young civil servants in London rise and fall as they court three sisters.",
    "publicDomain": true
  },
  "the-dukes-children": {
    "title": "The Duke's Children",
    "author": "Anthony Trollope",
    "year": 1879,
    "synopsis": "A widowed duke tries to steer his grown children's marriages and finds they have their own ideas.",
    "publicDomain": true
  },
  "phineas-finn": {
    "title": "Phineas Finn",
    "author": "Anthony Trollope",
    "year": 1869,
    "synopsis": "A handsome young Irishman enters Parliament and London society, where three women shape his career.",
    "publicDomain": true
  },
  "cousin-henry": {
    "title": "Cousin Henry",
    "author": "Anthony Trollope",
    "year": 1879,
    "synopsis": "A timid man inherits a Welsh estate by a will he knows was replaced, and cannot bring himself to destroy or reveal the other.",
    "publicDomain": true
  },
  "phineas-redux": {
    "title": "Phineas Redux",
    "author": "Anthony Trollope",
    "year": 1874,
    "synopsis": "Phineas Finn returns to politics and is accused of murdering a rival.",
    "publicDomain": true
  },
  "the-eustace-diamonds": {
    "title": "The Eustace Diamonds",
    "author": "Anthony Trollope",
    "year": 1873,
    "synopsis": "A beautiful widow insists a fabulous diamond necklace was a gift, and lies her way into deeper trouble when it is stolen.",
    "publicDomain": true
  },
  "the-prime-minister": {
    "title": "The Prime Minister",
    "author": "Anthony Trollope",
    "year": 1876,
    "synopsis": "Plantagenet Palliser leads a coalition government, while a charming swindler marries into a respectable family.",
    "publicDomain": true
  },
  "miss-mackenzie": {
    "title": "Miss Mackenzie",
    "author": "Anthony Trollope",
    "year": 1865,
    "synopsis": "A spinster who has spent her life nursing relatives inherits money and is pursued by suitors of every kind.",
    "publicDomain": true
  },
  "he-knew-he-was-right": {
    "title": "He Knew He Was Right",
    "author": "Anthony Trollope",
    "year": 1869,
    "synopsis": "A husband's jealousy over his wife's friendship with an older man destroys their marriage.",
    "publicDomain": true
  },
  "the-law-and-the-lady": {
    "title": "The Law and the Lady",
    "author": "Wilkie Collins",
    "year": 1875,
    "synopsis": "A new bride discovers her husband was once tried for poisoning his first wife, and sets out to clear his name.",
    "publicDomain": true
  },
  "quentin-durward": {
    "title": "Quentin Durward",
    "author": "Walter Scott",
    "year": 1823,
    "synopsis": "A young Scottish archer serves the cunning Louis XI of France and protects a countess in flight.",
    "publicDomain": true
  },
  "scenes-of-clerical-life": {
    "title": "Scenes of Clerical Life",
    "author": "George Eliot",
    "year": 1858,
    "synopsis": "George Eliot's first fiction: three stories of country clergymen and the people of their parishes.",
    "publicDomain": true
  },
  "ruth": {
    "title": "Ruth",
    "author": "Elizabeth Gaskell",
    "year": 1853,
    "synopsis": "An orphaned seamstress is seduced and abandoned, and a kind minister and his sister take her in under a new name.",
    "publicDomain": true
  },
  "the-virginians": {
    "title": "The Virginians",
    "author": "William Makepeace Thackeray",
    "year": 1859,
    "synopsis": "Twin brothers from Virginia, grandsons of Henry Esmond, come to England and later fight on opposite sides in the American Revolution.",
    "publicDomain": true
  },
  "the-odd-women": {
    "title": "The Odd Women",
    "author": "George Gissing",
    "year": 1893,
    "synopsis": "Three unmarried sisters struggle in a London where there are more women than men, and two friends train women for office work.",
    "publicDomain": true
  },
  "uncle-bernac": {
    "title": "Uncle Bernac",
    "author": "Arthur Conan Doyle",
    "year": 1897,
    "synopsis": "A young Frenchman returns from exile to Napoleon's camp at Boulogne and is drawn into his uncle's schemes.",
    "publicDomain": true
  },
  "love-and-mr-lewisham": {
    "title": "Love and Mr. Lewisham",
    "author": "H. G. Wells",
    "year": 1900,
    "synopsis": "An ambitious young teacher gives up his grand plans for love, and wonders if it was worth it.",
    "publicDomain": true
  },
  "the-fur-country": {
    "title": "The Fur Country",
    "author": "Jules Verne",
    "year": 1873,
    "synopsis": "Hudson's Bay Company settlers build a fort in the Arctic, then find it is on a piece of ice drifting out to sea.",
    "publicDomain": true
  },
  "godfrey-morgan": {
    "title": "Godfrey Morgan",
    "author": "Jules Verne",
    "year": 1882,
    "synopsis": "A rich young Californian and his dancing master are shipwrecked on a Pacific island and must learn to survive.",
    "publicDomain": true
  },
  "the-blockade-runners": {
    "title": "The Blockade Runners",
    "author": "Jules Verne",
    "year": 1871,
    "synopsis": "A Scottish steamer runs the Union blockade of Charleston during the American Civil War.",
    "publicDomain": true
  },
  "eric-brighteyes": {
    "title": "Eric Brighteyes",
    "author": "H. Rider Haggard",
    "year": 1891,
    "synopsis": "A Viking hero of Iceland loves the fair Gudruda while a witch-woman schemes to have him for herself.",
    "publicDomain": true
  },
  "jungle-tales-of-tarzan": {
    "title": "Jungle Tales of Tarzan",
    "author": "Edgar Rice Burroughs",
    "year": 1919,
    "synopsis": "Stories of young Tarzan's life among the apes, before he met any other human.",
    "publicDomain": true
  },
  "tarzan-and-the-jewels-of-opar": {
    "title": "Tarzan and the Jewels of Opar",
    "author": "Edgar Rice Burroughs",
    "year": 1916,
    "synopsis": "Tarzan returns to the lost city of Opar for its gold, and a blow to the head leaves him without his memory.",
    "publicDomain": true
  },
  "tarzan-and-the-ant-men": {
    "title": "Tarzan and the Ant Men",
    "author": "Edgar Rice Burroughs",
    "year": 1924,
    "synopsis": "Tarzan crashes in a hidden land and is captured by a tiny race of warriors.",
    "publicDomain": true
  },
  "tarzan-the-terrible": {
    "title": "Tarzan the Terrible",
    "author": "Edgar Rice Burroughs",
    "year": 1921,
    "synopsis": "Searching for Jane, Tarzan crosses into Pal-ul-don, a lost valley of dinosaurs and tailed humans.",
    "publicDomain": true
  },
  "the-people-that-time-forgot": {
    "title": "The People That Time Forgot",
    "author": "Edgar Rice Burroughs",
    "year": 1918,
    "synopsis": "A rescue mission flies to the lost island of Caspak and finds a young woman of its strange tribes.",
    "publicDomain": true
  },
  "the-monster-men": {
    "title": "The Monster Men",
    "author": "Edgar Rice Burroughs",
    "year": 1913,
    "synopsis": "A scientist on a remote island creates artificial men, and one of them is not what he seems.",
    "publicDomain": true
  },
  "the-cave-girl": {
    "title": "The Cave Girl",
    "author": "Edgar Rice Burroughs",
    "year": 1913,
    "synopsis": "A sickly Boston man is shipwrecked on an island of primitive people and grows strong for the love of a cave girl.",
    "publicDomain": true
  },
  "sky-island": {
    "title": "Sky Island",
    "author": "L. Frank Baum",
    "year": 1912,
    "synopsis": "Trot, Cap'n Bill and Button-Bright fly on a magic umbrella to an island in the sky.",
    "publicDomain": true
  },
  "hospital-sketches": {
    "title": "Hospital Sketches",
    "author": "Louisa May Alcott",
    "year": 1863,
    "synopsis": "Alcott's lively, moving account of nursing wounded soldiers in a Washington hospital during the Civil War.",
    "publicDomain": true
  },
  "just-david": {
    "title": "Just David",
    "author": "Eleanor H. Porter",
    "year": 1916,
    "synopsis": "A boy raised in the mountains by his violinist father comes down into a village after his father dies.",
    "publicDomain": true
  },
  "michael-ohalloran": {
    "title": "Michael O'Halloran",
    "author": "Gene Stratton-Porter",
    "year": 1915,
    "synopsis": "An orphaned Irish newsboy in an Indiana city takes in a little crippled girl and helps the grown-ups around him.",
    "publicDomain": true
  },
  "the-birds-christmas-carol": {
    "title": "The Birds' Christmas Carol",
    "author": "Kate Douglas Wiggin",
    "year": 1887,
    "synopsis": "A frail girl born on Christmas Day gives a Christmas dinner to the nine Ruggles children next door.",
    "publicDomain": true
  },
  "moths-of-the-limberlost": {
    "title": "Moths of the Limberlost",
    "author": "Gene Stratton-Porter",
    "year": 1912,
    "synopsis": "The author's account of finding, raising and photographing the great moths of the Indiana swamps.",
    "publicDomain": true
  },
  "when-patty-went-to-college": {
    "title": "When Patty Went to College",
    "author": "Jean Webster",
    "year": 1903,
    "synopsis": "Patty Wyatt plays pranks and makes friends in her last year at a women's college.",
    "publicDomain": true
  },
  "clover": {
    "title": "Clover",
    "author": "Susan Coolidge",
    "year": 1888,
    "synopsis": "Katy's sister Clover travels to Colorado and finds a new life in the mountains.",
    "publicDomain": true
  },
  "in-the-high-valley": {
    "title": "In the High Valley",
    "author": "Susan Coolidge",
    "year": 1890,
    "synopsis": "An English family settles in a Colorado valley next to Clover and her brother.",
    "publicDomain": true
  },
  "nights-with-uncle-remus": {
    "title": "Nights with Uncle Remus",
    "author": "Joel Chandler Harris",
    "year": 1883,
    "synopsis": "More animal tales of Brer Rabbit and friends, told in dialect by the old storyteller Uncle Remus.",
    "publicDomain": true
  },
  "the-bobbsey-twins-in-the-country": {
    "title": "The Bobbsey Twins in the Country",
    "author": "Laura Lee Hope",
    "year": 1907,
    "synopsis": "The two pairs of twins spend a summer on their uncle's farm.",
    "publicDomain": true
  },
  "tom-swift-and-his-electric-runabout": {
    "title": "Tom Swift and His Electric Runabout",
    "author": "Victor Appleton",
    "year": 1910,
    "synopsis": "Young inventor Tom Swift builds a fast electric car to win a race and catch bank robbers.",
    "publicDomain": true
  },
  "the-adventures-of-jerry-muskrat": {
    "title": "The Adventures of Jerry Muskrat",
    "author": "Thornton W. Burgess",
    "year": 1914,
    "synopsis": "Jerry Muskrat and his friends in the Smiling Pool deal with a dry spell and a dam.",
    "publicDomain": true
  },
  "the-adventures-of-prickly-porky": {
    "title": "The Adventures of Prickly Porky",
    "author": "Thornton W. Burgess",
    "year": 1916,
    "synopsis": "Prickly Porky the porcupine comes to the Green Forest, and nobody dares to bother him.",
    "publicDomain": true
  },
  "mother-west-winds-children": {
    "title": "Mother West Wind's Children",
    "author": "Thornton W. Burgess",
    "year": 1911,
    "synopsis": "More stories of the Merry Little Breezes and the animals of the Green Meadows.",
    "publicDomain": true
  },
  "bowser-the-hound": {
    "title": "Bowser the Hound",
    "author": "Thornton W. Burgess",
    "year": 1920,
    "synopsis": "Bowser the Hound loves to hunt Reddy and Granny Fox, but foxes are cleverer than dogs.",
    "publicDomain": true
  },
  "whitefoot-the-wood-mouse": {
    "title": "Whitefoot the Wood Mouse",
    "author": "Thornton W. Burgess",
    "year": 1922,
    "synopsis": "Little Whitefoot keeps a step ahead of Shadow the Weasel and Hooty the Owl.",
    "publicDomain": true
  },
  "the-girl-in-the-golden-atom": {
    "title": "The Girl in the Golden Atom",
    "author": "Ray Cummings",
    "year": 1922,
    "synopsis": "A chemist shrinks himself to visit a world inside an atom of gold, and falls in love with a girl there.",
    "publicDomain": true
  },
  "wieland": {
    "title": "Wieland",
    "author": "Charles Brockden Brown",
    "year": 1798,
    "synopsis": "A devout Pennsylvania family is torn apart by mysterious voices, in one of the first American novels.",
    "publicDomain": true
  },
  "the-return": {
    "title": "The Return",
    "author": "Walter de la Mare",
    "year": 1910,
    "synopsis": "After falling asleep by a grave, a man wakes to find his face has become that of a long-dead stranger.",
    "publicDomain": true
  },
  "the-crystal-stopper": {
    "title": "The Crystal Stopper",
    "author": "Maurice Leblanc",
    "year": 1912,
    "synopsis": "Arsène Lupin races a corrupt politician for a crystal stopper hiding a list that could bring down powerful men.",
    "publicDomain": true
  },
  "the-eye-of-osiris": {
    "title": "The Eye of Osiris",
    "author": "R. Austin Freeman",
    "year": 1911,
    "synopsis": "An Egyptologist vanishes, and Dr Thorndyke uses science to find out what became of him.",
    "publicDomain": true
  },
  "the-man-who-knew-too-much": {
    "title": "The Man Who Knew Too Much",
    "author": "G. K. Chesterton",
    "year": 1922,
    "synopsis": "Horne Fisher, who knows everyone's secrets, solves crimes that powerful people would rather not see solved.",
    "publicDomain": true
  },
  "the-maltese-falcon": {
    "title": "The Maltese Falcon",
    "author": "Dashiell Hammett",
    "year": 1930,
    "synopsis": "Private detective Sam Spade's partner is shot, and Spade is drawn into a deadly hunt for a jewelled statuette.",
    "publicDomain": true
  },
  "bardelys-the-magnificent": {
    "title": "Bardelys the Magnificent",
    "author": "Rafael Sabatini",
    "year": 1906,
    "synopsis": "A French nobleman bets he can win a famously cold heiress, and takes a dead man's name to do it.",
    "publicDomain": true
  },
  "fortunes-fool": {
    "title": "Fortune's Fool",
    "author": "Rafael Sabatini",
    "year": 1923,
    "synopsis": "A disgraced soldier in plague-stricken London tries to win back his honour.",
    "publicDomain": true
  },
  "king-of-the-khyber-rifles": {
    "title": "King of the Khyber Rifles",
    "author": "Talbot Mundy",
    "year": 1916,
    "synopsis": "A British officer in India is sent beyond the Khyber Pass to stop a rising, with a mysterious woman as his ally.",
    "publicDomain": true
  },
  "the-border-legion": {
    "title": "The Border Legion",
    "author": "Zane Grey",
    "year": 1916,
    "synopsis": "A young woman is captured by an outlaw gang in Idaho gold country, and its leader falls for her.",
    "publicDomain": true
  },
  "the-untamed": {
    "title": "The Untamed",
    "author": "Max Brand",
    "year": 1919,
    "synopsis": "Whistling Dan Barry, a gentle man with a wild streak, sets out after the outlaw who struck him.",
    "publicDomain": true
  },
  "the-spoilers": {
    "title": "The Spoilers",
    "author": "Rex Beach",
    "year": 1906,
    "synopsis": "Gold miners in Nome fight crooked officials who are stealing their claims.",
    "publicDomain": true
  },
  "the-game": {
    "title": "The Game",
    "author": "Jack London",
    "year": 1905,
    "synopsis": "A young boxer promises his fiancée one last fight, and she watches it in secret.",
    "publicDomain": true
  },
  "a-daughter-of-the-snows": {
    "title": "A Daughter of the Snows",
    "author": "Jack London",
    "year": 1902,
    "synopsis": "Frona Welse comes home to the Klondike, a woman of the frontier who chooses her own way.",
    "publicDomain": true
  },
  "the-golden-bowl": {
    "title": "The Golden Bowl",
    "author": "Henry James",
    "year": 1904,
    "synopsis": "A rich American and her father both marry, and their spouses share a past that the daughter slowly uncovers.",
    "publicDomain": true
  },
  "the-aspern-papers": {
    "title": "The Aspern Papers",
    "author": "Henry James",
    "year": 1888,
    "synopsis": "A scholar takes rooms in a Venetian palazzo to get his hands on a dead poet's letters, kept by his elderly lover.",
    "publicDomain": true
  },
  "the-glimpses-of-the-moon": {
    "title": "The Glimpses of the Moon",
    "author": "Edith Wharton",
    "year": 1922,
    "synopsis": "Two charming, penniless young people marry to live off their rich friends for a year, then fall in love for real.",
    "publicDomain": true
  },
  "the-fruit-of-the-tree": {
    "title": "The Fruit of the Tree",
    "author": "Edith Wharton",
    "year": 1907,
    "synopsis": "A mill reformer and a nurse face hard questions about money, labour and mercy.",
    "publicDomain": true
  },
  "the-professors-house": {
    "title": "The Professor's House",
    "author": "Willa Cather",
    "year": 1925,
    "synopsis": "A professor refuses to leave his old study, remembering a student who found a lost city in the mesas.",
    "publicDomain": true
  },
  "one-of-ours": {
    "title": "One of Ours",
    "author": "Willa Cather",
    "year": 1922,
    "synopsis": "A restless Nebraska farm boy finds purpose as a soldier in France in the First World War.",
    "publicDomain": true
  },
  "jennie-gerhardt": {
    "title": "Jennie Gerhardt",
    "author": "Theodore Dreiser",
    "year": 1911,
    "synopsis": "A poor, generous young woman is loved by two powerful men who will not marry her.",
    "publicDomain": true
  },
  "free-air": {
    "title": "Free Air",
    "author": "Sinclair Lewis",
    "year": 1919,
    "synopsis": "A wealthy New York woman drives across America and a small-town mechanic follows her west.",
    "publicDomain": true
  },
  "the-sun-also-rises": {
    "title": "The Sun Also Rises",
    "author": "Ernest Hemingway",
    "year": 1926,
    "synopsis": "American and British expatriates drift from Paris cafés to the bullfights of Pamplona after the First World War.",
    "publicDomain": true
  },
  "poor-white": {
    "title": "Poor White",
    "author": "Sherwood Anderson",
    "year": 1920,
    "synopsis": "A lanky inventor from Missouri transforms a quiet Ohio town with his machines.",
    "publicDomain": true
  },
  "crome-yellow": {
    "title": "Crome Yellow",
    "author": "Aldous Huxley",
    "year": 1921,
    "synopsis": "A young poet spends a summer at a country house full of eccentric guests, in Huxley's comic first novel.",
    "publicDomain": true
  },
  "the-country-house": {
    "title": "The Country House",
    "author": "John Galsworthy",
    "year": 1907,
    "synopsis": "A squire's son falls for a married woman, and his mother must save the family's name.",
    "publicDomain": true
  },
  "riceyman-steps": {
    "title": "Riceyman Steps",
    "author": "Arnold Bennett",
    "year": 1923,
    "synopsis": "A miserly London bookseller marries a widow, and his meanness slowly wrecks their life.",
    "publicDomain": true
  },
  "buried-alive": {
    "title": "Buried Alive",
    "author": "Arnold Bennett",
    "year": 1908,
    "synopsis": "A shy famous painter swaps identities with his dead valet, and finds himself happily anonymous.",
    "publicDomain": true
  },
  "liza-of-lambeth": {
    "title": "Liza of Lambeth",
    "author": "W. Somerset Maugham",
    "year": 1897,
    "synopsis": "A lively factory girl in a London slum falls in love with a married man.",
    "publicDomain": true
  },
  "the-patrician": {
    "title": "The Patrician",
    "author": "John Galsworthy",
    "year": 1911,
    "synopsis": "An aristocratic young politician falls in love with a woman separated from her husband.",
    "publicDomain": true
  },
  "the-club-of-queer-trades": {
    "title": "The Club of Queer Trades",
    "author": "G. K. Chesterton",
    "year": 1905,
    "synopsis": "A former judge and his friends investigate members of a club where everyone has invented a new profession.",
    "publicDomain": true
  },
  "the-unbearable-bassington": {
    "title": "The Unbearable Bassington",
    "author": "Saki",
    "year": 1912,
    "synopsis": "A handsome, idle young man and his mother navigate London society with sharp wit and little sense.",
    "publicDomain": true
  },
  "the-coming-of-bill": {
    "title": "The Coming of Bill",
    "author": "P. G. Wodehouse",
    "year": 1919,
    "synopsis": "A rich young woman marries a boxer and raises their baby by scientific rules.",
    "publicDomain": true
  },
  "jill-the-reckless": {
    "title": "Jill the Reckless",
    "author": "P. G. Wodehouse",
    "year": 1920,
    "synopsis": "Jill loses her fortune and her fiancé in one week, and lands in the chorus of a Broadway show.",
    "publicDomain": true
  },
  "uneasy-money": {
    "title": "Uneasy Money",
    "author": "P. G. Wodehouse",
    "year": 1916,
    "synopsis": "An English lord inherits a fortune meant for others and sets out to share it, incognito, in America.",
    "publicDomain": true
  },
  "the-prince-and-betty": {
    "title": "The Prince and Betty",
    "author": "P. G. Wodehouse",
    "year": 1912,
    "synopsis": "A young American learns he is heir to a Mediterranean principality bought by a scheming financier.",
    "publicDomain": true
  },
  "love-among-the-chickens": {
    "title": "Love Among the Chickens",
    "author": "P. G. Wodehouse",
    "year": 1906,
    "synopsis": "Ukridge talks a writer into running a chicken farm in Dorset.",
    "publicDomain": true
  },
  "indiscretions-of-archie": {
    "title": "Indiscretions of Archie",
    "author": "P. G. Wodehouse",
    "year": 1921,
    "synopsis": "An amiable young Englishman marries a hotel owner's daughter in New York and keeps annoying his father-in-law.",
    "publicDomain": true
  },
  "the-house-of-the-dead": {
    "title": "The House of the Dead",
    "author": "Fyodor Dostoyevsky",
    "year": 1862,
    "synopsis": "A gentleman convict describes his years in a Siberian prison camp, drawn from Dostoyevsky's own.",
    "publicDomain": true
  },
  "chicot-the-jester": {
    "title": "Chicot the Jester",
    "author": "Alexandre Dumas",
    "year": 1846,
    "synopsis": "The witty court jester Chicot protects King Henri III from plots in Paris.",
    "publicDomain": true
  },
  "moni-the-goat-boy": {
    "title": "Moni the Goat-Boy",
    "author": "Johanna Spyri",
    "year": 1886,
    "synopsis": "A cheerful goat-herd in the Swiss mountains loses his happiness and finds it again.",
    "publicDomain": true
  },
  "growth-of-the-soil": {
    "title": "Growth of the Soil",
    "author": "Knut Hamsun",
    "year": 1917,
    "synopsis": "A man clears land in the Norwegian wilderness and builds a farm and a family.",
    "publicDomain": true
  },
  "evangeline": {
    "title": "Evangeline",
    "author": "Henry Wadsworth Longfellow",
    "year": 1847,
    "synopsis": "An Acadian girl searches America for the lover she was parted from when their people were exiled.",
    "publicDomain": true
  },
  "rachel-ray": {
    "title": "Rachel Ray",
    "author": "Anthony Trollope",
    "year": 1863,
    "synopsis": "In a strict household in a Devon town, Rachel falls for a young brewer that the gossips disapprove of.",
    "publicDomain": true
  },
  "the-american-senator": {
    "title": "The American Senator",
    "author": "Anthony Trollope",
    "year": 1877,
    "synopsis": "A visiting American senator comments on English country life while two romances play out.",
    "publicDomain": true
  },
  "my-lady-ludlow": {
    "title": "My Lady Ludlow",
    "author": "Elizabeth Gaskell",
    "year": 1858,
    "synopsis": "A poor girl joins the household of a proud old aristocrat who distrusts education for the lower classes.",
    "publicDomain": true
  },
  "the-newcomes": {
    "title": "The Newcomes",
    "author": "William Makepeace Thackeray",
    "year": 1855,
    "synopsis": "Kind Colonel Newcome and his son Clive face money troubles and an unhappy marriage.",
    "publicDomain": true
  },
  "diana-of-the-crossways": {
    "title": "Diana of the Crossways",
    "author": "George Meredith",
    "year": 1885,
    "synopsis": "A brilliant, independent Irishwoman is caught in a political scandal in London society.",
    "publicDomain": true
  },
  "the-ordeal-of-richard-feverel": {
    "title": "The Ordeal of Richard Feverel",
    "author": "George Meredith",
    "year": 1859,
    "synopsis": "A father raises his son by a strict system, and the system fails when the boy falls in love.",
    "publicDomain": true
  },
  "off-on-a-comet": {
    "title": "Off on a Comet",
    "author": "Jules Verne",
    "year": 1877,
    "synopsis": "A comet grazes the Earth and carries off a French officer and others across the solar system.",
    "publicDomain": true
  },
  "the-underground-city": {
    "title": "The Underground City",
    "author": "Jules Verne",
    "year": 1877,
    "synopsis": "An engineer returns to a Scottish coal mine and discovers a vast new seam and a hidden enemy.",
    "publicDomain": true
  },
  "eight-hundred-leagues-on-the-amazon": {
    "title": "Eight Hundred Leagues on the Amazon",
    "author": "Jules Verne",
    "year": 1881,
    "synopsis": "A wealthy farmer floats his family down the Amazon on a giant raft, hiding a secret from his past.",
    "publicDomain": true
  },
  "tarzan-the-untamed": {
    "title": "Tarzan the Untamed",
    "author": "Edgar Rice Burroughs",
    "year": 1920,
    "synopsis": "Tarzan takes his own war to the German army in East Africa during the First World War.",
    "publicDomain": true
  },
  "the-outlaw-of-torn": {
    "title": "The Outlaw of Torn",
    "author": "Edgar Rice Burroughs",
    "year": 1914,
    "synopsis": "A stolen English prince is raised to hate his own people and becomes a feared outlaw.",
    "publicDomain": true
  },
  "moods": {
    "title": "Moods",
    "author": "Louisa May Alcott",
    "year": 1864,
    "synopsis": "Moody, impulsive Sylvia Yule marries one man while loving another.",
    "publicDomain": true
  },
  "a-fair-barbarian": {
    "title": "A Fair Barbarian",
    "author": "Frances Hodgson Burnett",
    "year": 1881,
    "synopsis": "A frank young American heiress turns a sleepy English village upside down.",
    "publicDomain": true
  },
  "the-head-of-the-house-of-coombe": {
    "title": "The Head of the House of Coombe",
    "author": "Frances Hodgson Burnett",
    "year": 1922,
    "synopsis": "A neglected girl grows up under the eye of a mysterious lord in Edwardian London.",
    "publicDomain": true
  },
  "just-patty": {
    "title": "Just Patty",
    "author": "Jean Webster",
    "year": 1911,
    "synopsis": "Patty and her friends get into scrapes at a girls' boarding school.",
    "publicDomain": true
  },
  "davy-and-the-goblin": {
    "title": "Davy and the Goblin",
    "author": "Charles E. Carryl",
    "year": 1885,
    "synopsis": "On Christmas Eve a goblin takes Davy on a journey through a land of nursery rhymes and fairy tales.",
    "publicDomain": true
  },
  "the-story-of-a-bad-boy": {
    "title": "The Story of a Bad Boy",
    "author": "Thomas Bailey Aldrich",
    "year": 1870,
    "synopsis": "The author remembers boyhood pranks and adventures in a New England seaport.",
    "publicDomain": true
  },
  "the-bobbsey-twins-at-the-seashore": {
    "title": "The Bobbsey Twins at the Seashore",
    "author": "Laura Lee Hope",
    "year": 1907,
    "synopsis": "The twins spend a summer by the sea, with a storm, a shipwreck and a lost boy.",
    "publicDomain": true
  },
  "the-bobbsey-twins-at-school": {
    "title": "The Bobbsey Twins at School",
    "author": "Laura Lee Hope",
    "year": 1913,
    "synopsis": "The twins go back to school and try to find a missing circus dog.",
    "publicDomain": true
  },
  "tom-swift-and-his-airship": {
    "title": "Tom Swift and His Airship",
    "author": "Victor Appleton",
    "year": 1910,
    "synopsis": "Tom builds an airship, the Red Cloud, and is wrongly accused of robbing a bank.",
    "publicDomain": true
  },
  "tom-swift-and-his-submarine-boat": {
    "title": "Tom Swift and His Submarine Boat",
    "author": "Victor Appleton",
    "year": 1910,
    "synopsis": "Tom and his father build a submarine to recover sunken treasure before rivals reach it.",
    "publicDomain": true
  },
  "tom-swift-and-his-wireless-message": {
    "title": "Tom Swift and His Wireless Message",
    "author": "Victor Appleton",
    "year": 1911,
    "synopsis": "Shipwrecked on an island, Tom builds a wireless set from scraps to call for rescue.",
    "publicDomain": true
  },
  "tom-swift-among-the-diamond-makers": {
    "title": "Tom Swift Among the Diamond Makers",
    "author": "Victor Appleton",
    "year": 1911,
    "synopsis": "Tom follows a trail of fake diamonds to a hidden mountain where they are made.",
    "publicDomain": true
  },
  "tom-swift-and-his-sky-racer": {
    "title": "Tom Swift and His Sky Racer",
    "author": "Victor Appleton",
    "year": 1911,
    "synopsis": "Tom builds the fastest monoplane yet to win a race and save a friend.",
    "publicDomain": true
  },
  "the-adventures-of-unc-billy-possum": {
    "title": "The Adventures of Unc' Billy Possum",
    "author": "Thornton W. Burgess",
    "year": 1914,
    "synopsis": "Unc' Billy Possum comes up from Ol' Virginny and plays dead to get out of trouble.",
    "publicDomain": true
  },
  "the-adventures-of-grandfather-frog": {
    "title": "The Adventures of Grandfather Frog",
    "author": "Thornton W. Burgess",
    "year": 1915,
    "synopsis": "Wise old Grandfather Frog has adventures around the Smiling Pool.",
    "publicDomain": true
  },
  "edisons-conquest-of-mars": {
    "title": "Edison's Conquest of Mars",
    "author": "Garrett P. Serviss",
    "year": 1898,
    "synopsis": "After the Martian invasion, Thomas Edison leads a fleet of spaceships to strike back at Mars.",
    "publicDomain": true
  },
  "the-mystery-of-the-sea": {
    "title": "The Mystery of the Sea",
    "author": "Bram Stoker",
    "year": 1902,
    "synopsis": "A man with second sight on the Scottish coast uncovers a hidden Spanish treasure and a kidnapping plot.",
    "publicDomain": true
  },
  "the-tavern-knight": {
    "title": "The Tavern Knight",
    "author": "Rafael Sabatini",
    "year": 1904,
    "synopsis": "A hard-drinking Royalist soldier plots revenge on the man who ruined his family.",
    "publicDomain": true
  },
  "the-league-of-the-scarlet-pimpernel": {
    "title": "The League of the Scarlet Pimpernel",
    "author": "Baroness Orczy",
    "year": 1919,
    "synopsis": "Stories of the Scarlet Pimpernel's league and their rescues during the Terror.",
    "publicDomain": true
  },
  "the-reef": {
    "title": "The Reef",
    "author": "Edith Wharton",
    "year": 1912,
    "synopsis": "A diplomat on his way to marry a widow in France has a brief affair, and it returns to haunt him.",
    "publicDomain": true
  },
  "so-big": {
    "title": "So Big",
    "author": "Edna Ferber",
    "year": 1924,
    "synopsis": "A widow raises her son on a vegetable farm near Chicago and hopes he will value beauty more than money.",
    "publicDomain": true
  },
  "show-boat": {
    "title": "Show Boat",
    "author": "Edna Ferber",
    "year": 1926,
    "synopsis": "Three generations of a family live and perform aboard a Mississippi River show boat.",
    "publicDomain": true
  },
  "the-ball-and-the-cross": {
    "title": "The Ball and the Cross",
    "author": "G. K. Chesterton",
    "year": 1909,
    "synopsis": "An atheist and a Catholic want to fight a duel over God, and all England tries to stop them.",
    "publicDomain": true
  },
  "the-clicking-of-cuthbert": {
    "title": "The Clicking of Cuthbert",
    "author": "P. G. Wodehouse",
    "year": 1922,
    "synopsis": "The Oldest Member tells comic stories of golf and love.",
    "publicDomain": true
  },
  "ten-years-later": {
    "title": "Ten Years Later",
    "author": "Alexandre Dumas",
    "year": 1848,
    "synopsis": "D'Artagnan and his friends serve the young Louis XIV as the king takes power.",
    "publicDomain": true
  },
  "louise-de-la-valliere": {
    "title": "Louise de la Valliere",
    "author": "Alexandre Dumas",
    "year": 1849,
    "synopsis": "Intrigues at the court of Louis XIV as the king falls in love with a shy lady-in-waiting.",
    "publicDomain": true
  },
  "tartarin-of-tarascon": {
    "title": "Tartarin of Tarascon",
    "author": "Alphonse Daudet",
    "year": 1872,
    "synopsis": "A boastful man from a small Provençal town goes to Algeria to hunt lions.",
    "publicDomain": true
  },
  "the-problems-of-philosophy": {
    "title": "The Problems of Philosophy",
    "author": "Bertrand Russell",
    "year": 1912,
    "synopsis": "A short, clear introduction to the big questions of what we can know about the world.",
    "publicDomain": true
  },
  "the-history-of-pendennis": {
    "title": "The History of Pendennis",
    "author": "William Makepeace Thackeray",
    "year": 1850,
    "synopsis": "Young Arthur Pendennis goes to university and London, falls in and out of love and becomes a writer.",
    "publicDomain": true
  },
  "a-laodicean": {
    "title": "A Laodicean",
    "author": "Thomas Hardy",
    "year": 1881,
    "synopsis": "A young architect falls for the modern heiress of a castle, who cannot make up her mind.",
    "publicDomain": true
  },
  "two-on-a-tower": {
    "title": "Two on a Tower",
    "author": "Thomas Hardy",
    "year": 1882,
    "synopsis": "A lonely lady and a young astronomer fall in love in the tower where he studies the stars.",
    "publicDomain": true
  },
  "old-mortality": {
    "title": "Old Mortality",
    "author": "Walter Scott",
    "year": 1816,
    "synopsis": "A moderate young man is caught between Covenanters and Royalist troops in seventeenth-century Scotland.",
    "publicDomain": true
  },
  "the-firm-of-girdlestone": {
    "title": "The Firm of Girdlestone",
    "author": "Arthur Conan Doyle",
    "year": 1890,
    "synopsis": "A respectable but failing firm of merchants plots to marry its ward's fortune into the family.",
    "publicDomain": true
  },
  "montezumas-daughter": {
    "title": "Montezuma's Daughter",
    "author": "H. Rider Haggard",
    "year": 1893,
    "synopsis": "An Englishman seeking revenge travels to Mexico and lives through the Spanish conquest of the Aztecs.",
    "publicDomain": true
  },
  "a-hazard-of-new-fortunes": {
    "title": "A Hazard of New Fortunes",
    "author": "William Dean Howells",
    "year": 1890,
    "synopsis": "A Boston editor moves to New York to start a magazine, and its backers and staff clash over money and justice.",
    "publicDomain": true
  },
  "the-titan": {
    "title": "The Titan",
    "author": "Theodore Dreiser",
    "year": 1914,
    "synopsis": "Financier Frank Cowperwood moves to Chicago and sets out to control its streetcar lines.",
    "publicDomain": true
  },
  "germinal": {
    "title": "Germinal",
    "author": "Émile Zola",
    "year": 1885,
    "synopsis": "A young man arrives at a coal mine in northern France and leads the miners in a desperate strike.",
    "publicDomain": true
  },
  "the-egoist": {
    "title": "The Egoist",
    "author": "George Meredith",
    "year": 1879,
    "synopsis": "Sir Willoughby Patterne expects his fiancée to admire him, and she wants to escape.",
    "publicDomain": true
  },
  "the-tragic-muse": {
    "title": "The Tragic Muse",
    "author": "Henry James",
    "year": 1890,
    "synopsis": "A young man must choose between politics and painting, while an actress rises to fame.",
    "publicDomain": true
  },
  "sketches-by-boz": {
    "title": "Sketches by Boz",
    "author": "Charles Dickens",
    "year": 1836,
    "synopsis": "Dickens's first book: lively sketches of London streets, people and everyday life.",
    "publicDomain": true
  },
  "the-haunted-hotel": {
    "title": "The Haunted Hotel",
    "author": "Wilkie Collins",
    "year": 1878,
    "synopsis": "A lord dies suspiciously in a Venice palazzo, and the hotel it becomes seems haunted.",
    "publicDomain": true
  },
  "the-bride-of-lammermoor": {
    "title": "The Bride of Lammermoor",
    "author": "Walter Scott",
    "year": 1819,
    "synopsis": "A ruined nobleman falls in love with the daughter of the man who took his family's estate.",
    "publicDomain": true
  },
  "the-mystery-of-a-hansom-cab": {
    "title": "The Mystery of a Hansom Cab",
    "author": "Fergus Hume",
    "year": 1886,
    "synopsis": "A man is found murdered in a hansom cab in Melbourne, and suspicion falls on a young squatter.",
    "publicDomain": true
  },
  "what-maisie-knew": {
    "title": "What Maisie Knew",
    "author": "Henry James",
    "year": 1897,
    "synopsis": "A young girl is passed between her divorced parents and their new partners, and sees more than they think.",
    "publicDomain": true
  },
  "death-comes-for-the-archbishop": {
    "title": "Death Comes for the Archbishop",
    "author": "Willa Cather",
    "year": 1927,
    "synopsis": "A French priest and his friend build a diocese in the vast New Mexico territory.",
    "publicDomain": true
  },
  "the-financier": {
    "title": "The Financier",
    "author": "Theodore Dreiser",
    "year": 1912,
    "synopsis": "Frank Cowperwood rises in Philadelphia finance and falls after the Great Chicago Fire.",
    "publicDomain": true
  },
  "smoke": {
    "title": "Smoke",
    "author": "Ivan Turgenev",
    "year": 1867,
    "synopsis": "In a German spa town, a young Russian meets the woman who once broke his heart.",
    "publicDomain": true
  },
  "the-red-and-the-black": {
    "title": "The Red and the Black",
    "author": "Stendhal",
    "year": 1830,
    "synopsis": "Julien Sorel, a carpenter's ambitious son, uses love to climb in Restoration France.",
    "publicDomain": true
  },
  "the-new-magdalen": {
    "title": "The New Magdalen",
    "author": "Wilkie Collins",
    "year": 1873,
    "synopsis": "A woman with a past takes the identity of a girl she thinks was killed in war.",
    "publicDomain": true
  },
  "the-man-who-laughs": {
    "title": "The Man Who Laughs",
    "author": "Victor Hugo",
    "year": 1869,
    "synopsis": "A boy whose face was carved into a permanent grin grows up with a travelling showman in England.",
    "publicDomain": true
  },
  "the-chessmen-of-mars": {
    "title": "The Chessmen of Mars",
    "author": "Edgar Rice Burroughs",
    "year": 1922,
    "synopsis": "John Carter's daughter is captured on Mars and forced into a game of chess with living pieces.",
    "publicDomain": true
  },
  "the-blind-spot": {
    "title": "The Blind Spot",
    "author": "Austin Hall and Homer Eon Flint",
    "year": 1921,
    "synopsis": "A professor vanishes through a doorway into another dimension, and his friends follow.",
    "publicDomain": true
  },
  "the-lone-star-ranger": {
    "title": "The Lone Star Ranger",
    "author": "Zane Grey",
    "year": 1915,
    "synopsis": "A young man forced into outlaw life in Texas becomes a Ranger to clean up the border.",
    "publicDomain": true
  },
  "the-valley-of-the-moon": {
    "title": "The Valley of the Moon",
    "author": "Jack London",
    "year": 1913,
    "synopsis": "A working couple leave strike-torn Oakland and search California for land of their own.",
    "publicDomain": true
  },
  "piccadilly-jim": {
    "title": "Piccadilly Jim",
    "author": "P. G. Wodehouse",
    "year": 1917,
    "synopsis": "A playboy goes to New York under a false name to win a girl who hates him.",
    "publicDomain": true
  },
  "the-song-of-hiawatha": {
    "title": "The Song of Hiawatha",
    "author": "Henry Wadsworth Longfellow",
    "year": 1855,
    "synopsis": "Longfellow's poem of Hiawatha, drawn from Ojibwe legend: his childhood, his love for Minnehaha and his deeds.",
    "publicDomain": true
  },
  "the-book-of-snobs": {
    "title": "The Book of Snobs",
    "author": "William Makepeace Thackeray",
    "year": 1848,
    "synopsis": "Thackeray's comic sketches of snobbery in every walk of English life.",
    "publicDomain": true
  },
  "ayesha": {
    "title": "Ayesha",
    "author": "H. Rider Haggard",
    "year": 1905,
    "synopsis": "Leo Vincey and Holly search Tibet for She-Who-Must-Be-Obeyed, reborn.",
    "publicDomain": true
  },
  "the-worlds-desire": {
    "title": "The World's Desire",
    "author": "H. Rider Haggard and Andrew Lang",
    "year": 1890,
    "synopsis": "Odysseus sets out on one last voyage, to Egypt, in search of Helen of Troy.",
    "publicDomain": true
  },
  "tom-swift-in-the-caves-of-ice": {
    "title": "Tom Swift in the Caves of Ice",
    "author": "Victor Appleton",
    "year": 1911,
    "synopsis": "Tom flies to Alaska to find a lost valley of gold.",
    "publicDomain": true
  },
  "under-drakes-flag": {
    "title": "Under Drake's Flag",
    "author": "G. A. Henty",
    "year": 1883,
    "synopsis": "A Devon boy sails with Francis Drake against the Spanish.",
    "publicDomain": true
  },
  "in-freedoms-cause": {
    "title": "In Freedom's Cause",
    "author": "G. A. Henty",
    "year": 1885,
    "synopsis": "A young Scot fights alongside William Wallace and Robert the Bruce.",
    "publicDomain": true
  },
  "the-pirate": {
    "title": "The Pirate",
    "author": "Walter Scott",
    "year": 1822,
    "synopsis": "A shipwrecked stranger arrives in Shetland and disturbs a quiet island family.",
    "publicDomain": true
  },
  "the-fortunes-of-nigel": {
    "title": "The Fortunes of Nigel",
    "author": "Walter Scott",
    "year": 1822,
    "synopsis": "A young Scottish lord comes to the London court of James I to save his estate.",
    "publicDomain": true
  },
  "the-people-of-the-mist": {
    "title": "The People of the Mist",
    "author": "H. Rider Haggard",
    "year": 1894,
    "synopsis": "A ruined Englishman seeks his fortune in Africa and finds a lost people who worship a crocodile god.",
    "publicDomain": true
  },
  "robin": {
    "title": "Robin",
    "author": "Frances Hodgson Burnett",
    "year": 1922,
    "synopsis": "A young woman raised under the eye of a powerful lord falls in love with a soldier going to war.",
    "publicDomain": true
  },
  "the-little-nugget": {
    "title": "The Little Nugget",
    "author": "P. G. Wodehouse",
    "year": 1913,
    "synopsis": "Several kidnappers converge on an English prep school for a rich American boy.",
    "publicDomain": true
  },
  "the-rose-and-the-ring": {
    "title": "The Rose and the Ring",
    "author": "William Makepeace Thackeray",
    "year": 1855,
    "synopsis": "A comic fairy tale of royal children, a magic rose and a magic ring.",
    "publicDomain": true
  },
  "with-lee-in-virginia": {
    "title": "With Lee in Virginia",
    "author": "G. A. Henty",
    "year": 1890,
    "synopsis": "A Virginia boy fights for the Confederacy in the American Civil War.",
    "publicDomain": true
  },
  "tanar-of-pellucidar": {
    "title": "Tanar of Pellucidar",
    "author": "Edgar Rice Burroughs",
    "year": 1929,
    "synopsis": "A young warrior of the inner world is captured by raiders and fights his way home.",
    "publicDomain": true
  },
  "813": {
    "title": "813",
    "author": "Maurice Leblanc",
    "year": 1910,
    "synopsis": "Arsène Lupin is accused of murder and must uncover the secret of the number 813.",
    "publicDomain": true
  },
  "the-land-of-mist": {
    "title": "The Land of Mist",
    "author": "Arthur Conan Doyle",
    "year": 1926,
    "synopsis": "Professor Challenger's daughter and a journalist explore the world of spiritualism.",
    "publicDomain": true
  },
  "the-stark-munro-letters": {
    "title": "The Stark Munro Letters",
    "author": "Arthur Conan Doyle",
    "year": 1895,
    "synopsis": "A young doctor writes to a friend about starting a practice and his doubts about faith.",
    "publicDomain": true
  },
  "the-cruise-of-the-snark": {
    "title": "The Cruise of the Snark",
    "author": "Jack London",
    "year": 1911,
    "synopsis": "Jack London's account of sailing the Pacific in his own small boat.",
    "publicDomain": true
  },
  "allans-wife": {
    "title": "Allan's Wife",
    "author": "H. Rider Haggard",
    "year": 1889,
    "synopsis": "Allan Quatermain tells of his youth and the woman he married.",
    "publicDomain": true
  },
  "the-moon-maid": {
    "title": "The Moon Maid",
    "author": "Edgar Rice Burroughs",
    "year": 1926,
    "synopsis": "The first spaceship to the Moon finds a world inside it and a princess.",
    "publicDomain": true
  },
  "wessex-tales": {
    "title": "Wessex Tales",
    "author": "Thomas Hardy",
    "year": 1888,
    "synopsis": "Stories of country people in Hardy's Wessex, from a hangman's visit to a withered arm.",
    "publicDomain": true
  },
  "wildfire": {
    "title": "Wildfire",
    "author": "Zane Grey",
    "year": 1917,
    "synopsis": "A horse wrangler captures a wild red stallion and races him for the love of a rancher's daughter.",
    "publicDomain": true
  },
  "the-heritage-of-the-desert": {
    "title": "The Heritage of the Desert",
    "author": "Zane Grey",
    "year": 1910,
    "synopsis": "A sick young man is nursed back to health by a Mormon rancher in the Arizona desert.",
    "publicDomain": true
  },
  "at-the-foot-of-the-rainbow": {
    "title": "At the Foot of the Rainbow",
    "author": "Gene Stratton-Porter",
    "year": 1907,
    "synopsis": "Two friends who fish the Indiana creeks face a betrayal.",
    "publicDomain": true
  },
  "american-notes": {
    "title": "American Notes",
    "author": "Charles Dickens",
    "year": 1842,
    "synopsis": "Dickens's account of his first visit to America, from Boston and New York to slavery in the South.",
    "publicDomain": true
  },
  "hide-and-seek": {
    "title": "Hide and Seek",
    "author": "Wilkie Collins",
    "year": 1854,
    "synopsis": "A painter adopts a deaf girl, and a stranger's search for his sister uncovers her past.",
    "publicDomain": true
  },
  "beyond-good-and-evil": {
    "title": "Beyond Good and Evil",
    "author": "Friedrich Nietzsche",
    "year": 1886,
    "synopsis": "Nietzsche challenges the philosophers before him and asks where our ideas of good and evil come from.",
    "publicDomain": true
  },
  "the-red-thumb-mark": {
    "title": "The Red Thumb Mark",
    "author": "R. Austin Freeman",
    "year": 1907,
    "synopsis": "Diamonds are stolen and a thumbprint points to a young man, but Dr Thorndyke is not convinced.",
    "publicDomain": true
  },
  "the-hill-of-dreams": {
    "title": "The Hill of Dreams",
    "author": "Arthur Machen",
    "year": 1907,
    "synopsis": "A dreamy young man in Wales and London drifts further into visions and decay.",
    "publicDomain": true
  },
  "desert-gold": {
    "title": "Desert Gold",
    "author": "Zane Grey",
    "year": 1913,
    "synopsis": "Rangers and a young prospector fight bandits on the Mexican border.",
    "publicDomain": true
  },
  "the-scalp-hunters": {
    "title": "The Scalp Hunters",
    "author": "Mayne Reid",
    "year": 1851,
    "synopsis": "A young American trader joins a band of scalp hunters in the borderlands of Mexico.",
    "publicDomain": true
  },
  "rudin": {
    "title": "Rudin",
    "author": "Ivan Turgenev",
    "year": 1856,
    "synopsis": "A brilliant talker arrives at a country estate, dazzles everyone, but cannot act.",
    "publicDomain": true
  },
  "the-fair-maid-of-perth": {
    "title": "The Fair Maid of Perth",
    "author": "Walter Scott",
    "year": 1828,
    "synopsis": "A blacksmith fights for the most beautiful girl in Perth in fourteenth-century Scotland.",
    "publicDomain": true
  },
  "mary-marie": {
    "title": "Mary Marie",
    "author": "Eleanor H. Porter",
    "year": 1920,
    "synopsis": "A girl of divorced parents keeps a diary of her six months with each.",
    "publicDomain": true
  },
  "desperate-remedies": {
    "title": "Desperate Remedies",
    "author": "Thomas Hardy",
    "year": 1871,
    "synopsis": "A young woman takes a post as companion to a lady and is drawn into secrets and a crime.",
    "publicDomain": true
  },
  "out-of-times-abyss": {
    "title": "Out of Time's Abyss",
    "author": "Edgar Rice Burroughs",
    "year": 1918,
    "synopsis": "The last of the castaways on Caspak meets a winged race.",
    "publicDomain": true
  },
  "new-grub-street": {
    "title": "New Grub Street",
    "author": "George Gissing",
    "year": 1891,
    "synopsis": "Writers in London struggle to survive between art and the market.",
    "publicDomain": true
  },
  "basil": {
    "title": "Basil",
    "author": "Wilkie Collins",
    "year": 1852,
    "synopsis": "A young gentleman secretly marries a linen-draper's daughter, and his life falls apart.",
    "publicDomain": true
  },
  "east-lynne": {
    "title": "East Lynne",
    "author": "Ellen Wood",
    "year": 1861,
    "synopsis": "A lady leaves her husband and children, and later returns in disguise as their governess.",
    "publicDomain": true
  },
  "the-duel": {
    "title": "The Duel",
    "author": "Anton Chekhov",
    "year": 1891,
    "synopsis": "In a Caucasus seaside town, a lazy official and a stern zoologist come to a duel.",
    "publicDomain": true
  },
  "lifes-little-ironies": {
    "title": "Life's Little Ironies",
    "author": "Thomas Hardy",
    "year": 1894,
    "synopsis": "Hardy's stories of the twists of fate in ordinary lives in Wessex.",
    "publicDomain": true
  },
  "the-possessed": {
    "title": "The Possessed",
    "author": "Fyodor Dostoyevsky",
    "year": 1872,
    "synopsis": "A group of revolutionaries spreads chaos through a provincial Russian town.",
    "publicDomain": true
  },
  "bel-ami": {
    "title": "Bel Ami",
    "author": "Guy de Maupassant",
    "year": 1885,
    "synopsis": "A handsome, ruthless young man rises in Paris journalism by seducing the women around him.",
    "publicDomain": true
  },
  "the-rainbow-trail": {
    "title": "The Rainbow Trail",
    "author": "Zane Grey",
    "year": 1915,
    "synopsis": "A young minister rides into Utah's canyon country to find a woman lost years ago.",
    "publicDomain": true
  },
  "the-harvester": {
    "title": "The Harvester",
    "author": "Gene Stratton-Porter",
    "year": 1911,
    "synopsis": "A man who gathers medicinal plants in the Indiana woods dreams of a girl and searches for her.",
    "publicDomain": true
  },
  "the-communist-manifesto": {
    "title": "The Communist Manifesto",
    "author": "Karl Marx and Friedrich Engels",
    "year": 1848,
    "synopsis": "The short political pamphlet that set out the history of class struggle and called for revolution.",
    "publicDomain": true
  },
  "the-virginian": {
    "title": "The Virginian",
    "author": "Owen Wister",
    "year": 1902,
    "synopsis": "A quiet cowboy in Wyoming falls in love with a schoolteacher from Vermont.",
    "publicDomain": true
  },
  "the-adventures-of-odysseus-and-the-tale": {
    "title": "The Adventures of Odysseus and the Tale of Troy",
    "author": "Padraic Colum",
    "year": 1918,
    "synopsis": "The story of Troy and Odysseus's long voyage home, told for children.",
    "publicDomain": true
  },
  "the-little-lame-prince": {
    "title": "The Little Lame Prince",
    "author": "Dinah Maria Mulock Craik",
    "year": 1875,
    "synopsis": "A prince who cannot walk is given a magic cloak that lets him fly and see the world.",
    "publicDomain": true
  },
  "the-varieties-of-religious-experience": {
    "title": "The Varieties of Religious Experience",
    "author": "William James",
    "year": 1902,
    "synopsis": "William James's lectures on religious feeling, conversion and mystical experience.",
    "publicDomain": true
  },
  "armadale": {
    "title": "Armadale",
    "author": "Wilkie Collins",
    "year": 1866,
    "synopsis": "Two young men share the name Allan Armadale and a family curse, and a beautiful schemer targets them.",
    "publicDomain": true
  },
  "a-vindication-of-the-rights-of-woman": {
    "title": "A Vindication of the Rights of Woman",
    "author": "Mary Wollstonecraft",
    "year": 1792,
    "synopsis": "Wollstonecraft argues that women deserve the same education and rights as men.",
    "publicDomain": true
  },
  "hardings-luck": {
    "title": "Harding's Luck",
    "author": "E. Nesbit",
    "year": 1909,
    "synopsis": "A lame orphan boy travels back to the time of James I and finds he has a life there.",
    "publicDomain": true
  },
  "kim": {
    "title": "Kim",
    "author": "Rudyard Kipling",
    "year": 1901,
    "synopsis": "An Irish orphan in Lahore follows a Tibetan lama on his quest and becomes a spy in the Great Game.",
    "publicDomain": true
  },
  "the-woman-in-white": {
    "title": "The Woman in White",
    "author": "Wilkie Collins",
    "year": 1859,
    "synopsis": "A drawing master meets a mysterious woman in white on a moonlit road, and is drawn into a plot to steal an heiress's fortune.",
    "publicDomain": true
  },
  "redgauntlet": {
    "title": "Redgauntlet",
    "author": "Walter Scott",
    "year": 1824,
    "synopsis": "A young Scot is kidnapped into a last Jacobite plot years after the 1745 rising.",
    "publicDomain": true
  },
  "island-nights-entertainments": {
    "title": "Island Nights' Entertainments",
    "author": "Robert Louis Stevenson",
    "year": 1893,
    "synopsis": "Three stories of the South Seas, including the bottle imp that grants any wish.",
    "publicDomain": true
  },
  "the-coming-race": {
    "title": "The Coming Race",
    "author": "Edward Bulwer-Lytton",
    "year": 1871,
    "synopsis": "A mining engineer finds a powerful underground race who control a force called Vril.",
    "publicDomain": true
  },
  "the-light-that-failed": {
    "title": "The Light That Failed",
    "author": "Rudyard Kipling",
    "year": 1891,
    "synopsis": "A war artist loses his sight while trying to win the woman he loves.",
    "publicDomain": true
  },
  "eminent-victorians": {
    "title": "Eminent Victorians",
    "author": "Lytton Strachey",
    "year": 1918,
    "synopsis": "Witty, irreverent portraits of four famous Victorians, including Florence Nightingale.",
    "publicDomain": true
  },
  "chronicles-of-avonlea": {
    "title": "Chronicles of Avonlea",
    "author": "L. M. Montgomery",
    "year": 1912,
    "synopsis": "Stories of the people of Avonlea, with Anne Shirley appearing here and there.",
    "publicDomain": true
  },
  "the-teeth-of-the-tiger": {
    "title": "The Teeth of the Tiger",
    "author": "Maurice Leblanc",
    "year": 1914,
    "synopsis": "A Spanish nobleman, really Arsène Lupin, investigates murders over a vast inheritance.",
    "publicDomain": true
  },
  "new-arabian-nights": {
    "title": "New Arabian Nights",
    "author": "Robert Louis Stevenson",
    "year": 1882,
    "synopsis": "Prince Florizel of Bohemia wanders London in disguise and finds the Suicide Club.",
    "publicDomain": true
  },
  "laddie": {
    "title": "Laddie",
    "author": "Gene Stratton-Porter",
    "year": 1913,
    "synopsis": "The youngest girl of a large Indiana farm family tells of her brother's love for a mysterious English girl.",
    "publicDomain": true
  },
  "the-swiss-family-robinson": {
    "title": "The Swiss Family Robinson",
    "author": "Johann David Wyss",
    "year": 1812,
    "synopsis": "A Swiss family shipwrecked on a tropical island builds a new life with what they can save.",
    "publicDomain": true
  },
  "some-do-not": {
    "title": "Some Do Not",
    "author": "Ford Madox Ford",
    "year": 1924,
    "synopsis": "Christopher Tietjens, an honourable man, endures a cruel wife and falls for a suffragette.",
    "publicDomain": true
  },
  "hypatia": {
    "title": "Hypatia",
    "author": "Charles Kingsley",
    "year": 1853,
    "synopsis": "In fifth-century Alexandria, the philosopher Hypatia faces the rising Christian church.",
    "publicDomain": true
  },
  "the-dawn-of-a-to-morrow": {
    "title": "The Dawn of a To-morrow",
    "author": "Frances Hodgson Burnett",
    "year": 1906,
    "synopsis": "A rich man planning to end his life wanders London's fog and meets a street girl who changes his mind.",
    "publicDomain": true
  },
  "villette": {
    "title": "Villette",
    "author": "Charlotte Brontë",
    "year": 1853,
    "synopsis": "Lucy Snowe teaches at a girls' school in a Belgian city and falls in love.",
    "publicDomain": true
  },
  "the-rainbow": {
    "title": "The Rainbow",
    "author": "D. H. Lawrence",
    "year": 1915,
    "synopsis": "Three generations of the Brangwen family in the English Midlands, ending with Ursula's search for independence.",
    "publicDomain": true
  },
  "after-dark": {
    "title": "After Dark",
    "author": "Wilkie Collins",
    "year": 1856,
    "synopsis": "A painter's wife writes down the stories her husband's sitters tell him.",
    "publicDomain": true
  },
  "dead-souls": {
    "title": "Dead Souls",
    "author": "Nikolai Gogol",
    "year": 1842,
    "synopsis": "A mysterious gentleman travels the Russian provinces buying up dead serfs who are still on the tax rolls.",
    "publicDomain": true
  },
  "aarons-rod": {
    "title": "Aaron's Rod",
    "author": "D. H. Lawrence",
    "year": 1922,
    "synopsis": "A flautist leaves his wife and family and travels to London and Italy.",
    "publicDomain": true
  },
  "travels-with-a-donkey-in-the-cevennes": {
    "title": "Travels with a Donkey in the Cévennes",
    "author": "Robert Louis Stevenson",
    "year": 1879,
    "synopsis": "Stevenson walks across the mountains of southern France with a stubborn donkey called Modestine.",
    "publicDomain": true
  },
  "further-chronicles-of-avonlea": {
    "title": "Further Chronicles of Avonlea",
    "author": "L. M. Montgomery",
    "year": 1920,
    "synopsis": "More stories of the people of Avonlea.",
    "publicDomain": true
  },
  "the-night-land": {
    "title": "The Night Land",
    "author": "William Hope Hodgson",
    "year": 1912,
    "synopsis": "Millions of years from now, after the sun has died, a man leaves the last fortress to find the woman he loves.",
    "publicDomain": true
  },
  "roderick-hudson": {
    "title": "Roderick Hudson",
    "author": "Henry James",
    "year": 1875,
    "synopsis": "A patron brings a talented young sculptor to Rome, and his gifts fall apart.",
    "publicDomain": true
  },
  "guy-mannering": {
    "title": "Guy Mannering",
    "author": "Walter Scott",
    "year": 1815,
    "synopsis": "A young heir kidnapped as a child returns to Scotland to reclaim his estate.",
    "publicDomain": true
  },
  "i-will-repay": {
    "title": "I Will Repay",
    "author": "Baroness Orczy",
    "year": 1906,
    "synopsis": "A young woman sworn to avenge her brother falls in love with the man who killed him.",
    "publicDomain": true
  },
  "five-weeks-in-a-balloon": {
    "title": "Five Weeks in a Balloon",
    "author": "Jules Verne",
    "year": 1863,
    "synopsis": "Three Englishmen cross Africa by hydrogen balloon.",
    "publicDomain": true
  },
  "the-garden-party": {
    "title": "The Garden Party",
    "author": "Katherine Mansfield",
    "year": 1922,
    "synopsis": "Mansfield's stories, including a girl's discovery of a death next door on the day of her family's party.",
    "publicDomain": true
  },
  "a-portrait-of-the-artist-as-a-young-man": {
    "title": "A Portrait of the Artist as a Young Man",
    "author": "James Joyce",
    "year": 1916,
    "synopsis": "Stephen Dedalus grows up in Dublin and breaks from family, Church and country to become an artist.",
    "publicDomain": true
  },
  "the-portrait-of-a-lady": {
    "title": "The Portrait of a Lady",
    "author": "Henry James",
    "year": 1881,
    "synopsis": "A spirited young American inherits a fortune in Europe and makes a disastrous marriage.",
    "publicDomain": true
  },
  "sons-and-lovers": {
    "title": "Sons and Lovers",
    "author": "D. H. Lawrence",
    "year": 1913,
    "synopsis": "A miner's son grows up torn between his devoted mother and the women he loves.",
    "publicDomain": true
  },
  "queen-victoria": {
    "title": "Queen Victoria",
    "author": "Lytton Strachey",
    "year": 1921,
    "synopsis": "A witty biography of Queen Victoria from her childhood to her long widowhood.",
    "publicDomain": true
  },
  "the-voyage-of-the-beagle": {
    "title": "The Voyage of the Beagle",
    "author": "Charles Darwin",
    "year": 1839,
    "synopsis": "Darwin's journal of his five-year voyage round the world, including the Galápagos Islands.",
    "publicDomain": true
  },
  "the-prelude": {
    "title": "The Prelude",
    "author": "William Wordsworth",
    "year": 1850,
    "synopsis": "Wordsworth's long autobiographical poem on his childhood, his years in France and the growth of his mind.",
    "publicDomain": true
  },
  "the-beautiful-and-damned": {
    "title": "The Beautiful and Damned",
    "author": "F. Scott Fitzgerald",
    "year": 1922,
    "synopsis": "A handsome heir and his beautiful wife wait in New York's parties for a fortune that keeps slipping away.",
    "publicDomain": true
  },
  "john-silence": {
    "title": "John Silence",
    "author": "Algernon Blackwood",
    "year": 1908,
    "synopsis": "Dr John Silence, a physician of the soul, investigates hauntings, curses and werewolves.",
    "publicDomain": true
  },
  "the-war-in-the-air": {
    "title": "The War in the Air",
    "author": "H. G. Wells",
    "year": 1908,
    "synopsis": "A bicycle mechanic is carried off in a balloon and lands in the middle of the first world war fought by airships.",
    "publicDomain": true
  },
  "the-song-of-the-lark": {
    "title": "The Song of the Lark",
    "author": "Willa Cather",
    "year": 1915,
    "synopsis": "A minister's daughter from a Colorado town grows up to become a great opera singer.",
    "publicDomain": true
  },
  "the-cat-of-bubastes": {
    "title": "The Cat of Bubastes",
    "author": "G. A. Henty",
    "year": 1889,
    "synopsis": "A young prince taken as a slave to Egypt is caught up in the scandal when a sacred cat is killed.",
    "publicDomain": true
  },
  "by-pike-and-dyke": {
    "title": "By Pike and Dyke",
    "author": "G. A. Henty",
    "year": 1890,
    "synopsis": "An English boy serves William the Silent in the Dutch revolt against Spain.",
    "publicDomain": true
  },
  "with-clive-in-india": {
    "title": "With Clive in India",
    "author": "G. A. Henty",
    "year": 1884,
    "synopsis": "A young clerk in India fights alongside Robert Clive in the rise of the British East India Company.",
    "publicDomain": true
  },
  "the-master-of-the-world": {
    "title": "The Master of the World",
    "author": "Jules Verne",
    "year": 1904,
    "synopsis": "An inspector investigates a machine that can travel by land, sea and air, and the man who built it.",
    "publicDomain": true
  },
  "the-last-trail": {
    "title": "The Last Trail",
    "author": "Zane Grey",
    "year": 1909,
    "synopsis": "Two frontiersmen hunt a gang of horse thieves and outlaws on the Ohio frontier.",
    "publicDomain": true
  },
  "the-day-of-the-beast": {
    "title": "The Day of the Beast",
    "author": "Zane Grey",
    "year": 1922,
    "synopsis": "A wounded soldier comes home from the First World War to a town changed by the Jazz Age.",
    "publicDomain": true
  },
  "the-mysterious-rider": {
    "title": "The Mysterious Rider",
    "author": "Zane Grey",
    "year": 1921,
    "synopsis": "A stranger rides onto a Colorado ranch and helps a young woman who is being forced into marriage.",
    "publicDomain": true
  },
  "buster-bears-twins": {
    "title": "Buster Bear's Twins",
    "author": "Thornton W. Burgess",
    "year": 1923,
    "synopsis": "Mother Bear's two cubs get into trouble in the Great Woods.",
    "publicDomain": true
  },
  "the-vanished-messenger": {
    "title": "The Vanished Messenger",
    "author": "E. Phillips Oppenheim",
    "year": 1914,
    "synopsis": "A young man carrying a secret message across England just before the war vanishes.",
    "publicDomain": true
  },
  "the-double-traitor": {
    "title": "The Double Traitor",
    "author": "E. Phillips Oppenheim",
    "year": 1915,
    "synopsis": "A British diplomat in Berlin uncovers German plans as war approaches.",
    "publicDomain": true
  },
  "the-great-impersonation": {
    "title": "The Great Impersonation",
    "author": "E. Phillips Oppenheim",
    "year": 1920,
    "synopsis": "An English baronet returns from Africa, but is he really who he says he is?",
    "publicDomain": true
  },
  "the-flaming-forest": {
    "title": "The Flaming Forest",
    "author": "James Oliver Curwood",
    "year": 1921,
    "synopsis": "A Mountie in the Canadian north falls for a mysterious woman tied to a wilderness conspiracy.",
    "publicDomain": true
  },
  "the-golden-snare": {
    "title": "The Golden Snare",
    "author": "James Oliver Curwood",
    "year": 1921,
    "synopsis": "A Mountie pursues a wanted man through the Barren Lands and finds a captive girl.",
    "publicDomain": true
  },
  "nomads-of-the-north": {
    "title": "Nomads of the North",
    "author": "James Oliver Curwood",
    "year": 1919,
    "synopsis": "A bear cub and a puppy, lost together in the Canadian wilderness, become friends.",
    "publicDomain": true
  },
  "the-danger-trail": {
    "title": "The Danger Trail",
    "author": "James Oliver Curwood",
    "year": 1910,
    "synopsis": "A railway engineer in the far north is caught in a plot and falls for a mysterious woman.",
    "publicDomain": true
  },
  "isobel": {
    "title": "Isobel",
    "author": "James Oliver Curwood",
    "year": 1913,
    "synopsis": "On the shores of Hudson Bay, a Mountie hunts a man who has the love of a remarkable woman.",
    "publicDomain": true
  },
  "the-white-feather": {
    "title": "The White Feather",
    "author": "P. G. Wodehouse",
    "year": 1907,
    "synopsis": "A schoolboy who ran from a fight at Wrykyn sets out to win back his good name.",
    "publicDomain": true
  },
  "the-adventures-of-sally": {
    "title": "The Adventures of Sally",
    "author": "P. G. Wodehouse",
    "year": 1922,
    "synopsis": "A young New Yorker comes into money and finds that her family and fiancé need managing.",
    "publicDomain": true
  },
  "the-swoop": {
    "title": "The Swoop",
    "author": "P. G. Wodehouse",
    "year": 1909,
    "synopsis": "Britain is invaded by nine armies at once, and only a Boy Scout can save it.",
    "publicDomain": true
  },
  "the-gem-collector": {
    "title": "The Gem Collector",
    "author": "P. G. Wodehouse",
    "year": 1909,
    "synopsis": "A reformed jewel thief meets a millionaire who collects gems in a comic country-house caper.",
    "publicDomain": true
  },
  "the-innocents": {
    "title": "The Innocents",
    "author": "Sinclair Lewis",
    "year": 1917,
    "synopsis": "An elderly couple give up their shop and set off to tramp across America together.",
    "publicDomain": true
  },
  "madame-de-treymes": {
    "title": "Madame de Treymes",
    "author": "Edith Wharton",
    "year": 1907,
    "synopsis": "An American in Paris wants to marry a woman bound by her French husband's family.",
    "publicDomain": true
  },
  "jurgen": {
    "title": "Jurgen",
    "author": "James Branch Cabell",
    "year": 1919,
    "synopsis": "A middle-aged pawnbroker is given back his youth and travels through mythical lands.",
    "publicDomain": true
  },
  "the-magnificent-ambersons": {
    "title": "The Magnificent Ambersons",
    "author": "Booth Tarkington",
    "year": 1918,
    "synopsis": "The proud Amberson family declines as their Midwestern town grows into a city of automobiles.",
    "publicDomain": true
  },
  "alice-adams": {
    "title": "Alice Adams",
    "author": "Booth Tarkington",
    "year": 1921,
    "synopsis": "A young woman from a struggling family tries to win a rich suitor by pretending to be more than she is.",
    "publicDomain": true
  },
  "penrod-and-sam": {
    "title": "Penrod and Sam",
    "author": "Booth Tarkington",
    "year": 1916,
    "synopsis": "Penrod and his friend Sam have more comic adventures in their Indiana town.",
    "publicDomain": true
  },
  "seventeen": {
    "title": "Seventeen",
    "author": "Booth Tarkington",
    "year": 1916,
    "synopsis": "William Baxter, seventeen and in love for the first time, suffers through one long summer.",
    "publicDomain": true
  },
  "monsieur-beaucaire": {
    "title": "Monsieur Beaucaire",
    "author": "Booth Tarkington",
    "year": 1900,
    "synopsis": "In eighteenth-century Bath, a French barber is not what he seems.",
    "publicDomain": true
  },
  "gentle-julia": {
    "title": "Gentle Julia",
    "author": "Booth Tarkington",
    "year": 1922,
    "synopsis": "A beautiful young woman's suitors and her young niece cause chaos in an Indiana town.",
    "publicDomain": true
  },
  "the-conquest-of-canaan": {
    "title": "The Conquest of Canaan",
    "author": "Booth Tarkington",
    "year": 1905,
    "synopsis": "An outcast returns to his Indiana town to fight its prejudices.",
    "publicDomain": true
  },
  "nature": {
    "title": "Nature",
    "author": "Ralph Waldo Emerson",
    "year": 1836,
    "synopsis": "Emerson's essay on finding truth and spirit through the natural world.",
    "publicDomain": true
  },
  "the-oregon-trail": {
    "title": "The Oregon Trail",
    "author": "Francis Parkman",
    "year": 1849,
    "synopsis": "A young Bostonian travels the Oregon Trail and lives among the Plains peoples in 1846.",
    "publicDomain": true
  },
  "the-metropolis": {
    "title": "The Metropolis",
    "author": "Upton Sinclair",
    "year": 1908,
    "synopsis": "A young lawyer is drawn into the dazzling, wasteful world of New York's richest families.",
    "publicDomain": true
  },
  "the-mutiny-of-the-elsinore": {
    "title": "The Mutiny of the Elsinore",
    "author": "Jack London",
    "year": 1914,
    "synopsis": "A writer sails round Cape Horn on a ship whose crew turns to mutiny.",
    "publicDomain": true
  },
  "tales-of-the-fish-patrol": {
    "title": "Tales of the Fish Patrol",
    "author": "Jack London",
    "year": 1905,
    "synopsis": "A boy patrols San Francisco Bay with the fish patrol, chasing poachers.",
    "publicDomain": true
  },
  "the-gold-hunters": {
    "title": "The Gold Hunters",
    "author": "James Oliver Curwood",
    "year": 1909,
    "synopsis": "Two boys search for a lost gold mine in the Canadian wilderness.",
    "publicDomain": true
  },
  "the-honor-of-the-big-snows": {
    "title": "The Honor of the Big Snows",
    "author": "James Oliver Curwood",
    "year": 1911,
    "synopsis": "A hunter in the far north loves a woman whose past is a mystery.",
    "publicDomain": true
  },
  "the-riddle-of-the-frozen-flame": {
    "title": "The Riddle of the Frozen Flame",
    "author": "Mary E. and Thomas W. Hanshew",
    "year": 1920,
    "synopsis": "Cleek of Scotland Yard investigates a strange cold light that appears before every death.",
    "publicDomain": true
  },
  "the-man-who-knew": {
    "title": "The Man Who Knew",
    "author": "Edgar Wallace",
    "year": 1918,
    "synopsis": "A murdered financier leaves a puzzle for a young man with a mysterious gift.",
    "publicDomain": true
  },
  "the-clue-of-the-twisted-candle": {
    "title": "The Clue of the Twisted Candle",
    "author": "Edgar Wallace",
    "year": 1916,
    "synopsis": "A man is murdered in a locked room, and a twisted candle is the only clue.",
    "publicDomain": true
  },
  "the-great-shadow": {
    "title": "The Great Shadow",
    "author": "Arthur Conan Doyle",
    "year": 1892,
    "synopsis": "A young Scot is caught up in the Napoleonic wars, ending at Waterloo.",
    "publicDomain": true
  },
  "jack-o-judgment": {
    "title": "Jack O' Judgment",
    "author": "Edgar Wallace",
    "year": 1920,
    "synopsis": "A masked avenger strikes at a criminal gang in London.",
    "publicDomain": true
  },
  "the-doings-of-raffles-haw": {
    "title": "The Doings of Raffles Haw",
    "author": "Arthur Conan Doyle",
    "year": 1891,
    "synopsis": "A recluse who can make gold tries to do good with it, with unexpected results.",
    "publicDomain": true
  },
  "the-eight-strokes-of-the-clock": {
    "title": "The Eight Strokes of the Clock",
    "author": "Maurice Leblanc",
    "year": 1922,
    "synopsis": "Arsène Lupin, as Prince Rénine, solves eight mysteries to win a lady's affection.",
    "publicDomain": true
  },
  "the-woman-of-mystery": {
    "title": "The Woman of Mystery",
    "author": "Maurice Leblanc",
    "year": 1916,
    "synopsis": "A young soldier investigates a murder and a woman who seems to know too much.",
    "publicDomain": true
  },
  "the-middle-temple-murder": {
    "title": "The Middle Temple Murder",
    "author": "J. S. Fletcher",
    "year": 1919,
    "synopsis": "A journalist investigates the murder of a stranger found near London's law courts.",
    "publicDomain": true
  },
  "scarhaven-keep": {
    "title": "Scarhaven Keep",
    "author": "J. S. Fletcher",
    "year": 1920,
    "synopsis": "An actor vanishes in a Yorkshire fishing village, and a playwright searches for him.",
    "publicDomain": true
  },
  "the-charing-cross-mystery": {
    "title": "The Charing Cross Mystery",
    "author": "J. S. Fletcher",
    "year": 1923,
    "synopsis": "A young barrister sees a man die on a train and is drawn into a trail of crime.",
    "publicDomain": true
  },
  "the-talleyrand-maxim": {
    "title": "The Talleyrand Maxim",
    "author": "J. S. Fletcher",
    "year": 1920,
    "synopsis": "A clerk finds a will that could change his fortunes, and the temptation to use it.",
    "publicDomain": true
  },
  "the-chestermarke-instinct": {
    "title": "The Chestermarke Instinct",
    "author": "J. S. Fletcher",
    "year": 1918,
    "synopsis": "A bank manager vanishes, and his young clerk suspects the bank's owners.",
    "publicDomain": true
  },
  "the-further-adventures-of-jimmie-dale": {
    "title": "The Further Adventures of Jimmie Dale",
    "author": "Frank L. Packard",
    "year": 1919,
    "synopsis": "The gentleman safecracker known as the Gray Seal hunts the gang that is hunting him.",
    "publicDomain": true
  },
  "tremendous-trifles": {
    "title": "Tremendous Trifles",
    "author": "G. K. Chesterton",
    "year": 1909,
    "synopsis": "Chesterton's short essays finding wonder in ordinary things.",
    "publicDomain": true
  },
  "the-trees-of-pride": {
    "title": "The Trees of Pride",
    "author": "G. K. Chesterton",
    "year": 1922,
    "synopsis": "A squire mocks a legend about deadly trees on his estate, and then disappears.",
    "publicDomain": true
  },
  "eugenics-and-other-evils": {
    "title": "Eugenics and Other Evils",
    "author": "G. K. Chesterton",
    "year": 1922,
    "synopsis": "Chesterton's argument against the eugenics movement and its threat to freedom.",
    "publicDomain": true
  },
  "a-short-history-of-england": {
    "title": "A Short History of England",
    "author": "G. K. Chesterton",
    "year": 1917,
    "synopsis": "Chesterton's lively, opinionated retelling of England's history.",
    "publicDomain": true
  },
  "for-the-temple": {
    "title": "For the Temple",
    "author": "G. A. Henty",
    "year": 1888,
    "synopsis": "A young Jew fights in the revolt against Rome and the siege of Jerusalem.",
    "publicDomain": true
  },
  "bonnie-prince-charlie": {
    "title": "Bonnie Prince Charlie",
    "author": "G. A. Henty",
    "year": 1888,
    "synopsis": "A young Scot fights at Fontenoy and in the Jacobite rising of 1745.",
    "publicDomain": true
  },
  "the-vicomte-de-bragelonne": {
    "title": "The Vicomte de Bragelonne",
    "author": "Alexandre Dumas",
    "year": 1847,
    "synopsis": "Athos's son and the ageing musketeers serve and defy Louis XIV.",
    "publicDomain": true
  },
  "the-corsican-brothers": {
    "title": "The Corsican Brothers",
    "author": "Alexandre Dumas",
    "year": 1844,
    "synopsis": "Twin brothers separated at birth feel each other's pain across the miles.",
    "publicDomain": true
  },
  "the-adventures-of-poor-mrs-quack": {
    "title": "The Adventures of Poor Mrs. Quack",
    "author": "Thornton W. Burgess",
    "year": 1917,
    "synopsis": "Mrs. Quack the duck tries to keep her family safe from hunters.",
    "publicDomain": true
  },
  "mother-west-wind-why-stories": {
    "title": "Mother West Wind \"Why\" Stories",
    "author": "Thornton W. Burgess",
    "year": 1915,
    "synopsis": "Grandfather Frog tells why the animals of the Green Meadows are as they are.",
    "publicDomain": true
  },
  "mother-west-wind-how-stories": {
    "title": "Mother West Wind \"How\" Stories",
    "author": "Thornton W. Burgess",
    "year": 1916,
    "synopsis": "Stories of how the animals got their ways and looks.",
    "publicDomain": true
  },
  "the-hunted-woman": {
    "title": "The Hunted Woman",
    "author": "James Oliver Curwood",
    "year": 1916,
    "synopsis": "A writer in the Canadian Rockies protects a woman fleeing from dangerous men.",
    "publicDomain": true
  },
  "the-pothunters": {
    "title": "The Pothunters",
    "author": "P. G. Wodehouse",
    "year": 1902,
    "synopsis": "Sports trophies are stolen from a boys' school, and the boys investigate.",
    "publicDomain": true
  },
  "the-turmoil": {
    "title": "The Turmoil",
    "author": "Booth Tarkington",
    "year": 1915,
    "synopsis": "A dreamy son of a money-mad industrialist falls in love with the girl next door.",
    "publicDomain": true
  },
  "a-childs-history-of-england": {
    "title": "A Child's History of England",
    "author": "Charles Dickens",
    "year": 1853,
    "synopsis": "Dickens tells England's history for children, from the Romans to the Stuarts.",
    "publicDomain": true
  },
  "the-history-of-the-peloponnesian-war": {
    "title": "The History of the Peloponnesian War",
    "author": "Thucydides",
    "year": 1874,
    "synopsis": "The great war between Athens and Sparta, told by an Athenian general who lived through it.",
    "publicDomain": true
  },
  "the-courage-of-marge-odoone": {
    "title": "The Courage of Marge O'Doone",
    "author": "James Oliver Curwood",
    "year": 1918,
    "synopsis": "A man searching for his lost wife and daughter in the north finds a brave young woman.",
    "publicDomain": true
  },
  "the-wolf-hunters": {
    "title": "The Wolf Hunters",
    "author": "James Oliver Curwood",
    "year": 1908,
    "synopsis": "Two boys and a guide spend a winter hunting wolves in the Canadian wilderness.",
    "publicDomain": true
  },
  "the-alaskan": {
    "title": "The Alaskan",
    "author": "James Oliver Curwood",
    "year": 1923,
    "synopsis": "A young woman sailing to Alaska is drawn into a fight for the territory's future.",
    "publicDomain": true
  },
  "through-the-magic-door": {
    "title": "Through the Magic Door",
    "author": "Arthur Conan Doyle",
    "year": 1907,
    "synopsis": "Doyle walks through his library, talking about the books he loves.",
    "publicDomain": true
  },
  "the-paradise-mystery": {
    "title": "The Paradise Mystery",
    "author": "J. S. Fletcher",
    "year": 1920,
    "synopsis": "A stranger falls to his death in a cathedral close, and a young doctor investigates.",
    "publicDomain": true
  },
  "dead-mens-money": {
    "title": "Dead Men's Money",
    "author": "J. S. Fletcher",
    "year": 1920,
    "synopsis": "A young clerk on the Scottish border is drawn into a murder and a hidden fortune.",
    "publicDomain": true
  },
  "peter-and-wendy": {
    "title": "Peter and Wendy",
    "author": "J. M. Barrie",
    "year": 1911,
    "synopsis": "Peter Pan takes Wendy and her brothers to Neverland, the novel of Barrie's play.",
    "publicDomain": true
  },
  "tommy-and-grizel": {
    "title": "Tommy and Grizel",
    "author": "J. M. Barrie",
    "year": 1900,
    "synopsis": "Sentimental Tommy grows up to be a famous writer, and Grizel loves him in spite of himself.",
    "publicDomain": true
  },
  "my-lady-nicotine": {
    "title": "My Lady Nicotine",
    "author": "J. M. Barrie",
    "year": 1890,
    "synopsis": "A comic memoir of a bachelor and his friends and their pipes.",
    "publicDomain": true
  },
  "sentimental-tommy": {
    "title": "Sentimental Tommy",
    "author": "J. M. Barrie",
    "year": 1896,
    "synopsis": "A London boy with a huge imagination is sent to live in a Scottish village.",
    "publicDomain": true
  },
  "the-little-white-bird": {
    "title": "The Little White Bird",
    "author": "J. M. Barrie",
    "year": 1902,
    "synopsis": "A bachelor befriends a little boy in Kensington Gardens, where Peter Pan first appears.",
    "publicDomain": true
  },
  "the-story-of-the-greeks": {
    "title": "The Story of the Greeks",
    "author": "H. A. Guerber",
    "year": 1896,
    "synopsis": "The history of ancient Greece told for young readers.",
    "publicDomain": true
  },
  "the-queens-necklace": {
    "title": "The Queen's Necklace",
    "author": "Alexandre Dumas",
    "year": 1849,
    "synopsis": "A swindle over a diamond necklace stains Queen Marie Antoinette's name before the Revolution.",
    "publicDomain": true
  },
  "the-nest-of-the-sparrowhawk": {
    "title": "The Nest of the Sparrowhawk",
    "author": "Baroness Orczy",
    "year": 1909,
    "synopsis": "A young heiress in Puritan England is deceived by her scheming guardian.",
    "publicDomain": true
  },
  "whats-wrong-with-the-world": {
    "title": "What's Wrong with the World",
    "author": "G. K. Chesterton",
    "year": 1910,
    "synopsis": "Chesterton's essays on the family, education and what modern society has lost.",
    "publicDomain": true
  },
  "the-spirit-of-the-border": {
    "title": "The Spirit of the Border",
    "author": "Zane Grey",
    "year": 1906,
    "synopsis": "On the Ohio frontier, two brothers join the borderman Lewis Wetzel.",
    "publicDomain": true
  },
  "the-man-with-the-black-feather": {
    "title": "The Man With the Black Feather",
    "author": "Gaston Leroux",
    "year": 1912,
    "synopsis": "A bookseller is convinced he is the reincarnation of an ancient warrior.",
    "publicDomain": true
  },
  "the-daffodil-mystery": {
    "title": "The Daffodil Mystery",
    "author": "Edgar Wallace",
    "year": 1920,
    "synopsis": "A businessman is found dead surrounded by daffodils, and a detective investigates.",
    "publicDomain": true
  },
  "wulf-the-saxon": {
    "title": "Wulf the Saxon",
    "author": "G. A. Henty",
    "year": 1895,
    "synopsis": "A young Saxon serves Harold Godwinson up to the Battle of Hastings.",
    "publicDomain": true
  },
  "a-knight-of-the-white-cross": {
    "title": "A Knight of the White Cross",
    "author": "G. A. Henty",
    "year": 1896,
    "synopsis": "A young English knight joins the Knights of St John in the siege of Rhodes.",
    "publicDomain": true
  },
  "the-valley-of-silent-men": {
    "title": "The Valley of Silent Men",
    "author": "James Oliver Curwood",
    "year": 1920,
    "synopsis": "A Mountie who confesses to a murder he didn't commit is rescued by a mysterious woman.",
    "publicDomain": true
  },
  "green-mansions": {
    "title": "Green Mansions",
    "author": "W. H. Hudson",
    "year": 1904,
    "synopsis": "A fugitive in the Venezuelan jungle falls in love with Rima, a girl of the forest.",
    "publicDomain": true
  },
  "the-lions-skin": {
    "title": "The Lion's Skin",
    "author": "Rafael Sabatini",
    "year": 1911,
    "synopsis": "A young man sets out to avenge his mother on the father who abandoned her.",
    "publicDomain": true
  },
  "the-young-carthaginian": {
    "title": "The Young Carthaginian",
    "author": "G. A. Henty",
    "year": 1887,
    "synopsis": "A young Carthaginian marches with Hannibal across the Alps.",
    "publicDomain": true
  },
  "windy-mcphersons-son": {
    "title": "Windy McPherson's Son",
    "author": "Sherwood Anderson",
    "year": 1916,
    "synopsis": "A boy from a small Iowa town becomes a rich man in Chicago and looks for meaning.",
    "publicDomain": true
  },
  "democracy-and-education": {
    "title": "Democracy and Education",
    "author": "John Dewey",
    "year": 1916,
    "synopsis": "Dewey's argument that schools should teach through experience and prepare people for democratic life.",
    "publicDomain": true
  },
  "the-dragon-and-the-raven": {
    "title": "The Dragon and the Raven",
    "author": "G. A. Henty",
    "year": 1886,
    "synopsis": "A young Saxon fights the Danes alongside King Alfred.",
    "publicDomain": true
  },
  "beric-the-briton": {
    "title": "Beric the Briton",
    "author": "G. A. Henty",
    "year": 1893,
    "synopsis": "A young Briton fights Rome in Boudicca's revolt and is taken to Nero's Rome.",
    "publicDomain": true
  },
  "the-young-buglers": {
    "title": "The Young Buglers",
    "author": "G. A. Henty",
    "year": 1880,
    "synopsis": "Two brothers serve as buglers in Wellington's army in the Peninsular War.",
    "publicDomain": true
  },
  "the-cruise-of-the-dazzler": {
    "title": "The Cruise of the Dazzler",
    "author": "Jack London",
    "year": 1902,
    "synopsis": "A rich boy runs away to sea on a sloop crewed by oyster pirates.",
    "publicDomain": true
  },
  "heretics": {
    "title": "Heretics",
    "author": "G. K. Chesterton",
    "year": 1905,
    "synopsis": "Chesterton takes on the leading writers of his day, from Shaw to Kipling.",
    "publicDomain": true
  },
  "the-snare": {
    "title": "The Snare",
    "author": "Rafael Sabatini",
    "year": 1917,
    "synopsis": "A British officer in Portugal is falsely accused during the Peninsular War.",
    "publicDomain": true
  },
  "true-to-the-old-flag": {
    "title": "True to the Old Flag",
    "author": "G. A. Henty",
    "year": 1885,
    "synopsis": "A young Loyalist fights for Britain in the American War of Independence.",
    "publicDomain": true
  },
  "the-age-of-chivalry": {
    "title": "The Age of Chivalry",
    "author": "Thomas Bulfinch",
    "year": 1858,
    "synopsis": "The legends of King Arthur, the Mabinogion and other medieval tales.",
    "publicDomain": true
  },
  "twenty-years-at-hull-house": {
    "title": "Twenty Years at Hull-House",
    "author": "Jane Addams",
    "year": 1910,
    "synopsis": "Jane Addams tells how she founded and ran a settlement house for Chicago's immigrant poor.",
    "publicDomain": true
  },
  "the-last-of-the-plainsmen": {
    "title": "The Last of the Plainsmen",
    "author": "Zane Grey",
    "year": 1908,
    "synopsis": "Zane Grey's account of a hunting trip with Buffalo Jones to rope wild animals.",
    "publicDomain": true
  },
  "how-we-think": {
    "title": "How We Think",
    "author": "John Dewey",
    "year": 1910,
    "synopsis": "Dewey on how people reason and how teachers can train good thinking.",
    "publicDomain": true
  },
  "the-science-of-getting-rich": {
    "title": "The Science of Getting Rich",
    "author": "Wallace D. Wattles",
    "year": 1910,
    "synopsis": "A short guide to building wealth by thinking and acting in a certain way.",
    "publicDomain": true
  },
  "in-the-reign-of-terror": {
    "title": "In the Reign of Terror",
    "author": "G. A. Henty",
    "year": 1888,
    "synopsis": "An English boy in revolutionary France saves the daughters of a French family.",
    "publicDomain": true
  },
  "the-purple-land": {
    "title": "The Purple Land",
    "author": "W. H. Hudson",
    "year": 1885,
    "synopsis": "A young Englishman wanders through Uruguay during its civil wars.",
    "publicDomain": true
  },
  "personal-memoirs-of-u-s-grant": {
    "title": "Personal Memoirs of U. S. Grant",
    "author": "Ulysses S. Grant",
    "year": 1885,
    "synopsis": "Grant's own account of his life and the Civil War, written as he was dying.",
    "publicDomain": true
  },
  "travels-in-alaska": {
    "title": "Travels in Alaska",
    "author": "John Muir",
    "year": 1915,
    "synopsis": "Muir's journeys among the glaciers and islands of Alaska.",
    "publicDomain": true
  },
  "the-blonde-lady": {
    "title": "The Blonde Lady",
    "author": "Maurice Leblanc",
    "year": 1910,
    "synopsis": "Arsène Lupin matches wits with the English detective Herlock Sholmes over a stolen diamond.",
    "publicDomain": true
  },
  "john-thorndykes-cases": {
    "title": "John Thorndyke's Cases",
    "author": "R. Austin Freeman",
    "year": 1909,
    "synopsis": "Dr Thorndyke solves crimes with the microscope and the laboratory.",
    "publicDomain": true
  },
  "the-job": {
    "title": "The Job",
    "author": "Sinclair Lewis",
    "year": 1917,
    "synopsis": "A small-town girl makes a career for herself in the offices of New York.",
    "publicDomain": true
  },
  "the-mountains-of-california": {
    "title": "The Mountains of California",
    "author": "John Muir",
    "year": 1894,
    "synopsis": "Muir describes the glaciers, forests, storms and wildlife of the Sierra Nevada.",
    "publicDomain": true
  },
  "the-jacket": {
    "title": "The Jacket",
    "author": "Jack London",
    "year": 1915,
    "synopsis": "A prisoner in solitary confinement escapes his body and relives his past lives.",
    "publicDomain": true
  },
  "representative-men": {
    "title": "Representative Men",
    "author": "Ralph Waldo Emerson",
    "year": 1850,
    "synopsis": "Emerson's lectures on six great men, from Plato to Shakespeare and Napoleon.",
    "publicDomain": true
  },
  "the-girl-on-the-boat": {
    "title": "The Girl on the Boat",
    "author": "P. G. Wodehouse",
    "year": 1922,
    "synopsis": "Three men on a liner from New York fall for the same red-haired girl.",
    "publicDomain": true
  },
  "three-men-and-a-maid": {
    "title": "Three Men and a Maid",
    "author": "P. G. Wodehouse",
    "year": 1922,
    "synopsis": "A comic tangle of love at sea and in an English country house.",
    "publicDomain": true
  },
  "two-years-before-the-mast": {
    "title": "Two Years Before the Mast",
    "author": "Richard Henry Dana Jr.",
    "year": 1840,
    "synopsis": "A Harvard student sails as a common seaman round Cape Horn to California.",
    "publicDomain": true
  },
  "the-mystery-of-31-new-inn": {
    "title": "The Mystery of 31 New Inn",
    "author": "R. Austin Freeman",
    "year": 1912,
    "synopsis": "A doctor is taken blindfold to see a dying patient, and Dr Thorndyke sets out to find the house.",
    "publicDomain": true
  },
  "the-art-of-public-speaking": {
    "title": "The Art of Public Speaking",
    "author": "Dale Carnegie and J. Berg Esenwein",
    "year": 1915,
    "synopsis": "A practical guide to speaking with confidence before an audience.",
    "publicDomain": true
  },
  "the-yosemite": {
    "title": "The Yosemite",
    "author": "John Muir",
    "year": 1912,
    "synopsis": "Muir's guide to the valley, its waterfalls, trees and wildlife.",
    "publicDomain": true
  },
  "the-adventures-of-jimmie-dale": {
    "title": "The Adventures of Jimmie Dale",
    "author": "Frank L. Packard",
    "year": 1917,
    "synopsis": "A rich young New Yorker leads a double life as the safecracker the Gray Seal.",
    "publicDomain": true
  },
  "the-old-man-in-the-corner": {
    "title": "The Old Man in the Corner",
    "author": "Baroness Orczy",
    "year": 1909,
    "synopsis": "An old man in a London teashop solves crimes for a young journalist without leaving his seat.",
    "publicDomain": true
  },
  "the-confessions-of-arsene-lupin": {
    "title": "The Confessions of Arsène Lupin",
    "author": "Maurice Leblanc",
    "year": 1912,
    "synopsis": "Arsène Lupin tells of more of his exploits.",
    "publicDomain": true
  },
  "orthodoxy": {
    "title": "Orthodoxy",
    "author": "G. K. Chesterton",
    "year": 1908,
    "synopsis": "Chesterton explains how he came to Christian belief, with wit and paradox.",
    "publicDomain": true
  },
  "tales-of-st-austins": {
    "title": "Tales of St. Austin's",
    "author": "P. G. Wodehouse",
    "year": 1903,
    "synopsis": "Stories of life at a boys' school.",
    "publicDomain": true
  },
  "to-the-last-man": {
    "title": "To the Last Man",
    "author": "Zane Grey",
    "year": 1921,
    "synopsis": "A young man is drawn into a feud between two families in Arizona's Tonto Basin.",
    "publicDomain": true
  },
  "the-son-of-the-wolf": {
    "title": "The Son of the Wolf",
    "author": "Jack London",
    "year": 1900,
    "synopsis": "London's first book: stories of the Klondike and the men and women who live there.",
    "publicDomain": true
  },
  "cape-cod": {
    "title": "Cape Cod",
    "author": "Henry David Thoreau",
    "year": 1865,
    "synopsis": "Thoreau walks the beaches of Cape Cod, among shipwrecks and fishermen.",
    "publicDomain": true
  },
  "far-away-and-long-ago": {
    "title": "Far Away and Long Ago",
    "author": "W. H. Hudson",
    "year": 1918,
    "synopsis": "Hudson remembers his boyhood on the pampas of Argentina.",
    "publicDomain": true
  },
  "manalive": {
    "title": "Manalive",
    "author": "G. K. Chesterton",
    "year": 1912,
    "synopsis": "A joyful stranger arrives at a London boarding house and is accused of crimes that turn out to be something else.",
    "publicDomain": true
  },
  "paradise-lost": {
    "title": "Paradise Lost",
    "author": "John Milton",
    "year": 1667,
    "synopsis": "Milton's epic of Satan's rebellion and the fall of Adam and Eve.",
    "publicDomain": true
  },
  "the-theory-of-the-leisure-class": {
    "title": "The Theory of the Leisure Class",
    "author": "Thorstein Veblen",
    "year": 1899,
    "synopsis": "Veblen's study of how the rich show their status through conspicuous consumption.",
    "publicDomain": true
  },
  "the-adventures-of-gerard": {
    "title": "The Adventures of Gerard",
    "author": "Arthur Conan Doyle",
    "year": 1903,
    "synopsis": "More of the brave, boastful Brigadier Gerard's tales of Napoleon's wars.",
    "publicDomain": true
  },
  "looking-backward": {
    "title": "Looking Backward",
    "author": "Edward Bellamy",
    "year": 1888,
    "synopsis": "A Bostonian falls asleep in 1887 and wakes in a socialist utopia in the year 2000.",
    "publicDomain": true
  },
  "the-green-flag": {
    "title": "The Green Flag",
    "author": "Arthur Conan Doyle",
    "year": 1900,
    "synopsis": "Doyle's stories of war, sport and adventure.",
    "publicDomain": true
  },
  "the-monk": {
    "title": "The Monk",
    "author": "Matthew Lewis",
    "year": 1796,
    "synopsis": "A revered Spanish monk falls into temptation and crime, in one of the first gothic novels.",
    "publicDomain": true
  },
  "the-maine-woods": {
    "title": "The Maine Woods",
    "author": "Henry David Thoreau",
    "year": 1864,
    "synopsis": "Thoreau's journeys into the Maine wilderness and up Mount Katahdin.",
    "publicDomain": true
  },
  "the-green-fairy-book": {
    "title": "The Green Fairy Book",
    "author": "Andrew Lang",
    "year": 1892,
    "synopsis": "Fairy tales from around the world, including The Three Little Pigs.",
    "publicDomain": true
  },
  "hard-times": {
    "title": "Hard Times",
    "author": "Charles Dickens",
    "year": 1854,
    "synopsis": "In a grim industrial town, Mr Gradgrind raises his children on facts alone.",
    "publicDomain": true
  },
  "andersens-fairy-tales": {
    "title": "Andersen's Fairy Tales",
    "author": "Hans Christian Andersen",
    "year": 1835,
    "synopsis": "The Ugly Duckling, The Snow Queen, The Little Mermaid and more.",
    "publicDomain": true
  },
  "the-divine-comedy": {
    "title": "The Divine Comedy",
    "author": "Dante Alighieri",
    "year": 1320,
    "synopsis": "Dante's journey through Hell and Purgatory to Paradise.",
    "publicDomain": true
  },
  "the-ladies-paradise": {
    "title": "The Ladies' Paradise",
    "author": "Émile Zola",
    "year": 1883,
    "synopsis": "A young woman works in a great Paris department store that is crushing the small shops around it.",
    "publicDomain": true
  },
  "the-crimes-of-england": {
    "title": "The Crimes of England",
    "author": "G. K. Chesterton",
    "year": 1915,
    "synopsis": "Chesterton's wartime essay on England's mistakes in its dealings with Prussia.",
    "publicDomain": true
  },
  "the-haunted-man-and-the-ghosts-bargain": {
    "title": "The Haunted Man and the Ghost's Bargain",
    "author": "Charles Dickens",
    "year": 1848,
    "synopsis": "A chemistry lecturer haunted by sad memories is given the power to forget them.",
    "publicDomain": true
  },
  "the-king-in-yellow": {
    "title": "The King in Yellow",
    "author": "Robert W. Chambers",
    "year": 1895,
    "synopsis": "Stories linked by a play that drives its readers mad.",
    "publicDomain": true
  },
  "the-wheels-of-chance": {
    "title": "The Wheels of Chance",
    "author": "H. G. Wells",
    "year": 1896,
    "synopsis": "A draper's assistant takes a cycling holiday and rescues a young woman.",
    "publicDomain": true
  },
  "the-pit": {
    "title": "The Pit",
    "author": "Frank Norris",
    "year": 1903,
    "synopsis": "A Chicago speculator tries to corner the wheat market, while his wife feels neglected.",
    "publicDomain": true
  },
  "on-liberty": {
    "title": "On Liberty",
    "author": "John Stuart Mill",
    "year": 1859,
    "synopsis": "Mill's argument for freedom of thought and speech and the limits of power over the individual.",
    "publicDomain": true
  },
  "alarms-and-discursions": {
    "title": "Alarms and Discursions",
    "author": "G. K. Chesterton",
    "year": 1910,
    "synopsis": "Chesterton's short essays on everyday things.",
    "publicDomain": true
  },
  "the-octopus": {
    "title": "The Octopus",
    "author": "Frank Norris",
    "year": 1901,
    "synopsis": "Wheat farmers in California's San Joaquin Valley fight the railroad.",
    "publicDomain": true
  },
  "the-heart-of-mid-lothian": {
    "title": "The Heart of Mid-Lothian",
    "author": "Walter Scott",
    "year": 1818,
    "synopsis": "Jeanie Deans walks from Edinburgh to London to beg a pardon for her sister.",
    "publicDomain": true
  },
  "specimen-days": {
    "title": "Specimen Days",
    "author": "Walt Whitman",
    "year": 1882,
    "synopsis": "Whitman's notes on the Civil War hospitals and on nature.",
    "publicDomain": true
  },
  "legends-of-charlemagne": {
    "title": "Legends of Charlemagne",
    "author": "Thomas Bulfinch",
    "year": 1863,
    "synopsis": "The romances of Charlemagne and his paladins, from Roland to Rinaldo.",
    "publicDomain": true
  },
  "man-and-wife": {
    "title": "Man and Wife",
    "author": "Wilkie Collins",
    "year": 1870,
    "synopsis": "A dubious marriage in Scotland traps a governess, and a brutish athlete is at the centre.",
    "publicDomain": true
  },
  "the-antiquary": {
    "title": "The Antiquary",
    "author": "Walter Scott",
    "year": 1816,
    "synopsis": "A young man with a mysterious past visits an old collector of antiquities on the Scottish coast.",
    "publicDomain": true
  },
  "rob-roy": {
    "title": "Rob Roy",
    "author": "Walter Scott",
    "year": 1817,
    "synopsis": "A young Englishman travels to the Highlands and meets the outlaw Rob Roy MacGregor.",
    "publicDomain": true
  },
  "the-blue-fairy-book": {
    "title": "The Blue Fairy Book",
    "author": "Andrew Lang",
    "year": 1889,
    "synopsis": "Classic fairy tales from Cinderella to Aladdin.",
    "publicDomain": true
  },
  "in-chancery": {
    "title": "In Chancery",
    "author": "John Galsworthy",
    "year": 1920,
    "synopsis": "Soames Forsyte divorces Irene and seeks an heir, in the second book of the Forsyte Saga.",
    "publicDomain": true
  },
  "myths-and-legends-of-ancient-greece-and": {
    "title": "Myths and Legends of Ancient Greece and Rome",
    "author": "E. M. Berens",
    "year": 1880,
    "synopsis": "The gods, heroes and legends of Greece and Rome.",
    "publicDomain": true
  },
  "the-analects": {
    "title": "The Analects",
    "author": "Confucius",
    "year": 1861,
    "synopsis": "Sayings of Confucius and his disciples on virtue, learning and government.",
    "publicDomain": true
  },
  "twice-told-tales": {
    "title": "Twice-Told Tales",
    "author": "Nathaniel Hawthorne",
    "year": 1837,
    "synopsis": "Hawthorne's early tales of New England, including Dr Heidegger's Experiment.",
    "publicDomain": true
  },
  "the-hunchback-of-notre-dame": {
    "title": "The Hunchback of Notre Dame",
    "author": "Victor Hugo",
    "year": 1831,
    "synopsis": "In medieval Paris, the hunchbacked bell-ringer Quasimodo loves the dancer Esmeralda.",
    "publicDomain": true
  },
  "ulysses": {
    "title": "Ulysses",
    "author": "James Joyce",
    "year": 1922,
    "synopsis": "One day in Dublin, 16 June 1904, in the lives of Leopold Bloom and Stephen Dedalus.",
    "publicDomain": true
  },
  "the-monastery": {
    "title": "The Monastery",
    "author": "Walter Scott",
    "year": 1820,
    "synopsis": "Two brothers in the Scottish Borders during the Reformation.",
    "publicDomain": true
  },
  "beautiful-joe": {
    "title": "Beautiful Joe",
    "author": "Marshall Saunders",
    "year": 1893,
    "synopsis": "A dog rescued from a cruel owner tells his life story.",
    "publicDomain": true
  },
  "the-blue-castle": {
    "title": "The Blue Castle",
    "author": "L. M. Montgomery",
    "year": 1926,
    "synopsis": "Told she has a year to live, a timid spinster finally does what she wants.",
    "publicDomain": true
  },
  "the-count-of-monte-cristo": {
    "title": "The Count of Monte Cristo",
    "author": "Alexandre Dumas",
    "year": 1844,
    "synopsis": "Wrongly imprisoned, Edmond Dantès escapes and returns rich to take revenge.",
    "publicDomain": true
  },
  "the-abysmal-brute": {
    "title": "The Abysmal Brute",
    "author": "Jack London",
    "year": 1913,
    "synopsis": "A young boxer raised in the wilderness finds the fight game is corrupt.",
    "publicDomain": true
  },
  "the-grand-babylon-hotel": {
    "title": "The Grand Babylon Hotel",
    "author": "Arnold Bennett",
    "year": 1902,
    "synopsis": "An American millionaire buys a London hotel on a whim and uncovers a royal conspiracy.",
    "publicDomain": true
  },
  "the-way-of-all-flesh": {
    "title": "The Way of All Flesh",
    "author": "Samuel Butler",
    "year": 1903,
    "synopsis": "Ernest Pontifex escapes his stifling Victorian family.",
    "publicDomain": true
  },
  "the-angel-of-terror": {
    "title": "The Angel of Terror",
    "author": "Edgar Wallace",
    "year": 1922,
    "synopsis": "A beautiful woman plots to kill her husband for his fortune.",
    "publicDomain": true
  },
  "john-barleycorn": {
    "title": "John Barleycorn",
    "author": "Jack London",
    "year": 1913,
    "synopsis": "London's own story of his life with drink.",
    "publicDomain": true
  },
  "new-chronicles-of-rebecca": {
    "title": "New Chronicles of Rebecca",
    "author": "Kate Douglas Wiggin",
    "year": 1907,
    "synopsis": "More stories of Rebecca of Sunnybrook Farm.",
    "publicDomain": true
  },
  "the-toilers-of-the-sea": {
    "title": "The Toilers of the Sea",
    "author": "Victor Hugo",
    "year": 1866,
    "synopsis": "A Guernsey fisherman struggles to salvage a wrecked steamship's engine.",
    "publicDomain": true
  },
  "tess-of-the-durbervilles": {
    "title": "Tess of the d'Urbervilles",
    "author": "Thomas Hardy",
    "year": 1891,
    "synopsis": "A poor country girl is sent to claim kinship with a rich family, and is ruined.",
    "publicDomain": true
  },
  "coningsby": {
    "title": "Coningsby",
    "author": "Benjamin Disraeli",
    "year": 1844,
    "synopsis": "A young aristocrat finds his way in politics in 1830s England.",
    "publicDomain": true
  },
  "zanoni": {
    "title": "Zanoni",
    "author": "Edward Bulwer-Lytton",
    "year": 1842,
    "synopsis": "An immortal Rosicrucian falls in love with an opera singer during the French Revolution.",
    "publicDomain": true
  },
  "the-history-of-mr-polly": {
    "title": "The History of Mr. Polly",
    "author": "H. G. Wells",
    "year": 1910,
    "synopsis": "A bored shopkeeper burns down his shop and runs away to find a better life.",
    "publicDomain": true
  },
  "old-mother-west-wind": {
    "title": "Old Mother West Wind",
    "author": "Thornton W. Burgess",
    "year": 1910,
    "synopsis": "Stories of the animals of the Green Meadows.",
    "publicDomain": true
  },
  "on-the-eve": {
    "title": "On the Eve",
    "author": "Ivan Turgenev",
    "year": 1860,
    "synopsis": "A young Russian woman falls in love with a Bulgarian patriot.",
    "publicDomain": true
  },
  "the-moon-and-sixpence": {
    "title": "The Moon and Sixpence",
    "author": "W. Somerset Maugham",
    "year": 1919,
    "synopsis": "A London stockbroker abandons his family to paint in Paris and Tahiti.",
    "publicDomain": true
  },
  "mike": {
    "title": "Mike",
    "author": "P. G. Wodehouse",
    "year": 1909,
    "synopsis": "A cricket-mad boy goes to public school.",
    "publicDomain": true
  },
  "beowulf": {
    "title": "Beowulf",
    "author": "Unknown",
    "year": 1000,
    "synopsis": "The hero Beowulf fights the monster Grendel, his mother and a dragon.",
    "publicDomain": true
  },
  "the-adventures-of-bobby-coon": {
    "title": "The Adventures of Bobby Coon",
    "author": "Thornton W. Burgess",
    "year": 1918,
    "synopsis": "Bobby Coon gets into scrapes in the Green Forest.",
    "publicDomain": true
  },
  "the-adventures-of-peter-cottontail": {
    "title": "The Adventures of Peter Cottontail",
    "author": "Thornton W. Burgess",
    "year": 1914,
    "synopsis": "Peter Rabbit wants a fancier name and finds trouble.",
    "publicDomain": true
  },
  "old-granny-fox": {
    "title": "Old Granny Fox",
    "author": "Thornton W. Burgess",
    "year": 1920,
    "synopsis": "Wise old Granny Fox teaches Reddy Fox the tricks of the trade.",
    "publicDomain": true
  },
  "happy-jack": {
    "title": "Happy Jack",
    "author": "Thornton W. Burgess",
    "year": 1918,
    "synopsis": "Happy Jack the grey squirrel has adventures in the Green Forest.",
    "publicDomain": true
  },
  "the-intrusion-of-jimmy": {
    "title": "The Intrusion of Jimmy",
    "author": "P. G. Wodehouse",
    "year": 1910,
    "synopsis": "A wealthy idler bets he can burgle a house and falls for a girl at a country house.",
    "publicDomain": true
  },
  "before-adam": {
    "title": "Before Adam",
    "author": "Jack London",
    "year": 1907,
    "synopsis": "A man dreams the life of his prehistoric ancestor.",
    "publicDomain": true
  },
  "blacky-the-crow": {
    "title": "Blacky the Crow",
    "author": "Thornton W. Burgess",
    "year": 1922,
    "synopsis": "Clever Blacky the crow plays tricks on his neighbours.",
    "publicDomain": true
  },
  "the-prince": {
    "title": "The Prince",
    "author": "Niccolò Machiavelli",
    "year": 1532,
    "synopsis": "Machiavelli's handbook on how rulers win and keep power.",
    "publicDomain": true
  },
  "all-the-sad-young-men": {
    "title": "All the Sad Young Men",
    "author": "F. Scott Fitzgerald",
    "year": 1926,
    "synopsis": "Fitzgerald's stories, including \"Winter Dreams\" and \"The Rich Boy\".",
    "publicDomain": true
  },
  "tales-of-the-jazz-age": {
    "title": "Tales of the Jazz Age",
    "author": "F. Scott Fitzgerald",
    "year": 1922,
    "synopsis": "Stories including \"The Curious Case of Benjamin Button\".",
    "publicDomain": true
  },
  "money-for-nothing": {
    "title": "Money for Nothing",
    "author": "P. G. Wodehouse",
    "year": 1928,
    "synopsis": "Two neighbours feud and a young man falls in love in a village where money is tight.",
    "publicDomain": true
  },
  "the-adventures-of-bob-white": {
    "title": "The Adventures of Bob White",
    "author": "Thornton W. Burgess",
    "year": 1919,
    "synopsis": "Bob White the quail and his family face danger on the Green Meadows.",
    "publicDomain": true
  },
  "notes-from-the-underground": {
    "title": "Notes from Underground",
    "author": "Fyodor Dostoyevsky",
    "year": 1864,
    "synopsis": "A bitter, isolated former official tells his story.",
    "publicDomain": true
  },
  "of-human-bondage": {
    "title": "Of Human Bondage",
    "author": "W. Somerset Maugham",
    "year": 1915,
    "synopsis": "A young man with a club foot searches for his place in the world.",
    "publicDomain": true
  },
  "the-adventures-of-old-man-coyote": {
    "title": "The Adventures of Old Man Coyote",
    "author": "Thornton W. Burgess",
    "year": 1916,
    "synopsis": "Clever Old Man Coyote comes to the Green Meadows.",
    "publicDomain": true
  },
  "the-adventures-of-jimmy-skunk": {
    "title": "The Adventures of Jimmy Skunk",
    "author": "Thornton W. Burgess",
    "year": 1918,
    "synopsis": "Jimmy Skunk is a peaceable fellow, but nobody wants to cross him.",
    "publicDomain": true
  },
  "the-adventures-of-buster-bear": {
    "title": "The Adventures of Buster Bear",
    "author": "Thornton W. Burgess",
    "year": 1916,
    "synopsis": "Buster Bear comes down to the Green Forest, and everyone wonders what he'll do.",
    "publicDomain": true
  },
  "the-new-machiavelli": {
    "title": "The New Machiavelli",
    "author": "H. G. Wells",
    "year": 1911,
    "synopsis": "A rising politician gives up his career for love.",
    "publicDomain": true
  },
  "the-sea-lady": {
    "title": "The Sea Lady",
    "author": "H. G. Wells",
    "year": 1902,
    "synopsis": "A mermaid comes ashore at Folkestone and turns a young politician's head.",
    "publicDomain": true
  },
  "the-adventures-of-johnny-chuck": {
    "title": "The Adventures of Johnny Chuck",
    "author": "Thornton W. Burgess",
    "year": 1913,
    "synopsis": "Johnny Chuck the woodchuck and his adventures on the Green Meadows.",
    "publicDomain": true
  },
  "redburn": {
    "title": "Redburn",
    "author": "Herman Melville",
    "year": 1849,
    "synopsis": "A young sailor makes his first voyage, to Liverpool.",
    "publicDomain": true
  },
  "flappers-and-philosophers": {
    "title": "Flappers and Philosophers",
    "author": "F. Scott Fitzgerald",
    "year": 1920,
    "synopsis": "Fitzgerald's first stories, including \"Bernice Bobs Her Hair\".",
    "publicDomain": true
  },
  "the-food-of-the-gods": {
    "title": "The Food of the Gods",
    "author": "H. G. Wells",
    "year": 1904,
    "synopsis": "Two scientists invent a food that makes living things grow to giant size.",
    "publicDomain": true
  },
  "a-childs-garden-of-verses": {
    "title": "A Child's Garden of Verses",
    "author": "Robert Louis Stevenson",
    "year": 1885,
    "synopsis": "Stevenson's poems of childhood, from \"My Shadow\" to \"The Land of Counterpane\".",
    "publicDomain": true
  },
  "leaves-of-grass": {
    "title": "Leaves of Grass",
    "author": "Walt Whitman",
    "year": 1855,
    "synopsis": "Whitman's great collection, including \"Song of Myself\".",
    "publicDomain": true
  },
  "the-king-of-irelands-son": {
    "title": "The King of Ireland's Son",
    "author": "Padraic Colum",
    "year": 1916,
    "synopsis": "The king's son sets out to win the daughter of an enchanter, in a weave of Irish tales.",
    "publicDomain": true
  },
  "the-imitation-of-christ": {
    "title": "The Imitation of Christ",
    "author": "Thomas à Kempis",
    "year": 1418,
    "synopsis": "A guide to the inner spiritual life.",
    "publicDomain": true
  },
  "sonnets-from-the-portuguese": {
    "title": "Sonnets from the Portuguese",
    "author": "Elizabeth Barrett Browning",
    "year": 1850,
    "synopsis": "Love sonnets written during Barrett Browning's courtship with Robert Browning.",
    "publicDomain": true
  },
  "a-shropshire-lad": {
    "title": "A Shropshire Lad",
    "author": "A. E. Housman",
    "year": 1896,
    "synopsis": "Housman's poems of country life, youth and loss.",
    "publicDomain": true
  },
  "lives-of-the-twelve-caesars": {
    "title": "Lives of the Twelve Caesars",
    "author": "Suetonius",
    "year": 1913,
    "synopsis": "Biographies of Julius Caesar and the first eleven Roman emperors.",
    "publicDomain": true
  },
  "five-little-peppers-grown-up": {
    "title": "Five Little Peppers Grown Up",
    "author": "Margaret Sidney",
    "year": 1892,
    "synopsis": "The Pepper children, now young men and women, find work, love and their places in the world.",
    "publicDomain": true
  },
  "the-five-little-peppers-midway": {
    "title": "The Five Little Peppers Midway",
    "author": "Margaret Sidney",
    "year": 1890,
    "synopsis": "The Peppers settle into life with their kind benefactor and his family.",
    "publicDomain": true
  },
  "the-canterville-ghost": {
    "title": "The Canterville Ghost",
    "author": "Oscar Wilde",
    "year": 1887,
    "synopsis": "An American family buys a haunted English castle, and its ghost cannot frighten them.",
    "publicDomain": true
  },
  "donal-grant": {
    "title": "Donal Grant",
    "author": "George MacDonald",
    "year": 1883,
    "synopsis": "A young Scottish poet becomes tutor at a strange castle with a cruel earl and a hidden secret.",
    "publicDomain": true
  },
  "whats-mines-mine": {
    "title": "What's Mine's Mine",
    "author": "George MacDonald",
    "year": 1886,
    "synopsis": "A Highland chief's sons struggle to keep their land from a rich newcomer.",
    "publicDomain": true
  },
  "heather-and-snow": {
    "title": "Heather and Snow",
    "author": "George MacDonald",
    "year": 1893,
    "synopsis": "Two young people grow up in the Scottish hills, and their love is tested.",
    "publicDomain": true
  },
  "the-bertrams": {
    "title": "The Bertrams",
    "author": "Anthony Trollope",
    "year": 1859,
    "synopsis": "A clever young man and the woman he loves are kept apart by pride and money.",
    "publicDomain": true
  },
  "castle-richmond": {
    "title": "Castle Richmond",
    "author": "Anthony Trollope",
    "year": 1860,
    "synopsis": "Two cousins love the same woman in Ireland during the Great Famine.",
    "publicDomain": true
  },
  "the-kellys-and-the-okellys": {
    "title": "The Kellys and the O'Kellys",
    "author": "Anthony Trollope",
    "year": 1848,
    "synopsis": "Two Irish cousins of different classes court two heiresses.",
    "publicDomain": true
  },
  "nina-balatka": {
    "title": "Nina Balatka",
    "author": "Anthony Trollope",
    "year": 1867,
    "synopsis": "In Prague, a Christian girl loves a Jewish man against the wishes of both families.",
    "publicDomain": true
  },
  "linda-tressel": {
    "title": "Linda Tressel",
    "author": "Anthony Trollope",
    "year": 1868,
    "synopsis": "In Nuremberg, a young woman's strict aunt tries to force her into marriage.",
    "publicDomain": true
  },
  "the-belton-estate": {
    "title": "The Belton Estate",
    "author": "Anthony Trollope",
    "year": 1866,
    "synopsis": "A young woman must choose between her cousin, who will inherit her father's estate, and another suitor.",
    "publicDomain": true
  },
  "sir-harry-hotspur-of-humblethwaite": {
    "title": "Sir Harry Hotspur of Humblethwaite",
    "author": "Anthony Trollope",
    "year": 1870,
    "synopsis": "A baronet's daughter falls in love with her cousin, a charming scoundrel.",
    "publicDomain": true
  },
  "ralph-the-heir": {
    "title": "Ralph the Heir",
    "author": "Anthony Trollope",
    "year": 1871,
    "synopsis": "A spendthrift heir and his rich cousin both want the same estate.",
    "publicDomain": true
  },
  "harry-heathcote-of-gangoil": {
    "title": "Harry Heathcote of Gangoil",
    "author": "Anthony Trollope",
    "year": 1874,
    "synopsis": "A young sheep farmer in Australia defends his land against fire and enemies.",
    "publicDomain": true
  },
  "lady-anna": {
    "title": "Lady Anna",
    "author": "Anthony Trollope",
    "year": 1874,
    "synopsis": "A countess's daughter loves a tailor, to her mother's fury.",
    "publicDomain": true
  },
  "john-caldigate": {
    "title": "John Caldigate",
    "author": "Anthony Trollope",
    "year": 1879,
    "synopsis": "A man returns from the Australian goldfields and is accused of bigamy.",
    "publicDomain": true
  },
  "marion-fay": {
    "title": "Marion Fay",
    "author": "Anthony Trollope",
    "year": 1882,
    "synopsis": "A young lord falls in love with a Quaker clerk's daughter.",
    "publicDomain": true
  },
  "the-landleaguers": {
    "title": "The Landleaguers",
    "author": "Anthony Trollope",
    "year": 1883,
    "synopsis": "An English family in Ireland during the Land League troubles.",
    "publicDomain": true
  },
  "an-old-mans-love": {
    "title": "An Old Man's Love",
    "author": "Anthony Trollope",
    "year": 1884,
    "synopsis": "An older man becomes engaged to his young ward, who still loves someone else.",
    "publicDomain": true
  },
  "the-struggles-of-brown-jones-and": {
    "title": "The Struggles of Brown, Jones, and Robinson",
    "author": "Anthony Trollope",
    "year": 1862,
    "synopsis": "A comic tale of three partners and their failing London shop.",
    "publicDomain": true
  },
  "brother-jacob": {
    "title": "Brother Jacob",
    "author": "George Eliot",
    "year": 1864,
    "synopsis": "A thief who set up as a confectioner is undone by his simple brother.",
    "publicDomain": true
  },
  "impressions-of-theophrastus-such": {
    "title": "Impressions of Theophrastus Such",
    "author": "George Eliot",
    "year": 1879,
    "synopsis": "George Eliot's last book, sketches of characters and opinions.",
    "publicDomain": true
  },
  "the-little-colonels-house-party": {
    "title": "The Little Colonel's House Party",
    "author": "Annie Fellows Johnston",
    "year": 1900,
    "synopsis": "The Little Colonel invites three girls to her Kentucky home for a house party.",
    "publicDomain": true
  },
  "ranald-bannermans-boyhood": {
    "title": "Ranald Bannerman's Boyhood",
    "author": "George MacDonald",
    "year": 1871,
    "synopsis": "A minister's son grows up in a Scottish village.",
    "publicDomain": true
  },
  "sir-gibbie": {
    "title": "Sir Gibbie",
    "author": "George MacDonald",
    "year": 1879,
    "synopsis": "A mute orphan boy from the streets of a Scottish city turns out to be heir to an estate.",
    "publicDomain": true
  },
  "the-seaboard-parish": {
    "title": "The Seaboard Parish",
    "author": "George MacDonald",
    "year": 1868,
    "synopsis": "A vicar and his family spend a year in a Cornish seaside parish.",
    "publicDomain": true
  },
  "the-elect-lady": {
    "title": "The Elect Lady",
    "author": "George MacDonald",
    "year": 1888,
    "synopsis": "A laird's daughter in the Scottish hills and the young farmer who loves her.",
    "publicDomain": true
  },
  "the-flight-of-the-shadow": {
    "title": "The Flight of the Shadow",
    "author": "George MacDonald",
    "year": 1891,
    "synopsis": "A young woman uncovers a dark secret in her family's past.",
    "publicDomain": true
  },
  "the-golden-lion-of-granpere": {
    "title": "The Golden Lion of Granpere",
    "author": "Anthony Trollope",
    "year": 1872,
    "synopsis": "In an Alsatian inn, the innkeeper's son and his father's ward fall in love.",
    "publicDomain": true
  },
  "is-he-popenjoy": {
    "title": "Is He Popenjoy?",
    "author": "Anthony Trollope",
    "year": 1878,
    "synopsis": "A family fears that the heir to a marquisate may not be legitimate.",
    "publicDomain": true
  },
  "the-fixed-period": {
    "title": "The Fixed Period",
    "author": "Anthony Trollope",
    "year": 1882,
    "synopsis": "In a future island republic, everyone must retire to die at sixty-eight.",
    "publicDomain": true
  },
  "kept-in-the-dark": {
    "title": "Kept in the Dark",
    "author": "Anthony Trollope",
    "year": 1882,
    "synopsis": "A wife doesn't tell her husband she was once engaged to another man.",
    "publicDomain": true
  },
  "the-moorland-cottage": {
    "title": "The Moorland Cottage",
    "author": "Elizabeth Gaskell",
    "year": 1850,
    "synopsis": "A gentle girl in a moorland cottage loves a squire's son and protects her brother.",
    "publicDomain": true
  },
  "a-dark-nights-work": {
    "title": "A Dark Night's Work",
    "author": "Elizabeth Gaskell",
    "year": 1863,
    "synopsis": "A lawyer's daughter carries the secret of a crime her father committed one night.",
    "publicDomain": true
  },
  "henrietta-temple": {
    "title": "Henrietta Temple",
    "author": "Benjamin Disraeli",
    "year": 1837,
    "synopsis": "A young man engaged to his cousin falls in love with another woman.",
    "publicDomain": true
  },
  "robert-falconer": {
    "title": "Robert Falconer",
    "author": "George MacDonald",
    "year": 1868,
    "synopsis": "A Scottish boy searches for his lost father and his faith.",
    "publicDomain": true
  },
  "the-vicar-of-bullhampton": {
    "title": "The Vicar of Bullhampton",
    "author": "Anthony Trollope",
    "year": 1870,
    "synopsis": "A country vicar stands by a fallen woman and a young man accused of murder.",
    "publicDomain": true
  },
  "tom-brown-at-oxford": {
    "title": "Tom Brown at Oxford",
    "author": "Thomas Hughes",
    "year": 1861,
    "synopsis": "Tom Brown goes up to Oxford and learns about friendship, rowing and life.",
    "publicDomain": true
  },
  "mr-scarboroughs-family": {
    "title": "Mr. Scarborough's Family",
    "author": "Anthony Trollope",
    "year": 1883,
    "synopsis": "A dying squire plays tricks with his will to decide which son will inherit.",
    "publicDomain": true
  },
  "the-hoosier-schoolmaster": {
    "title": "The Hoosier Schoolmaster",
    "author": "Edward Eggleston",
    "year": 1871,
    "synopsis": "A young teacher takes on a rough backwoods school in Indiana.",
    "publicDomain": true
  },
  "once-on-a-time": {
    "title": "Once on a Time",
    "author": "A. A. Milne",
    "year": 1917,
    "synopsis": "A comic fairy tale of two kings at war and a princess with sense.",
    "publicDomain": true
  },
  "an-autobiography": {
    "title": "An Autobiography",
    "author": "Anthony Trollope",
    "year": 1883,
    "synopsis": "Trollope tells of his unhappy youth, his career at the Post Office and how he wrote his novels.",
    "publicDomain": true
  },
  "the-claverings": {
    "title": "The Claverings",
    "author": "Anthony Trollope",
    "year": 1867,
    "synopsis": "A young man engaged to a gentle girl is tempted by a rich widow he once loved.",
    "publicDomain": true
  },
  "annals-of-a-quiet-neighbourhood": {
    "title": "Annals of a Quiet Neighbourhood",
    "author": "George MacDonald",
    "year": 1867,
    "synopsis": "A young vicar tells of his first years in a country parish.",
    "publicDomain": true
  },
  "the-king-of-the-golden-river": {
    "title": "The King of the Golden River",
    "author": "John Ruskin",
    "year": 1841,
    "synopsis": "A kind boy and his cruel brothers meet the spirit of a golden river.",
    "publicDomain": true
  },
  "paul-clifford": {
    "title": "Paul Clifford",
    "author": "Edward Bulwer-Lytton",
    "year": 1830,
    "synopsis": "An orphan raised in a London slum becomes a highwayman, in the novel that begins \"It was a dark and stormy night\".",
    "publicDomain": true
  },
  "the-macdermots-of-ballycloran": {
    "title": "The Macdermots of Ballycloran",
    "author": "Anthony Trollope",
    "year": 1847,
    "synopsis": "An Irish landowning family falls into ruin, in Trollope's first novel.",
    "publicDomain": true
  },
  "the-caxtons": {
    "title": "The Caxtons",
    "author": "Edward Bulwer-Lytton",
    "year": 1849,
    "synopsis": "A scholarly father and his family, told by his son, with comic and touching episodes.",
    "publicDomain": true
  },
  "mopsa-the-fairy": {
    "title": "Mopsa the Fairy",
    "author": "Jean Ingelow",
    "year": 1869,
    "synopsis": "A boy finds fairies in a hawthorn tree and travels with them to Fairyland.",
    "publicDomain": true
  },
  "the-young-trailers": {
    "title": "The Young Trailers",
    "author": "Joseph A. Altsheler",
    "year": 1907,
    "synopsis": "Two boys join a party of settlers on the trail to early Kentucky.",
    "publicDomain": true
  },
  "the-moving-picture-girls": {
    "title": "The Moving Picture Girls",
    "author": "Laura Lee Hope",
    "year": 1914,
    "synopsis": "Two sisters start acting in early moving pictures to help their father.",
    "publicDomain": true
  },
  "aunt-janes-nieces-in-society": {
    "title": "Aunt Jane's Nieces in Society",
    "author": "L. Frank Baum",
    "year": 1910,
    "synopsis": "The three nieces enter New York society.",
    "publicDomain": true
  },
  "the-phantom-ship": {
    "title": "The Phantom Ship",
    "author": "Frederick Marryat",
    "year": 1839,
    "synopsis": "A young man sets out to free his father from the curse of the Flying Dutchman.",
    "publicDomain": true
  },
  "fame-and-fortune": {
    "title": "Fame and Fortune",
    "author": "Horatio Alger",
    "year": 1868,
    "synopsis": "Dick Hunter, once a bootblack, works his way up in New York.",
    "publicDomain": true
  },
  "the-outdoor-girls-of-deepdale": {
    "title": "The Outdoor Girls of Deepdale",
    "author": "Laura Lee Hope",
    "year": 1913,
    "synopsis": "Four girls set off on a walking tour and get mixed up in a mystery.",
    "publicDomain": true
  },
  "aunt-janes-nieces-abroad": {
    "title": "Aunt Jane's Nieces Abroad",
    "author": "L. Frank Baum",
    "year": 1906,
    "synopsis": "The three nieces and their uncle travel through Italy and are caught up with bandits.",
    "publicDomain": true
  },
  "aunt-janes-nieces-at-millville": {
    "title": "Aunt Jane's Nieces at Millville",
    "author": "L. Frank Baum",
    "year": 1908,
    "synopsis": "The nieces spend a summer at their uncle's farm in Millville.",
    "publicDomain": true
  },
  "aunt-janes-nieces-at-work": {
    "title": "Aunt Jane's Nieces at Work",
    "author": "L. Frank Baum",
    "year": 1909,
    "synopsis": "The nieces throw themselves into a political campaign.",
    "publicDomain": true
  },
  "snarleyyow": {
    "title": "Snarleyyow",
    "author": "Frederick Marryat",
    "year": 1837,
    "synopsis": "A cruel captain and his ugly dog terrorise the crew of a ship.",
    "publicDomain": true
  },
  "the-tree-of-appomattox": {
    "title": "The Tree of Appomattox",
    "author": "Joseph A. Altsheler",
    "year": 1916,
    "synopsis": "A young Union officer sees the last days of the Civil War.",
    "publicDomain": true
  },
  "peter-simple": {
    "title": "Peter Simple",
    "author": "Frederick Marryat",
    "year": 1834,
    "synopsis": "A naive young midshipman learns his trade in the Royal Navy.",
    "publicDomain": true
  },
  "ran-away-to-sea": {
    "title": "Ran Away to Sea",
    "author": "Mayne Reid",
    "year": 1858,
    "synopsis": "A boy runs away to sea and has adventures on the African coast.",
    "publicDomain": true
  },
  "the-rulers-of-the-lakes": {
    "title": "The Rulers of the Lakes",
    "author": "Joseph A. Altsheler",
    "year": 1917,
    "synopsis": "Robert Lennox joins the fight for Lake George in the French and Indian War.",
    "publicDomain": true
  },
  "the-shades-of-the-wilderness": {
    "title": "The Shades of the Wilderness",
    "author": "Joseph A. Altsheler",
    "year": 1916,
    "synopsis": "A young Confederate officer fights through the Battle of the Wilderness.",
    "publicDomain": true
  },
  "the-hunters-of-the-hills": {
    "title": "The Hunters of the Hills",
    "author": "Joseph A. Altsheler",
    "year": 1916,
    "synopsis": "A young man and his friends are drawn into the French and Indian War.",
    "publicDomain": true
  },
  "the-shadow-of-the-north": {
    "title": "The Shadow of the North",
    "author": "Joseph A. Altsheler",
    "year": 1917,
    "synopsis": "Robert Lennox scouts for the British in the northern wilderness.",
    "publicDomain": true
  },
  "the-guns-of-bull-run": {
    "title": "The Guns of Bull Run",
    "author": "Joseph A. Altsheler",
    "year": 1914,
    "synopsis": "A young Kentuckian joins the Union army at the start of the Civil War.",
    "publicDomain": true
  },
  "the-rock-of-chickamauga": {
    "title": "The Rock of Chickamauga",
    "author": "Joseph A. Altsheler",
    "year": 1915,
    "synopsis": "Dick Mason fights with the Union army at Chickamauga.",
    "publicDomain": true
  },
  "the-sword-of-antietam": {
    "title": "The Sword of Antietam",
    "author": "Joseph A. Altsheler",
    "year": 1914,
    "synopsis": "Dick Mason fights in the bloody Battle of Antietam.",
    "publicDomain": true
  },
  "the-scouts-of-stonewall": {
    "title": "The Scouts of Stonewall",
    "author": "Joseph A. Altsheler",
    "year": 1914,
    "synopsis": "A young Confederate rides with Stonewall Jackson in the Shenandoah Valley.",
    "publicDomain": true
  },
  "the-guns-of-shiloh": {
    "title": "The Guns of Shiloh",
    "author": "Joseph A. Altsheler",
    "year": 1914,
    "synopsis": "Dick Mason is caught up in the Battle of Shiloh.",
    "publicDomain": true
  },
  "osceola-the-seminole": {
    "title": "Osceola the Seminole",
    "author": "Mayne Reid",
    "year": 1858,
    "synopsis": "A young man in Florida befriends the Seminole leader Osceola in the war with the United States.",
    "publicDomain": true
  },
  "the-headless-horseman": {
    "title": "The Headless Horseman",
    "author": "Mayne Reid",
    "year": 1865,
    "synopsis": "In Texas, a headless rider haunts the prairie, and a murder must be solved.",
    "publicDomain": true
  },
  "the-star-of-gettysburg": {
    "title": "The Star of Gettysburg",
    "author": "Joseph A. Altsheler",
    "year": 1915,
    "synopsis": "A young Confederate fights at the Battle of Gettysburg.",
    "publicDomain": true
  },
  "mark-the-match-boy": {
    "title": "Mark the Match Boy",
    "author": "Horatio Alger",
    "year": 1869,
    "synopsis": "A homeless boy selling matches in New York is helped by a friend and finds his long-lost grandfather.",
    "publicDomain": true
  },
  "the-adventures-of-pinocchio": {
    "title": "The Adventures of Pinocchio",
    "author": "Carlo Collodi",
    "year": 1883,
    "synopsis": "A wooden puppet who longs to be a real boy runs from one scrape to the next, and his nose grows with every lie.",
    "publicDomain": true
  },
  "a-house-of-pomegranates": {
    "title": "A House of Pomegranates",
    "author": "Oscar Wilde",
    "year": 1891,
    "synopsis": "Four fairy tales by Oscar Wilde, among them The Young King and The Star-Child, about beauty, pride and kindness.",
    "publicDomain": true
  },
  "south-sea-tales": {
    "title": "South Sea Tales",
    "author": "Jack London",
    "year": 1911,
    "synopsis": "Traders, castaways and islanders face storms, sharks and one another across the Pacific.",
    "publicDomain": true
  },
  "children-of-the-frost": {
    "title": "Children of the Frost",
    "author": "Jack London",
    "year": 1902,
    "synopsis": "Stories of the far North told from the side of the Native peoples whose world the newcomers are changing.",
    "publicDomain": true
  },
  "love-of-life-and-other-stories": {
    "title": "Love of Life and Other Stories",
    "author": "Jack London",
    "year": 1907,
    "synopsis": "A starving prospector crawls across the barren lands in the title story, one of eight tales of grit and survival.",
    "publicDomain": true
  },
  "the-flying-inn": {
    "title": "The Flying Inn",
    "author": "G. K. Chesterton",
    "year": 1914,
    "synopsis": "When England bans the pub, an Irish captain and an innkeeper roll a barrel of rum and a sign across the country.",
    "publicDomain": true
  },
  "tales-of-terror-and-mystery": {
    "title": "Tales of Terror and Mystery",
    "author": "Arthur Conan Doyle",
    "year": 1922,
    "synopsis": "Strange deaths, sky monsters and locked-room puzzles in a dozen tales by the creator of Sherlock Holmes.",
    "publicDomain": true
  },
  "the-singing-bone": {
    "title": "The Singing Bone",
    "author": "R. Austin Freeman",
    "year": 1912,
    "synopsis": "Dr Thorndyke solves five crimes, each first told from the criminal's side, then unpicked by science.",
    "publicDomain": true
  },
  "king-coal": {
    "title": "King Coal",
    "author": "Upton Sinclair",
    "year": 1917,
    "synopsis": "A rich young man takes a job as a miner under a false name and sees how the coal camps are run.",
    "publicDomain": true
  },
  "ragged-dick": {
    "title": "Ragged Dick",
    "author": "Horatio Alger Jr.",
    "year": 1868,
    "synopsis": "A cheerful New York bootblack works, saves and learns his way toward a better life.",
    "publicDomain": true
  }
};
