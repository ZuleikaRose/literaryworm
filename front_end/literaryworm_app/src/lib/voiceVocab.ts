import type { UiLanguage } from "./i18n";

/**
 * The words car mode's voice control listens for, in each interface language (lib/voiceCommands.ts
 * reads them). Each list holds phrases as people say them; the first of each is the one the help
 * shows. Matching ignores case and, except in Hindi, Korean, Japanese and Chinese, accents, so
 * "atras" and "atrás" are the same. Leaving car mode always needs the language's word for the car,
 * so stray talk can't close it. A skip's length is digits (which the speech services write) with
 * the language's word for minutes, or seconds when there's none.
 */
export interface Vocab {
  /** The recognizer's language (BCP 47) when the browser's own isn't this language. */
  recognizer: string;
  exit: string[];
  nextChapter: string[];
  previousChapter: string[];
  back: string[];
  forward: string[];
  pause: string[];
  play: string[];
  /** Words for minutes after a number ("2 minutes"). */
  minutes: string[];
  /** Number words for skips ("thirty"), English only: other speech services write digits. */
  numbers?: Record<string, number>;
}

export const VOICE_VOCAB: Record<UiLanguage, Vocab> = {
  en: {
    recognizer: "en-GB",
    exit: ["exit car mode", "leave car mode", "close car mode", "quit car mode", "close the car view", "exit the car"],
    nextChapter: ["next chapter", "following chapter", "skip chapter", "skip the chapter", "skip this chapter"],
    previousChapter: ["previous chapter", "last chapter", "prior chapter", "chapter back", "back a chapter", "back one chapter"],
    back: ["back", "rewind", "backward", "backwards", "replay"],
    forward: ["forward", "forwards", "ahead", "skip"],
    pause: ["pause", "stop", "hold on", "wait"],
    play: ["play", "resume", "continue", "start", "go on", "keep going"],
    minutes: ["minute", "minutes", "min", "mins"],
    numbers: {
      five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, fortyfive: 45, sixty: 60, ninety: 90,
      "a minute": 60, "one minute": 60, "two minutes": 120, "five minutes": 300, "ten minutes": 600,
    },
  },
  es: {
    recognizer: "es-ES",
    exit: ["salir del modo coche", "cerrar el modo coche", "salir del modo auto", "salir del coche"],
    nextChapter: ["siguiente capítulo", "capítulo siguiente", "próximo capítulo"],
    previousChapter: ["capítulo anterior", "anterior capítulo"],
    back: ["atrás", "retroceder", "retrocede", "rebobinar", "rebobina"],
    forward: ["adelante", "avanzar", "avanza", "saltar", "salta"],
    pause: ["pausa", "pausar", "parar", "detener", "espera"],
    play: ["reproducir", "reanudar", "continuar", "continúa", "sigue", "seguir"],
    minutes: ["minuto", "minutos"],
  },
  fr: {
    recognizer: "fr-FR",
    exit: ["quitter le mode voiture", "fermer le mode voiture", "sortir du mode voiture"],
    nextChapter: ["chapitre suivant", "prochain chapitre"],
    previousChapter: ["chapitre précédent", "chapitre d'avant"],
    back: ["arrière", "recule", "reculer", "revenir", "reviens"],
    forward: ["avance", "avancer", "en avant", "saute", "sauter"],
    pause: ["pause", "stop", "arrête", "arrêter", "attends"],
    play: ["lecture", "lire", "reprendre", "reprends", "continuer", "continue"],
    minutes: ["minute", "minutes"],
  },
  de: {
    recognizer: "de-DE",
    exit: ["automodus beenden", "automodus verlassen", "automodus schließen", "auto modus beenden"],
    nextChapter: ["nächstes kapitel", "kapitel weiter"],
    previousChapter: ["vorheriges kapitel", "letztes kapitel", "kapitel zurück"],
    back: ["zurück", "zurückspulen", "rückwärts"],
    forward: ["vor", "vorwärts", "vorspulen", "weiter springen", "überspringen"],
    pause: ["pause", "stopp", "stop", "anhalten", "warte"],
    play: ["abspielen", "wiedergabe", "fortsetzen", "weiter", "los"],
    minutes: ["minute", "minuten"],
  },
  pt: {
    recognizer: "pt-BR",
    exit: ["sair do modo carro", "fechar o modo carro", "sair do carro"],
    nextChapter: ["próximo capítulo", "capítulo seguinte"],
    previousChapter: ["capítulo anterior"],
    back: ["voltar", "volta", "retroceder", "atrás"],
    forward: ["avançar", "avança", "adiante", "pular", "pula"],
    pause: ["pausa", "pausar", "parar", "espera"],
    play: ["tocar", "reproduzir", "continuar", "continua", "retomar"],
    minutes: ["minuto", "minutos"],
  },
  it: {
    recognizer: "it-IT",
    exit: ["esci dalla modalità auto", "chiudi la modalità auto", "esci dalla modalita auto"],
    nextChapter: ["capitolo successivo", "prossimo capitolo"],
    previousChapter: ["capitolo precedente"],
    back: ["indietro", "riavvolgi", "torna indietro"],
    forward: ["avanti", "vai avanti", "salta"],
    pause: ["pausa", "stop", "ferma", "aspetta"],
    play: ["riproduci", "play", "riprendi", "continua"],
    minutes: ["minuto", "minuti"],
  },
  nl: {
    recognizer: "nl-NL",
    exit: ["automodus sluiten", "automodus verlaten", "stop automodus", "auto modus sluiten"],
    nextChapter: ["volgend hoofdstuk", "volgende hoofdstuk"],
    previousChapter: ["vorig hoofdstuk", "vorige hoofdstuk"],
    back: ["terug", "terugspoelen", "achteruit"],
    forward: ["vooruit", "verder", "doorspoelen", "overslaan"],
    pause: ["pauze", "pauzeer", "stop", "wacht"],
    play: ["afspelen", "speel", "hervatten", "ga door", "doorgaan"],
    minutes: ["minuut", "minuten"],
  },
  ja: {
    recognizer: "ja-JP",
    exit: ["カーモードを終了", "カーモードを閉じる", "カーモード終了", "車モードを終了"],
    nextChapter: ["次の章", "次のチャプター"],
    previousChapter: ["前の章", "前のチャプター"],
    back: ["戻る", "戻して", "巻き戻し"],
    forward: ["進む", "進めて", "早送り", "スキップ"],
    pause: ["一時停止", "止めて", "ストップ", "待って"],
    play: ["再生", "続けて", "再開"],
    minutes: ["分"],
  },
  zh: {
    recognizer: "zh-CN",
    exit: ["退出车载模式", "关闭车载模式", "退出驾驶模式"],
    nextChapter: ["下一章"],
    previousChapter: ["上一章"],
    back: ["后退", "倒退", "往回"],
    forward: ["快进", "前进", "跳过"],
    pause: ["暂停", "停止", "等一下"],
    play: ["播放", "继续", "开始"],
    minutes: ["分钟"],
  },
  ko: {
    recognizer: "ko-KR",
    exit: ["차량 모드 종료", "차량 모드 닫기", "카 모드 종료"],
    nextChapter: ["다음 장", "다음 챕터"],
    previousChapter: ["이전 장", "이전 챕터"],
    back: ["뒤로", "되감기"],
    forward: ["앞으로", "빨리 감기", "건너뛰기"],
    pause: ["일시 정지", "일시정지", "멈춰", "정지"],
    play: ["재생", "계속", "다시 시작"],
    minutes: ["분"],
  },
  hi: {
    recognizer: "hi-IN",
    exit: ["कार मोड बंद करो", "कार मोड से बाहर", "कार मोड बंद"],
    nextChapter: ["अगला अध्याय"],
    previousChapter: ["पिछला अध्याय"],
    back: ["पीछे", "वापस"],
    forward: ["आगे"],
    pause: ["रोको", "रुको", "पॉज़"],
    play: ["चलाओ", "शुरू करो", "जारी रखो", "प्ले"],
    minutes: ["मिनट"],
  },
  ar: {
    recognizer: "ar-SA",
    exit: ["الخروج من وضع السيارة", "اخرج من وضع السيارة", "أغلق وضع السيارة"],
    nextChapter: ["الفصل التالي"],
    previousChapter: ["الفصل السابق"],
    back: ["رجوع", "ارجع", "للخلف"],
    forward: ["تقديم", "للأمام", "تخطى"],
    pause: ["إيقاف مؤقت", "توقف", "أوقف", "انتظر"],
    play: ["تشغيل", "شغل", "استمر", "تابع"],
    minutes: ["دقيقة", "دقائق", "دقيقتين"],
  },
  pl: {
    recognizer: "pl-PL",
    exit: ["wyjdź z trybu samochodowego", "zamknij tryb samochodowy", "wyłącz tryb samochodowy"],
    nextChapter: ["następny rozdział", "kolejny rozdział"],
    previousChapter: ["poprzedni rozdział"],
    back: ["cofnij", "do tyłu", "wstecz"],
    forward: ["do przodu", "naprzód", "przewiń", "pomiń"],
    pause: ["pauza", "zatrzymaj", "stop", "czekaj"],
    play: ["odtwórz", "graj", "wznów", "kontynuuj"],
    minutes: ["minuta", "minuty", "minut", "minutę"],
  },
  ru: {
    recognizer: "ru-RU",
    exit: ["выйти из режима автомобиля", "закрыть режим автомобиля", "выйти из автомобильного режима", "выйти из режима авто"],
    nextChapter: ["следующая глава", "следующую главу"],
    previousChapter: ["предыдущая глава", "предыдущую главу"],
    back: ["назад", "перемотай назад", "отмотай"],
    forward: ["вперёд", "перемотай вперёд", "пропусти"],
    pause: ["пауза", "стоп", "остановись", "подожди"],
    play: ["играй", "воспроизвести", "продолжи", "продолжить", "дальше"],
    minutes: ["минута", "минуты", "минут", "минуту"],
  },
  tr: {
    recognizer: "tr-TR",
    exit: ["araba modundan çık", "araba modunu kapat"],
    nextChapter: ["sonraki bölüm"],
    previousChapter: ["önceki bölüm"],
    back: ["geri", "geri sar"],
    forward: ["ileri", "ileri sar", "atla"],
    pause: ["duraklat", "dur", "bekle"],
    play: ["oynat", "devam et", "başlat", "devam"],
    minutes: ["dakika"],
  },
  sv: {
    recognizer: "sv-SE",
    exit: ["avsluta billäget", "stäng billäget", "lämna billäget"],
    nextChapter: ["nästa kapitel"],
    previousChapter: ["föregående kapitel", "förra kapitlet"],
    back: ["bakåt", "tillbaka", "spola tillbaka"],
    forward: ["framåt", "spola fram", "hoppa över"],
    pause: ["pausa", "paus", "stopp", "vänta"],
    play: ["spela", "fortsätt", "återuppta"],
    minutes: ["minut", "minuter"],
  },
  uk: {
    recognizer: "uk-UA",
    exit: ["вийти з режиму автомобіля", "закрити режим автомобіля", "вийти з автомобільного режиму"],
    nextChapter: ["наступний розділ"],
    previousChapter: ["попередній розділ"],
    back: ["назад", "перемотай назад"],
    forward: ["вперед", "уперед", "перемотай вперед", "пропусти"],
    pause: ["пауза", "стоп", "зупини", "зачекай"],
    play: ["грай", "відтвори", "продовжи", "далі"],
    minutes: ["хвилина", "хвилини", "хвилин", "хвилину"],
  },
  tl: {
    recognizer: "fil-PH",
    exit: ["umalis sa car mode", "isara ang car mode", "lumabas sa car mode"],
    nextChapter: ["susunod na kabanata", "next chapter"],
    previousChapter: ["nakaraang kabanata", "previous chapter"],
    back: ["bumalik", "balik", "atras"],
    forward: ["abante", "sulong", "laktaw"],
    pause: ["ihinto", "hinto", "sandali", "pause"],
    play: ["i-play", "ituloy", "tuloy", "play"],
    minutes: ["minuto"],
  },
  bg: {
    recognizer: "bg-BG",
    exit: ["излез от режима за кола", "затвори режима за кола", "изход от режима за кола"],
    nextChapter: ["следваща глава"],
    previousChapter: ["предишна глава"],
    back: ["назад", "превърти назад"],
    forward: ["напред", "превърти напред", "прескочи"],
    pause: ["пауза", "спри", "стоп", "почакай"],
    play: ["пусни", "възпроизведи", "продължи"],
    minutes: ["минута", "минути"],
  },
  ro: {
    recognizer: "ro-RO",
    exit: ["ieși din modul mașină", "închide modul mașină"],
    nextChapter: ["capitolul următor", "următorul capitol"],
    previousChapter: ["capitolul anterior", "capitolul precedent"],
    back: ["înapoi", "derulează înapoi"],
    forward: ["înainte", "derulează înainte", "sari"],
    pause: ["pauză", "oprește", "stop", "așteaptă"],
    play: ["redă", "pornește", "continuă", "reia"],
    minutes: ["minut", "minute"],
  },
  el: {
    recognizer: "el-GR",
    exit: ["έξοδος από τη λειτουργία αυτοκινήτου", "κλείσε τη λειτουργία αυτοκινήτου"],
    nextChapter: ["επόμενο κεφάλαιο"],
    previousChapter: ["προηγούμενο κεφάλαιο"],
    back: ["πίσω", "γύρνα πίσω"],
    forward: ["μπροστά", "προχώρα", "παράλειψη"],
    pause: ["παύση", "σταμάτα", "στοπ", "περίμενε"],
    play: ["αναπαραγωγή", "παίξε", "συνέχισε", "συνέχεια"],
    minutes: ["λεπτό", "λεπτά"],
  },
};

/** Scripts where accents carry meaning in the letters themselves: kept as they are. */
const KEEP_MARKS = new Set<UiLanguage>(["hi", "ko", "ja", "zh"]);
/** Languages written without spaces between words: phrases are found anywhere. */
const NO_SPACES = new Set<UiLanguage>(["ja", "zh"]);

/** Lower case, punctuation as spaces, accents dropped where that's safe. */
export function normalizeSpoken(text: string, lang: UiLanguage): string {
  let s = text.toLocaleLowerCase(lang === "tl" ? "fil" : lang);
  if (!KEEP_MARKS.has(lang)) s = s.normalize("NFD").replace(/\p{M}+/gu, "");
  return s.replace(/[^\p{L}\p{N}\p{M} ]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** Whether `text` (normalized) says `phrase`, as a whole word or words. */
export function says(text: string, phrase: string, lang: UiLanguage): boolean {
  const p = normalizeSpoken(phrase, lang);
  if (!p) return false;
  if (NO_SPACES.has(lang)) return text.includes(p.replace(/ /g, "")) || text.includes(p);
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
}

/** The language car mode listens in: the browser's own variant when it's this language, else the usual one. */
export function recognizerLanguage(lang: UiLanguage, browser: string | undefined): string {
  const base = (browser ?? "").toLowerCase().split("-")[0];
  const wanted = VOICE_VOCAB[lang].recognizer.toLowerCase().split("-")[0];
  return base === wanted && browser ? browser : VOICE_VOCAB[lang].recognizer;
}
