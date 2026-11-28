import { useStore } from "../store/context";
import type { Book } from "../types";
import { usesBackend } from "./backend";
import { onDeviceOffered } from "./onDeviceVoice";

/** Whether the on-device natural voices are offered for `book` (members and the demo, English books; lib/onDeviceVoice.ts). */
export function useOnDeviceVoice(book: Book): boolean {
  const { state } = useStore();
  // The demo too: the voices run in the visitor's own browser and nothing is sent, so the demo can
  // show them for real (the model downloads from our storage like a member's).
  const member = (usesBackend && Boolean(state.account?.userId)) || Boolean(state.account?.isDemo);
  return onDeviceOffered({ member, language: book.language });
}
