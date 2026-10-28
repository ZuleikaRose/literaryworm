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
  }
};
