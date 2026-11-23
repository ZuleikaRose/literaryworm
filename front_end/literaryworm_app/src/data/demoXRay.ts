import type { DemoXRay, XRayItem, XRayKind } from "../lib/xray";

/**
 * The demo's X-Ray, written ahead for its three classics with text in the app (public/texts):
 * the demo never calls the `xray` function or Claude. Each description says only what the
 * book has shown by the chapter it's first named in (`firstChapter`, 1-based, checked against
 * the text by xray.test.ts), so it spoils nothing at any later chapter, and nobody is shown
 * before the reader reaches them. Mentions are counted in the text, as for members.
 */

type Entry = [name: string, firstChapter: number, description: string, aliases?: string[]];

const items = (kind: XRayKind, entries: Entry[]): XRayItem[] =>
  entries.map(([name, firstChapter, description, aliases = []]) => ({ name, kind, description, firstChapter, aliases }));

export const DEMO_XRAY: DemoXRay = {
  "pride-and-prejudice": [
    ...items("people", [
      ["Mr. Bennet", 1, "A dry, teasing country gentleman who enjoys provoking his wife and keeps his own counsel."],
      ["Mrs. Bennet", 2, "Mr. Bennet's excitable wife, whose great business in life is getting her five daughters married."],
      ["Mr. Bingley", 1, "A rich young man from the north who has taken Netherfield Park, to the delight of the neighbourhood's mothers.", ["Bingley"]],
      ["Jane", 1, "The eldest Bennet daughter, thought the handsomest, gentle and inclined to think well of everyone.", ["Miss Bennet"]],
      ["Elizabeth", 1, "The second Bennet daughter, quick-witted, lively and her father's favourite.", ["Lizzy", "Eliza"]],
      ["Lydia", 1, "The youngest Bennet daughter, bold, loud and fond of officers and dancing."],
      ["Kitty", 2, "The fourth Bennet daughter, who tends to follow wherever Lydia leads."],
      ["Mary", 2, "The middle Bennet daughter, studious and fond of moral observations."],
      ["Mr. Darcy", 3, "Mr. Bingley's proud, very rich friend from Derbyshire, thought disagreeable after the assembly at Meryton.", ["Darcy"]],
      ["Miss Bingley", 3, "Mr. Bingley's fashionable sister, who looks down on the local society."],
      ["Mrs. Hurst", 3, "Mr. Bingley's married elder sister, who shares Miss Bingley's opinions."],
      ["Sir William Lucas", 1, "A neighbour of the Bennets who, with Lady Lucas, is quick to call on newcomers.", ["Sir William"]],
      ["Charlotte", 5, "Sir William's sensible eldest daughter and Elizabeth's close friend.", ["Charlotte Lucas"]],
      ["Mrs. Long", 1, "A neighbour who brings Mrs. Bennet the news about Netherfield."],
      ["Mrs. Philips", 7, "Mrs. Bennet's sister, married to an attorney in Meryton, who loves company and gossip."],
      ["Mr. Collins", 13, "A clergyman and Mr. Bennet's cousin, who will inherit Longbourn; his first letter is pompous and full of himself."],
      ["Lady Catherine", 13, "Mr. Collins's patroness, a great lady he can't stop praising.", ["Lady Catherine de Bourgh"]],
      ["Mr. Wickham", 15, "A handsome, easy-mannered young man who has just joined the militia at Meryton.", ["Wickham"]],
    ]),
    ...items("places", [
      ["Longbourn", 3, "The Bennets' home and estate in Hertfordshire."],
      ["Netherfield", 1, "The grand house nearby that Mr. Bingley has taken.", ["Netherfield Park"]],
      ["Meryton", 4, "The small market town a mile from Longbourn, with its assemblies and shops."],
      ["Lucas Lodge", 5, "Sir William Lucas's house near Meryton."],
      ["Hertfordshire", 3, "The county where the Bennets live."],
      ["Derbyshire", 3, "The county Mr. Darcy comes from, where his large estate lies."],
      ["Pemberley", 6, "Mr. Darcy's estate in Derbyshire, which Miss Bingley much admires."],
      ["London", 3, "Where the Bingleys go and come back from, and where some of the Bennets' relations live."],
    ]),
    ...items("terms", [
      ["assembly", 3, "A public ball in Meryton, where the neighbourhood meets the Netherfield party."],
      ["officers", 6, "Soldiers of the militia, who have Lydia and Kitty's full attention."],
      ["militia", 7, "A regiment quartered in Meryton for the winter."],
      ["entail", 13, "The legal arrangement under which Longbourn must pass to a male heir, not to Mr. Bennet's daughters."],
    ]),
  ],
  frankenstein: [
    ...items("people", [
      ["Margaret", 2, "The sister in England to whom the letters that open the book are written.", ["Mrs. SAVILLE"]],
      ["Walton", 5, "The writer of the letters, an explorer sailing north in search of a passage through the ice."],
      ["Victor", 6, "The stranger rescued from the ice, who begins to tell his own story from his childhood in Geneva.", ["Frankenstein"]],
      ["Beaufort", 6, "A merchant and friend of Victor's father, who fell into poverty.", ["Caroline Beaufort"]],
      ["Elizabeth", 6, "A girl brought up with Victor in his family from childhood, gentle and loved by everyone in the house."],
      ["Clerval", 6, "Victor's closest friend at school, Henry, the son of a Geneva merchant, who loves tales of adventure.", ["Henry Clerval"]],
      ["William", 6, "Victor's youngest brother, a small child at home."],
      ["Ernest", 6, "Another of Victor's younger brothers."],
      ["M. Krempe", 7, "A blunt professor of natural philosophy at Ingolstadt.", ["Krempe"]],
      ["M. Waldman", 7, "A gentle, inspiring professor of chemistry at Ingolstadt.", ["Waldman"]],
      ["Justine", 10, "A girl taken into the Frankenstein household, whom the family is very fond of.", ["Justine Moritz"]],
    ]),
    ...items("places", [
      ["Geneva", 1, "The city where Victor was born and his family lives."],
      ["Petersburgh", 2, "St. Petersburg, where the letters begin as the voyage north is planned."],
      ["Archangel", 2, "The Russian port where the ship for the voyage north is hired."],
      ["England", 2, "Home, where the letters are sent."],
      ["Belrive", 6, "Where the Frankenstein family has a house by the lake."],
      ["Ingolstadt", 7, "The German university town where Victor goes to study."],
    ]),
    ...items("terms", [
      ["sledge", 5, "The sledges seen crossing the ice far to the north."],
      ["natural philosophy", 6, "What the period called science, which comes to fascinate Victor."],
      ["Cornelius Agrippa", 6, "An old writer on the occult whose books Victor reads eagerly as a boy."],
      ["Paracelsus", 6, "A sixteenth-century physician and alchemist among the young Victor's favourite authors."],
      ["Albertus Magnus", 6, "A medieval scholar whose old writings Victor studies with Agrippa's."],
    ]),
  ],
  "alice-in-wonderland": [
    ...items("people", [
      ["Alice", 1, "A curious, sensible girl who follows a talking rabbit down a hole on a hot, sleepy afternoon."],
      ["White Rabbit", 1, "A rabbit with pink eyes, a waistcoat and a watch, always in a hurry.", ["Rabbit"]],
      ["Dinah", 1, "Alice's cat at home, whom she keeps talking about."],
      ["Mouse", 2, "A Mouse swimming in the pool of tears, easily offended by talk of cats and dogs."],
      ["Duchess", 2, "Someone the White Rabbit is very anxious not to keep waiting."],
      ["Mabel", 2, "A girl Alice knows, whom she worries she may have turned into."],
      ["Dodo", 2, "One of the creatures swimming in the pool of tears with Alice."],
      ["Lory", 2, "A kind of parrot, another of the creatures in the pool of tears."],
      ["Bill", 4, "A lizard sent down the chimney of the White Rabbit's house."],
      ["Caterpillar", 5, "A blue Caterpillar sitting on a mushroom, smoking a long hookah and asking Alice who she is."],
      ["Pigeon", 5, "A Pigeon who takes the long-necked Alice for a serpent."],
      ["Cheshire Cat", 6, "The Duchess's grinning cat, who can vanish at will."],
      ["Queen", 6, "A Queen who has invited the Duchess to play croquet."],
      ["Hatter", 6, "Someone the Cheshire Cat says lives in one direction, and is mad."],
      ["March Hare", 6, "Someone the Cheshire Cat says lives in the other direction, and is also mad."],
      ["Dormouse", 7, "A sleepy Dormouse at the tea-table, used as a cushion by the others."],
      ["King", 8, "The King of Hearts, at the Queen's croquet-ground."],
    ]),
    ...items("places", [
      ["rabbit-hole", 1, "The hole under the hedge that Alice follows the White Rabbit down."],
      ["garden", 1, "The loveliest garden, seen through a tiny door, that Alice longs to reach."],
    ]),
    ...items("terms", [
      ["DRINK ME", 1, "The label on a little bottle Alice finds on the glass table."],
      ["EAT ME", 1, "The words marked in currants on a very small cake."],
      ["caucus-race", 3, "The Dodo's race, run in a circle, to get everyone dry."],
      ["mushroom", 4, "A large mushroom, about Alice's height, where she meets the Caterpillar."],
      ["hookah", 4, "The long pipe a large blue caterpillar is smoking on top of a mushroom."],
      ["croquet", 1, "A lawn game; Alice once boxed her own ears for cheating at it."],
    ]),
  ],
};

/** The books the demo has a sample X-Ray for. */
export const DEMO_XRAY_BOOKS = Object.keys(DEMO_XRAY);
