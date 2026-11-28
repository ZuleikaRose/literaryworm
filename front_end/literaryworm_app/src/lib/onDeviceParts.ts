// The on-device narrator's parts without loading the engine up front: the engine (ONNX Runtime and
// the pronouncing dictionary) is imported the first time a piece is asked for.
import { devicePieces, type OnDeviceVoice } from "./onDeviceVoice";

export function onDeviceParts(voice: OnDeviceVoice, chapters: string[]) {
  let part: Promise<{ url: (chapter: number, segment: number) => Promise<string> }> | null = null;
  return {
    pieces: devicePieces,
    url: (chapter: number, segment: number) => {
      part ??= import("./onDeviceEngine").then(({ onDeviceVoicePart }) => onDeviceVoicePart(voice, chapters));
      part.catch(() => (part = null));
      return part.then((p) => p.url(chapter, segment));
    },
  };
}
