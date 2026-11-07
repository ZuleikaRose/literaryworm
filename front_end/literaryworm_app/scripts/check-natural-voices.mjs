#!/usr/bin/env node
// Checks that every natural voice the app offers (NATURAL_VOICES in src/lib/naturalVoice.ts) is one
// Google Text-to-Speech has, by asking Google's voice list for each language. Run it after adding a
// language. Free: listing voices voices nothing.
//
// The key is read from GOOGLE_TTS_API_KEY in the environment or in .env.local (which git ignores);
// it's never printed. Run from front_end/literaryworm_app (Node 23.6 or later):
//   node scripts/check-natural-voices.mjs

import { existsSync, readFileSync } from "node:fs";
import { NATURAL_VOICES } from "../src/lib/naturalVoice.ts";

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
const codes = [...new Set(NATURAL_VOICES.map((v) => v.languageCode))];
const missing = [];
for (const code of codes) {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=${code}`, { headers: { "X-Goog-Api-Key": key } });
  if (!res.ok) {
    console.error(`${code}: Google answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const names = new Set(((await res.json()).voices ?? []).map((v) => v.name));
  for (const v of NATURAL_VOICES.filter((x) => x.languageCode === code)) {
    const ok = names.has(v.id);
    if (!ok) missing.push(v.id);
    console.log(`${ok ? "ok     " : "MISSING"} ${v.id}`);
  }
}
console.log(missing.length ? `\n${missing.length} voice(s) Google doesn't have: ${missing.join(", ")}` : "\nEvery natural voice exists.");
process.exit(missing.length ? 1 : 0);
