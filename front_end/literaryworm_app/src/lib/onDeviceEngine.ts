// Runs an on-device voice (lib/onDeviceVoice.ts) in the browser: ONNX Runtime Web (WebAssembly,
// in its own worker so the page stays responsive) and @piper-plus/g2p's English pronunciation.
// Everything here is imported only when someone first chooses an on-device voice, so the app's
// first load doesn't grow. The model is fetched once from /voice-models/ and kept in the
// `lw-voices` cache, then works offline; the text never leaves the device.

import { devicePieces, modelPartPaths, modelPath, ON_DEVICE_CACHE, type OnDeviceVoice, phonemeIds, wavBytes } from "./onDeviceVoice";
import { tr } from "./i18n";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import wasmLoaderUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";

type Ort = typeof import("onnxruntime-web/wasm");
type Session = import("onnxruntime-web/wasm").InferenceSession;
interface VoiceConfig {
  phoneme_id_map: Record<string, number[]>;
  /** Models of many speakers (VCTK, CMU ARCTIC) number them here. */
  speaker_id_map?: Record<string, number>;
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
}

let ortLoading: Promise<Ort> | null = null;
function runtime(): Promise<Ort> {
  ortLoading ??= import("onnxruntime-web/wasm").then((ort) => {
    ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: wasmLoaderUrl };
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = true;
    ort.env.logLevel = "error";
    return ort;
  });
  ortLoading.catch(() => (ortLoading = null));
  return ortLoading;
}

type G2p = import("@piper-plus/g2p/en").EnglishG2P;
let g2pLoading: Promise<G2p> | null = null;
function pronunciation(): Promise<G2p> {
  g2pLoading ??= import("@piper-plus/g2p/en").then(({ EnglishG2P }) => EnglishG2P.create());
  g2pLoading.catch(() => (g2pLoading = null));
  return g2pLoading;
}

const downloadFailed = () => new Error(tr("We couldn't download this voice. Check your connection, then press play to try again."));

/**
 * A file from /voice-models/, from the device's cache when it's there (kept there after the first
 * time). `parts` are the addresses it's stored in, joined in order (a model is over Storage's upload limit).
 */
async function voiceFile(path: string, parts: string[] = [path]): Promise<Response> {
  const cache = typeof caches === "undefined" ? null : await caches.open(ON_DEVICE_CACHE).catch(() => null);
  const kept = await cache?.match(path);
  if (kept) return kept;
  const blobs = await Promise.all(
    parts.map(async (part) => {
      const res = await fetch(part).catch(() => null);
      if (!res?.ok) throw downloadFailed();
      return res.blob();
    }),
  );
  const whole = new Response(new Blob(blobs), { headers: { "Content-Type": parts.length > 1 ? "application/octet-stream" : (blobs[0].type || "application/json") } });
  await cache?.put(path, whole.clone()).catch(() => undefined);
  return whole;
}

const loaded = new Map<string, Promise<{ session: Session; config: VoiceConfig }>>();
/** A voice's model, loaded once per file (the speakers of one model share it). */
function voiceModel(voice: OnDeviceVoice) {
  let model = loaded.get(voice.file);
  if (!model) {
    model = (async () => {
      const [ort, config, bytes] = await Promise.all([
        runtime(),
        voiceFile(modelPath(voice, true)).then((r) => r.json() as Promise<VoiceConfig>),
        voiceFile(modelPath(voice), modelPartPaths(voice)).then((r) => r.arrayBuffer()),
      ]);
      return { session: await ort.InferenceSession.create(new Uint8Array(bytes)), config };
    })();
    model.catch(() => loaded.delete(voice.file));
    loaded.set(voice.file, model);
  }
  return model;
}

// One piece is voiced at a time.
let queue: Promise<unknown> = Promise.resolve();

/** `text` read by `voice`, as WAV bytes. */
export function speakOnDevice(voice: OnDeviceVoice, text: string): Promise<Uint8Array> {
  const job = queue.then(async () => {
    const [ort, g2p, { session, config }] = await Promise.all([runtime(), pronunciation(), voiceModel(voice)]);
    const ids = phonemeIds(g2p.phonemize(text).tokens, config.phoneme_id_map);
    const { noise_scale, length_scale, noise_w } = config.inference;
    const feeds: Record<string, import("onnxruntime-web/wasm").Tensor> = {
      input: new ort.Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
      input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor("float32", Float32Array.from([noise_scale, length_scale, noise_w]), [3]),
    };
    if (voice.speaker !== undefined) {
      const sid = config.speaker_id_map?.[voice.speaker];
      if (sid === undefined) throw new Error(tr("This voice stopped working. Try another voice from the list."));
      feeds.sid = new ort.Tensor("int64", BigInt64Array.from([BigInt(sid)]), [1]);
    }
    const result = await session.run(feeds);
    return wavBytes(result.output.data as Float32Array, config.audio.sample_rate);
  });
  queue = job.catch(() => undefined);
  return job;
}

/** How many voiced pieces stay in memory; an older one is voiced again if it's played again. */
const KEEP_PIECES = 10;

/**
 * Parts for naturalNarrator(): each piece of `chapters` (devicePieces()) voiced on the device when
 * it's asked for, as a blob link. The narrator asks for the next piece while one plays.
 */
export function onDeviceVoicePart(voice: OnDeviceVoice, chapters: string[]) {
  const pieces = chapters.map((c) => devicePieces(c));
  const links: string[] = [];
  return {
    pieces: devicePieces,
    url: async (chapter: number, segment: number) => {
      const piece = pieces[chapter]?.[segment];
      if (!piece) throw new Error(tr("This voice stopped working. Try another voice from the list."));
      const wav = await speakOnDevice(voice, piece.text);
      const link = URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" }));
      links.push(link);
      while (links.length > KEEP_PIECES) URL.revokeObjectURL(links.shift()!);
      return link;
    },
  };
}

