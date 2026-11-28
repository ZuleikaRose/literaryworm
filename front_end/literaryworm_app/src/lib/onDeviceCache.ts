// The on-device voices' models on this device (the `lw-voices` cache), without loading the engine.
import { modelPath, ON_DEVICE_CACHE, ON_DEVICE_VOICES, type OnDeviceVoice } from "./onDeviceVoice";

/** How many of the on-device voices' models are kept on this device. */
export async function onDeviceVoicesKept(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  const cache = await caches.open(ON_DEVICE_CACHE).catch(() => null);
  if (!cache) return 0;
  const files = [...new Map(ON_DEVICE_VOICES.map((v) => [v.file, v])).values()];
  const hits = await Promise.all(files.map((v) => cache.match(modelPath(v))));
  return hits.filter(Boolean).length;
}

/** Removes the on-device voices from this device (they download again when next chosen). */
export async function forgetOnDeviceVoices(): Promise<void> {
  if (typeof caches !== "undefined") await caches.delete(ON_DEVICE_CACHE).catch(() => undefined);
}

/** Whether `voice`'s model is kept on this device (so it plays without downloading). */
export async function onDeviceVoiceKept(voice: OnDeviceVoice): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const cache = await caches.open(ON_DEVICE_CACHE).catch(() => null);
  return Boolean(await cache?.match(modelPath(voice)));
}
