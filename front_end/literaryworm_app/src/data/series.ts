/**
 * Series on LiteraryWorm: catalog titles that belong together, in reading order (the order the
 * books were first published, unless the series is usually read otherwise). Only the books
 * LiteraryWorm holds are listed, so a series can skip a book the catalog doesn't have. Books with
 * `series` set in books.ts are series too (lib/series.ts merges them). A book belongs to one series.
 */
export interface SeriesEntry {
  name: string;
  /** Catalog ids, in reading order. */
  ids: string[];
}

export const SERIES: SeriesEntry[] = [
  {
    name: "Anne of Green Gables",
    ids: ["anne-of-green-gables", "anne-of-avonlea", "anne-of-the-island", "annes-house-of-dreams", "rainbow-valley", "rilla-of-ingleside"],
  },
  { name: "Chronicles of Avonlea", ids: ["chronicles-of-avonlea", "further-chronicles-of-avonlea"] },
  { name: "The Story Girl", ids: ["the-story-girl", "the-golden-road"] },
  {
    name: "Oz",
    ids: [
      "the-wonderful-wizard-of-oz",
      "dorothy-and-the-wizard-in-oz",
      "the-patchwork-girl-of-oz",
      "the-scarecrow-of-oz",
      "rinkitink-in-oz",
      "the-lost-princess-of-oz",
      "the-tin-woodman-of-oz",
      "glinda-of-oz",
    ],
  },
  {
    name: "Aunt Jane's Nieces",
    ids: ["aunt-janes-nieces-abroad", "aunt-janes-nieces-at-millville", "aunt-janes-nieces-at-work", "aunt-janes-nieces-in-society"],
  },
  {
    name: "Sherlock Holmes",
    ids: ["a-study-in-scarlet", "the-sign-of-the-four", "sherlock-holmes", "the-memoirs-of-sherlock-holmes", "the-hound-of-the-baskervilles", "the-valley-of-fear"],
  },
  { name: "Professor Challenger", ids: ["the-poison-belt", "the-land-of-mist"] },
  {
    name: "Tarzan",
    ids: [
      "tarzan-of-the-apes",
      "the-return-of-tarzan",
      "the-beasts-of-tarzan",
      "the-son-of-tarzan",
      "tarzan-and-the-jewels-of-opar",
      "jungle-tales-of-tarzan",
      "tarzan-the-untamed",
      "tarzan-the-terrible",
      "tarzan-and-the-ant-men",
    ],
  },
  { name: "Barsoom", ids: ["a-princess-of-mars", "the-gods-of-mars", "the-chessmen-of-mars"] },
  { name: "Pellucidar", ids: ["at-the-earths-core", "pellucidar", "tanar-of-pellucidar"] },
  { name: "Caspak", ids: ["the-land-that-time-forgot", "the-people-that-time-forgot", "out-of-times-abyss"] },
  {
    name: "The d'Artagnan Romances",
    ids: ["the-three-musketeers", "twenty-years-after", "the-vicomte-de-bragelonne", "ten-years-later", "louise-de-la-valliere", "the-man-in-the-iron-mask"],
  },
  { name: "The Leatherstocking Tales", ids: ["the-pioneers", "the-last-of-the-mohicans", "the-prairie", "the-pathfinder", "the-deerslayer"] },
  { name: "Little Women", ids: ["little-women", "little-men", "jos-boys"] },
  { name: "Eight Cousins", ids: ["eight-cousins", "rose-in-bloom"] },
  { name: "Tom Sawyer and Huck Finn", ids: ["the-adventures-of-tom-sawyer", "adventures-of-huckleberry-finn", "tom-sawyer-abroad"] },
  { name: "Alice", ids: ["alice-in-wonderland", "through-the-looking-glass"] },
  { name: "The Psammead", ids: ["five-children-and-it", "the-phoenix-and-the-carpet", "the-story-of-the-amulet"] },
  { name: "The Bastable Children", ids: ["the-story-of-the-treasure-seekers", "the-wouldbegoods"] },
  { name: "Princess Irene and Curdie", ids: ["the-princess-and-the-goblin", "the-princess-and-curdie"] },
  { name: "Katy Carr", ids: ["what-katy-did", "what-katy-did-at-school", "what-katy-did-next", "clover", "in-the-high-valley"] },
  { name: "Pollyanna", ids: ["pollyanna", "pollyanna-grows-up"] },
  { name: "Rebecca", ids: ["rebecca-of-sunnybrook-farm", "new-chronicles-of-rebecca"] },
  { name: "The Bobbsey Twins", ids: ["the-bobbsey-twins-in-the-country", "the-bobbsey-twins-at-the-seashore", "the-bobbsey-twins-at-school"] },
  { name: "The Scarlet Pimpernel", ids: ["the-scarlet-pimpernel", "i-will-repay", "the-elusive-pimpernel", "the-league-of-the-scarlet-pimpernel"] },
  { name: "Allan Quatermain", ids: ["king-solomons-mines", "allan-quatermain", "allans-wife"] },
  { name: "Ruritania", ids: ["the-prisoner-of-zenda", "rupert-of-hentzau"] },
  { name: "Limberlost", ids: ["freckles", "a-girl-of-the-limberlost"] },
  { name: "Tom Brown", ids: ["tom-browns-school-days", "tom-brown-at-oxford"] },
  { name: "Sentimental Tommy", ids: ["sentimental-tommy", "tommy-and-grizel"] },
  { name: "Psmith", ids: ["mike", "leave-it-to-psmith"] },
  { name: "The Ohio River Trilogy", ids: ["the-spirit-of-the-border", "the-last-trail"] },
  { name: "Riders of the Purple Sage", ids: ["riders-of-the-purple-sage", "the-rainbow-trail"] },
  { name: "Annals of a Quiet Neighbourhood", ids: ["annals-of-a-quiet-neighbourhood", "the-seaboard-parish"] },
  {
    name: "The Chronicles of Barsetshire",
    ids: ["the-warden", "barchester-towers", "doctor-thorne", "framley-parsonage", "the-small-house-at-allington", "the-last-chronicle-of-barset"],
  },
  {
    name: "The Palliser Novels",
    ids: ["can-you-forgive-her", "phineas-finn", "the-eustace-diamonds", "phineas-redux", "the-prime-minister", "the-dukes-children"],
  },
];
