import type { UploadedBook } from "../types";

/**
 * The demo's sample uploads (Avery's My Library → Uploads), so visitors can try searching
 * uploads by title, author or keywords, every Sort by (two books in a series, a stand-alone,
 * published years, one being read) and starting a club around an upload, without an EPUB of
 * their own. The text is original, written for LiteraryWorm's demo, except the opening of
 * Frankenstein (public domain, from Project Gutenberg), there to show an upload with a LibriVox
 * recording; like the rest of the demo it lives only in this tab. Kept clear of the words the
 * upload smoke tests search for.
 */

interface DemoUpload {
  id: string;
  title: string;
  author: string;
  publishedYear: number;
  /** Days before today it was "uploaded". */
  daysAgo: number;
  chapters: { title: string; text: string }[];
}

const DEMO_UPLOADS: DemoUpload[] = [
  {
    id: "u-d3e0a1000000000000000000000000a1",
    title: "The Tide Clock (The Lantern Coast, #1)",
    author: "Wren Okafor",
    publishedYear: 2019,
    daysAgo: 12,
    chapters: [
      {
        title: "The Lamp Room",
        text: [
          "Every evening at six, Juno Marsh climbed the hundred and twelve steps of the harbour tower and wound the tide clock by hand. Her grandmother had done it before her, and her grandmother's father before that, and none of them had ever missed a night.",
          "The clock did not tell the hour. It told the water: when it would rise, when it would fall, and when the fishing boats could cross the bar without scraping their keels on the sand.",
          "\"A town that forgets the tide,\" her grandmother liked to say, \"soon forgets everything else.\" Juno had always thought it was the sort of thing old people said. Tonight, with the brass hands sticking and the lantern guttering, she was less sure.",
        ].join("\n\n"),
      },
      {
        title: "A Letter Without a Stamp",
        text: [
          "The letter was waiting under the door when she came down. No stamp, no postmark, only her name in careful copperplate and a smear of green wax where a seal had once been.",
          "Inside was a single line: The clock is running fast. Ask the archivist why.",
          "Juno read it three times. There was no archivist in Saltmarsh, and there had not been one since the reading room flooded, years before she was born.",
          // A short exchange with named speakers, so Who reads whom has someone to list in the demo.
          "“Where did you find that?” asked Ezra, the harbourmaster's boy, leaning in the doorway.",
          "“Under my door,” said Juno. “Have you ever heard of an archivist?”",
          "“Only in my grandfather's stories,” said Ezra. “He said she kept the tide tables, before the flood.”",
        ].join("\n\n"),
      },
      {
        title: "The Reading Room",
        text: [
          "The old reading room sat at the end of Gull Lane, its windows boarded and its door swollen shut. Juno put her shoulder to it until the hinges gave with a groan.",
          "Inside, the shelves had survived better than anyone had promised. Ledgers lay in rows, their spines furred with salt, and on the librarian's desk stood a second clock, smaller than the one in the tower, its hands frozen at a quarter past four.",
          "Somebody had dusted it recently.",
        ].join("\n\n"),
      },
    ],
  },
  {
    id: "u-d3e0a1000000000000000000000000a2",
    title: "The Salt Archive (The Lantern Coast, #2)",
    author: "Wren Okafor",
    publishedYear: 2021,
    daysAgo: 6,
    chapters: [
      {
        title: "Ledgers",
        text: [
          "By spring Juno had read forty of the ledgers, and the pattern had begun to show itself in the margins: dates, tide heights, and beside some of them a small drawn lantern.",
          "Each lantern marked a night the harbour lights had failed. Each failure came a week after the tide clock gained a minute.",
          "She copied the dates onto a sheet of brown paper and pinned it above her bed, where she could see it last thing at night and first thing in the morning.",
        ].join("\n\n"),
      },
      {
        title: "The Keeper of Keys",
        text: [
          "Mr Abernathy kept the keys to every locked door in Saltmarsh on a ring the size of a dinner plate. He did not like questions, and he liked questions about the archive least of all.",
          "\"Some rooms are shut for a reason,\" he said, and went back to oiling a padlock that did not need oiling.",
          "But that night Juno found a key on her windowsill, small and silver, tied with green thread.",
        ].join("\n\n"),
      },
    ],
  },
  {
    id: "u-d3e0a1000000000000000000000000a3",
    title: "Notes from a Small Orchard",
    author: "Hollis Grant",
    publishedYear: 2008,
    daysAgo: 20,
    chapters: [
      {
        title: "Winter Pruning",
        text: [
          "The orchard came with the house, though nobody mentioned it until the papers were signed. Twelve apple trees, two pears and a quince, all of them overgrown and all of them, the neighbour assured me, past saving.",
          "I spent the first winter learning to prune. You cut to open the tree to light, to let the air move through it, to give each branch room to carry its fruit. It is slow work and it cannot be hurried.",
        ].join("\n\n"),
      },
      {
        title: "Blossom",
        text: [
          "In April the trees forgave me. The blossom came all at once, white on the pears and pink on the apples, and for a week the whole slope hummed with bees.",
          "I sat under the oldest tree with a flask of tea and did nothing at all, which the orchard seemed to think was the right answer.",
        ].join("\n\n"),
      },
      {
        title: "Harvest",
        text: [
          "By October there were more apples than one person could eat, bake or give away. I stored them in the cellar on slatted shelves, each wrapped in newspaper, and the house smelled of them until spring.",
          "The neighbour came to look, and stayed for a slice of pie, and admitted that perhaps the trees had not been past saving after all.",
        ].join("\n\n"),
      },
    ],
  },
  {
    // A public-domain classic as Project Gutenberg's EPUB names it (the opening letters only), so
    // the demo shows an upload the catalog has a LibriVox recording of (lib/uploadRecording.ts).
    id: "u-d3e0a1000000000000000000000000a4",
    title: "Frankenstein; Or, The Modern Prometheus",
    author: "Mary Wollstonecraft Shelley",
    publishedYear: 1818,
    daysAgo: 30,
    chapters: [
      {
        title: "Letter 1",
        text: [
          "To Mrs. SAVILLE, England.",
          "St. Petersburgh, Dec. 11th, 17—.",
          "You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday; and my first task is to assure my dear sister of my welfare, and increasing confidence in the success of my undertaking.",
          "I am already far north of London; and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves, and fills me with delight. Do you understand this feeling? This breeze, which has travelled from the regions towards which I am advancing, gives me a foretaste of those icy climes. Inspirited by this wind of promise, my day dreams become more fervent and vivid. I try in vain to be persuaded that the pole is the seat of frost and desolation; it ever presents itself to my imagination as the region of beauty and delight. There, Margaret, the sun is for ever visible; its broad disk just skirting the horizon, and diffusing a perpetual splendour. There—for with your leave, my sister, I will put some trust in preceding navigators—there snow and frost are banished; and, sailing over a calm sea, we may be wafted to a land surpassing in wonders and in beauty every region hitherto discovered on the habitable globe. Its productions and features may be without example, as the phænomena of the heavenly bodies undoubtedly are in those undiscovered solitudes. What may not be expected in a country of eternal light? I may there discover the wondrous power which attracts the needle; and may regulate a thousand celestial observations, that require only this voyage to render their seeming eccentricities consistent for ever. I shall satiate my ardent curiosity with the sight of a part of the world never before visited, and may tread a land never before imprinted by the foot of man. These are my enticements, and they are sufficient to conquer all fear of danger or death, and to induce me to commence this laborious voyage with the joy a child feels when he embarks in a little boat, with his holiday mates, on an expedition of discovery up his native river. But, supposing all these conjectures to be false, you cannot contest the inestimable benefit which I shall confer on all mankind to the last generation, by discovering a passage near the pole to those countries, to reach which at present so many months are requisite; or by ascertaining the secret of the magnet, which, if at all possible, can only be effected by an undertaking such as mine.",
        ].join("\n\n"),
      },
      {
        title: "Letter 2",
        text: [
          "To Mrs. SAVILLE, England.",
          "Archangel, 28th March, 17—.",
          "How slowly the time passes here, encompassed as I am by frost and snow; yet a second step is taken towards my enterprise. I have hired a vessel, and am occupied in collecting my sailors; those whom I have already engaged appear to be men on whom I can depend, and are certainly possessed of dauntless courage.",
          "But I have one want which I have never yet been able to satisfy; and the absence of the object of which I now feel as a most severe evil. I have no friend, Margaret: when I am glowing with the enthusiasm of success, there will be none to participate my joy; if I am assailed by disappointment, no one will endeavour to sustain me in dejection. I shall commit my thoughts to paper, it is true; but that is a poor medium for the communication of feeling. I desire the company of a man who could sympathize with me; whose eyes would reply to mine. You may deem me romantic, my dear sister, but I bitterly feel the want of a friend. I have no one near me, gentle yet courageous, possessed of a cultivated as well as of a capacious mind, whose tastes are like my own, to approve or amend my plans. How would such a friend repair the faults of your poor brother! I am too ardent in execution, and too impatient of difficulties. But it is a still greater evil to me that I am self-educated: for the first fourteen years of my life I ran wild on a common, and read nothing but our uncle Thomas’s books of voyages. At that age I became acquainted with the celebrated poets of our own country; but it was only when it had ceased to be in my power to derive its most important benefits from such a conviction, that I perceived the necessity of becoming acquainted with more languages than that of my native country. Now I am twenty-eight, and am in reality more illiterate than many school-boys of fifteen. It is true that I have thought more, and that my day dreams are more extended and magnificent; but they want (as the painters call it) keeping; and I greatly need a friend who would have sense enough not to despise me as romantic, and affection enough for me to endeavour to regulate my mind.",
          "Well, these are useless complaints; I shall certainly find no friend on the wide ocean, nor even here in Archangel, among merchants and seamen. Yet some feelings, unallied to the dross of human nature, beat even in these rugged bosoms. My lieutenant, for instance, is a man of wonderful courage and enterprise; he is madly desirous of glory. He is an Englishman, and in the midst of national and professional prejudices, unsoftened by cultivation, retains some of the noblest endowments of humanity. I first became acquainted with him on board a whale vessel: finding that he was unemployed in this city, I easily engaged him to assist in my enterprise.",
        ].join("\n\n"),
      },
    ],
  },
];

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The demo's uploads, dated from now so they always look recent. */
export function demoUploads(now: number): UploadedBook[] {
  return DEMO_UPLOADS.map((u) => {
    const chapterWords = u.chapters.map((c) => words(c.text));
    return {
      id: u.id,
      title: u.title,
      author: u.author,
      chapterTitles: u.chapters.map((c) => c.title),
      chapterWords,
      words: chapterWords.reduce((a, b) => a + b, 0),
      path: null,
      createdAt: now - u.daysAgo * 86_400_000,
      publishedYear: u.publishedYear,
    };
  });
}

/** A demo upload's text, chapter by chapter, by its id (served in place of Storage). */
export const DEMO_UPLOAD_TEXTS: ReadonlyMap<string, string[]> = new Map(DEMO_UPLOADS.map((u) => [u.id, u.chapters.map((c) => c.text)]));

/** The upload Avery is partway through, for Continue reading and *Recently changed*. */
export const DEMO_UPLOAD_READING = DEMO_UPLOADS[0].id;

/**
 * The demo upload whose natural voices are recorded: the opening of Frankenstein, voiced once with
 * every natural voice by scripts/voice-demo-sample.mjs into public/voices/demo/a4, so the demo plays
 * natural voices without calling Google (lib/demoVoices.ts).
 */
export const DEMO_NATURAL_SAMPLE = "u-d3e0a1000000000000000000000000a4";
/** The Tide Clock: its chapter 2 has Juno and Ezra talking, so the demo can play character voices. */
export const DEMO_CAST_SAMPLE = "u-d3e0a1000000000000000000000000a1";
/** The demo uploads with recorded natural voices (lib/demoVoices.ts). */
export const DEMO_NATURAL_SAMPLES: readonly string[] = [DEMO_NATURAL_SAMPLE, DEMO_CAST_SAMPLE];
