// Google Cloud Text-to-Speech, with the GOOGLE_TTS_API_KEY function setting (an API key limited
// to the Text-to-Speech API). The key goes in a header, never the address, so it stays out of logs.

import { HttpError } from "../_shared/http.ts";

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TIMEOUT_MS = 30_000;

export async function synthesize(text: string, voiceId: string, languageCode: string): Promise<Uint8Array> {
  const key = Deno.env.get("GOOGLE_TTS_API_KEY");
  if (!key) throw new HttpError("upstream_error", "Natural voices aren't set up yet.");
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voiceId },
        // Voiced at normal speed: the player changes the speed as it plays, so one copy serves every speed.
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new HttpError("upstream_timeout", "Voicing took too long. Try again.");
    throw new HttpError("upstream_error", "We couldn't reach the voice service. Try again.");
  }
  if (!res.ok) {
    // Google's message can name the project; log it, never return it.
    console.error("natural-voice: Google answered", res.status, (await res.text().catch(() => "")).slice(0, 500));
    throw new HttpError(res.status === 429 ? "rate_limited" : "upstream_error", "We couldn't voice that just now. Try again.");
  }
  const content = ((await res.json().catch(() => null)) as { audioContent?: unknown } | null)?.audioContent;
  if (typeof content !== "string" || !content) throw new HttpError("upstream_error", "We couldn't voice that just now. Try again.");
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
