#!/usr/bin/env node
// Voices the demo's Frankenstein upload once with every natural voice, so the demo can play
// natural voices without calling Google (or Supabase) for visitors. Writes
// public/voices/demo/<voice>-<chapter>-<piece>.mp3, cut exactly as the player cuts it
// (voiceSegments() in src/lib/naturalVoice.ts). Files already there are kept, so it can be run
// again after a voice is added. About 5,400 characters a voice: a few cents in all.
//
// The Google key is read from GOOGLE_TTS_API_KEY in the environment or in .env.local (which git
// ignores); it's never printed. Run from front_end/literaryworm_app:
//   node scripts/voice-demo-sample.mjs
// Needs Node 23.6 or later (it imports the app's TypeScript directly).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_NATURAL_SAMPLE, DEMO_UPLOAD_TEXTS } from "../src/data/demoUploads.ts";
import { NATURAL_VOICES, voiceSegments } from "../src/lib/naturalVoice.ts";
import { demoVoicePath } from "../src/lib/demoVoices.ts";

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
const chapters = DEMO_UPLOAD_TEXTS.get(DEMO_NATURAL_SAMPLE);
if (!chapters) throw new Error("The demo's natural-voice sample isn't one of the demo uploads.");

let made = 0;
let kept = 0;
for (const voice of NATURAL_VOICES) {
  for (const [chapter, text] of chapters.entries()) {
    for (const [segment, piece] of voiceSegments(text).entries()) {
      const file = join("public", demoVoicePath(voice.id, chapter, segment));
      if (existsSync(file)) {
        kept++;
        continue;
      }
      const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: { text: piece.text },
          voice: { languageCode: voice.languageCode, name: voice.id },
          audioConfig: { audioEncoding: "MP3" },
        }),
      });
      if (!res.ok) {
        console.error(`${voice.id} chapter ${chapter} piece ${segment}: Google answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
        process.exit(1);
      }
      const { audioContent } = await res.json();
      mkdirSync(join("public", "voices", "demo"), { recursive: true });
      writeFileSync(file, Buffer.from(audioContent, "base64"));
      made++;
      console.log(`voiced ${file}`);
    }
  }
}
console.log(`Done: ${made} voiced, ${kept} already there.`);
