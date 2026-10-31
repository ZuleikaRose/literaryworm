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
  }
};
