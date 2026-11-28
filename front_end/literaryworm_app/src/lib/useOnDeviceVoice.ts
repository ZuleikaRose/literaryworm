import { useStore } from "../store/context";
import type { Book } from "../types";
import { usesBackend } from "./backend";
import { offeredOnDeviceVoices, onDeviceOffered, type OnDeviceVoice } from "./onDeviceVoice";

/**
 * The on-device natural voices offered for `book` (members and the demo, English books; lib/onDeviceVoice.ts):
 * all 39 for members, the demo's three models' voices (DEMO_ON_DEVICE_FILES), none otherwise.
 */
export function useOnDeviceVoice(book: Book): readonly OnDeviceVoice[] {
  const { state } = useStore();
  // The demo too: the voices run in the visitor's own browser and nothing is sent, so the demo can
  // show them for real (the model downloads from our storage like a member's).
  const demo = Boolean(state.account?.isDemo);
  const member = (usesBackend && Boolean(state.account?.userId)) || demo;
  return offeredOnDeviceVoices({ offered: onDeviceOffered({ member, language: book.language }), demo });
}
