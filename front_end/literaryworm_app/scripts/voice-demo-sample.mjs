#!/usr/bin/env node
// Voices the demo's natural-voice samples (Frankenstein, and The Tide Clock with its dialogue)
// once with every English natural voice, with and without character voices, so the demo can play
// natural voices without calling Google (or Supabase) for visitors. Writes
// public/voices/demo/<voice>-<chapter>-<piece>.mp3, cut exactly as the player cuts it
// (chapterPieces() in src/lib/naturalVoice.ts; character-voice pieces as c<n>). Files already there are kept, so it can be run
// again after a voice is added. About 5,400 characters a voice: a few cents in all.
//
// The Google key is read from GOOGLE_TTS_API_KEY in the environment or in .env.local (which git
// ignores); it's never printed. Run from front_end/literaryworm_app:
//   node scripts/voice-demo-sample.mjs
// Needs Node 23.6 or later (it imports the app's TypeScript directly).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";

// The app imports its modules without the .ts ending; let Node find them.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return next(`${specifier}.ts`, context);
      throw err;
    }
  },
});
const { DEMO_NATURAL_SAMPLES, DEMO_UPLOAD_TEXTS } = await import("../src/data/demoUploads.ts");
const { demoPieceFiles } = await import("../src/lib/demoVoices.ts");

function apiKey() {
  if (process.env.GOOGLE_TTS_API_KEY) return process.env.GOOGLE_TTS_API_KEY.trim();
  if (existsSync(".env.local")) {
    const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_TTS_API_KEY="));
    if (line) return line.slice("GOOGLE_TTS_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  }
  console.error("Set GOOGLE_TTS_API_KEY in the environment or add a GOOGLE_TTS_API_KEY= line to .env.local.");
  process.exit(1);
}

const key = apiKey();
let made = 0;
let kept = 0;
for (const id of DEMO_NATURAL_SAMPLES) {
  const chapters = DEMO_UPLOAD_TEXTS.get(id);
  if (!chapters) throw new Error(`${id} isn't one of the demo uploads.`);
  // Every piece the player can ask for: plain, with character voices, and each speech in every English cast voice.
  for (const { path, voice, text } of demoPieceFiles(id, chapters)) {
      const file = join("public", path);
      if (existsSync(file)) {
        kept++;
        continue;
      }
      const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: voice.split("-").slice(0, 2).join("-"), name: voice },
          audioConfig: { audioEncoding: "MP3" },
        }),
      });
      if (!res.ok) {
        console.error(`${path}: Google answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
        process.exit(1);
      }
      const { audioContent } = await res.json();
      mkdirSync(join("public", "voices", "demo"), { recursive: true });
      writeFileSync(file, Buffer.from(audioContent, "base64"));
      made++;
      console.log(`voiced ${file}`);
  }
}
console.log(`Done: ${made} voiced, ${kept} already there.`);
