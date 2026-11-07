#!/usr/bin/env node
// Records a few seconds of every natural voice (each narrator and each character voice) for the
// player's previews (src/lib/voicePreview.ts), into public/voices/preview/<voice>.mp3, so visitors
// and members hear a voice before choosing it without anything being voiced for them. Files
// already there are kept, so run it again after adding a voice. About 60 characters a voice.
//
// The Google key is read from GOOGLE_TTS_API_KEY in the environment or in .env.local (which git
// ignores); it's never printed. Run from front_end/literaryworm_app:
//   node scripts/voice-previews.mjs

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
const { previewPath, previewVoices, PREVIEW_TEXTS } = await import("../src/lib/voicePreview.ts");

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
mkdirSync(join("public", "voices", "preview"), { recursive: true });
let made = 0;
for (const { id, language } of previewVoices()) {
  const file = join("public", previewPath(id));
  if (existsSync(file)) continue;
  const [lang, region] = id.split("-");
  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input: { text: PREVIEW_TEXTS[language] }, voice: { languageCode: `${lang}-${region.toUpperCase()}`, name: id }, audioConfig: { audioEncoding: "MP3" } }),
  });
  if (!res.ok) {
    console.error(`${id}: Google answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  writeFileSync(file, Buffer.from((await res.json()).audioContent, "base64"));
  made++;
  console.log(`recorded ${file}`);
}
console.log(`Done: ${made} recorded.`);
