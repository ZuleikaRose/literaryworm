import type { TranscriptLanguage } from "../types";

/**
 * Sample pages for the reader, and the player's read-along transcript. BookWorm doesn't hold
 * any book's text in this build, so every chapter is filled with original placeholder prose
 * (the reader and player say so). The text is made from the book id, chapter and page, so a
 * page always reads the same. The Spanish lists are translations in the same order, so a page
 * says the same thing in both languages.
 */

const OPENINGS = [
  "The morning came slowly, the way it does when nobody is waiting for it.",
  "Nobody in the house remembered who had first left the lamp burning in the window.",
  "There is a particular silence that settles over a place just before the weather turns.",
  "By the time the letter arrived, the question it answered had already changed.",
  "The road out of town was older than the town itself, and it showed.",
  "Some days begin with a decision; this one began with a door left open.",
];

const SENTENCES = [
  "She counted the steps to the end of the hall and found, as always, that there was one more than she expected.",
  "Outside, the wind worried at the shutters as if it had something urgent to say and no words to say it with.",
  "He had promised himself he would not look back, and he kept the promise for almost a minute.",
  "The kettle began to sing, thin and patient, and for a while that was the only voice in the room.",
  "Every map they owned had been drawn by someone who had never been there.",
  "It was not courage that carried them forward so much as the fear of what standing still would mean.",
  "The light through the old glass was the colour of weak tea, and it made everything look remembered.",
  "Somewhere below, a clock struck the hour, and then, after a pause, struck it again as if to be sure.",
  "They talked about small things because the large ones would not fit through the door.",
  "The pages of the notebook were soft from handling, the corners rounded like river stones.",
  "Nothing about the stranger was remarkable except the care with which he closed the gate behind him.",
  "The garden had gone wild in the way gardens do when they are loved and left alone.",
  "She wrote the sentence down, crossed it out, and then wrote it again exactly the same.",
  "Far off, a train called across the fields, and the dog lifted its head to answer.",
  "What they found in the cellar was not treasure, though for a moment it looked like it.",
  "He had a way of listening that made people tell him more than they meant to.",
  "The rain stopped all at once, leaving the street bright and astonished.",
  "There were questions she had carried for years, and she felt them shift now, like cargo in a turning ship.",
  "The fire settled, sending up a brief constellation of sparks.",
  "They agreed to wait until morning, which is the oldest agreement in the world.",
  "On the table lay a key that fitted no lock anyone could remember.",
  "The sea, when they finally reached it, was smaller than the one they had imagined and somehow better.",
  "Her grandmother used to say that a story is only a long way of telling the truth.",
  "In the quiet after the argument, both of them pretended to read.",
  "The house kept its warmth in the kitchen and its old stories in the attic.",
  "By noon the fog had lifted enough to show the outline of the hills, pale as a pencil sketch.",
  "Nobody mentioned the empty chair, which was how everyone knew they were all thinking about it.",
  "The bell above the shop door rang twice, once for the opening and once, more quietly, for the doubt.",
  "She folded the map along its old creases, as if the paper remembered the way better than she did.",
  "There was bread on the table and a candle in the window, and for one evening that was enough.",
  "He spoke slowly, choosing each word the way a climber chooses a handhold.",
  "The children had invented a game whose rules changed whenever someone was about to lose.",
  "Snow began to fall without any sound at all, as though it did not want to interrupt.",
  "The letters were tied with a ribbon that had once been blue.",
  "Every evening the lighthouse keeper wrote one line in the log, and every evening it was a little different.",
  "They walked until the streetlights gave out and the stars took over the work.",
];

const OPENINGS_ES = [
  "La mañana llegó despacio, como llega cuando nadie la espera.",
  "Nadie en la casa recordaba quién había dejado por primera vez la lámpara encendida en la ventana.",
  "Hay un silencio particular que se posa sobre un lugar justo antes de que cambie el tiempo.",
  "Cuando llegó la carta, la pregunta que respondía ya había cambiado.",
  "El camino que salía del pueblo era más viejo que el propio pueblo, y se notaba.",
  "Algunos días empiezan con una decisión; este empezó con una puerta abierta.",
];

const SENTENCES_ES = [
  "Contó los pasos hasta el final del pasillo y descubrió, como siempre, que había uno más de los que esperaba.",
  "Afuera, el viento sacudía las contraventanas como si tuviera algo urgente que decir y ninguna palabra para decirlo.",
  "Se había prometido no mirar atrás, y cumplió la promesa durante casi un minuto.",
  "La tetera empezó a cantar, fina y paciente, y durante un rato fue la única voz de la habitación.",
  "Todos los mapas que tenían los había dibujado alguien que nunca había estado allí.",
  "No era el valor lo que los empujaba hacia delante, sino el miedo a lo que significaría quedarse quietos.",
  "La luz que atravesaba el cristal viejo tenía el color del té flojo, y todo parecía un recuerdo.",
  "En algún lugar, abajo, un reloj dio la hora y, tras una pausa, volvió a darla como para asegurarse.",
  "Hablaban de cosas pequeñas porque las grandes no cabían por la puerta.",
  "Las páginas del cuaderno estaban suaves de tanto usarlas, con las esquinas redondeadas como piedras de río.",
  "Nada en el desconocido llamaba la atención, salvo el cuidado con que cerró la verja tras de sí.",
  "El jardín se había vuelto salvaje, como hacen los jardines cuando se les quiere y se les deja en paz.",
  "Escribió la frase, la tachó y luego la volvió a escribir exactamente igual.",
  "A lo lejos, un tren llamó a través de los campos, y el perro levantó la cabeza para responder.",
  "Lo que encontraron en el sótano no era un tesoro, aunque por un momento lo pareció.",
  "Tenía una manera de escuchar que hacía que la gente le contara más de lo que pretendía.",
  "La lluvia paró de golpe y dejó la calle brillante y asombrada.",
  "Había preguntas que llevaba consigo desde hacía años, y ahora las sintió moverse, como la carga de un barco que vira.",
  "El fuego se asentó y soltó una breve constelación de chispas.",
  "Acordaron esperar hasta la mañana, que es el acuerdo más antiguo del mundo.",
  "Sobre la mesa había una llave que no encajaba en ninguna cerradura que alguien recordara.",
  "El mar, cuando por fin llegaron, era más pequeño que el que habían imaginado y, de algún modo, mejor.",
  "Su abuela decía que una historia no es más que una forma larga de decir la verdad.",
  "En el silencio que siguió a la discusión, los dos fingieron leer.",
  "La casa guardaba su calor en la cocina y sus viejas historias en el desván.",
  "Hacia el mediodía la niebla se había levantado lo bastante para mostrar el contorno de las colinas, pálido como un boceto a lápiz.",
  "Nadie mencionó la silla vacía, y así supieron que todos estaban pensando en ella.",
  "La campanilla sobre la puerta de la tienda sonó dos veces: una por la apertura y otra, más bajito, por la duda.",
  "Dobló el mapa por sus viejos pliegues, como si el papel recordara el camino mejor que ella.",
  "Había pan en la mesa y una vela en la ventana, y por una noche eso bastó.",
  "Hablaba despacio, eligiendo cada palabra como un escalador elige dónde agarrarse.",
  "Los niños habían inventado un juego cuyas reglas cambiaban cada vez que alguien estaba a punto de perder.",
  "Empezó a nevar sin ningún sonido, como si no quisiera interrumpir.",
  "Las cartas estaban atadas con una cinta que una vez había sido azul.",
  "Cada tarde el farero escribía una línea en el registro, y cada tarde era un poco distinta.",
  "Caminaron hasta que se acabaron las farolas y las estrellas se hicieron cargo del trabajo.",
];

/** A small, repeatable random sequence (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The sentences of one sample page, paragraph by paragraph. A sentence appears at most once on
 * a page. The shuffle depends only on the page, so English and Spanish line up sentence for
 * sentence.
 */
export function samplePageSentences(bookId: string, chapterIndex: number, page: number, language: TranscriptLanguage = "en"): string[][] {
  const [openings, sentences] = language === "es" ? [OPENINGS_ES, SENTENCES_ES] : [OPENINGS, SENTENCES];
  const next = seeded(hash(`${bookId}:${chapterIndex}:${page}`));
  // Shuffle the sentence numbers for this page, then deal them out in order.
  const pool = sentences.map((_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const paragraphs: string[][] = [];
  const count = 5 + Math.floor(next() * 2);
  for (let p = 0; p < count && pool.length > 0; p++) {
    const picked = pool.splice(0, 2 + Math.floor(next() * 3)).map((i) => sentences[i]);
    if (p === 0 && page === 0) picked.unshift(openings[Math.floor(next() * openings.length)]);
    paragraphs.push(picked);
  }
  return paragraphs;
}

/** The paragraphs of one sample page. */
export function samplePage(bookId: string, chapterIndex: number, page: number, language: TranscriptLanguage = "en"): string[] {
  return samplePageSentences(bookId, chapterIndex, page, language).map((sentences) => sentences.join(" "));
}
