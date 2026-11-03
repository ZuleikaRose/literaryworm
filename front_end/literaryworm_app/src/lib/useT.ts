import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useStore } from "../store/context";
import { makeT, type Messages, type T, type UiLanguage } from "./i18n";

// Each language's dictionary is its own file, fetched the first time it's chosen.
const loaders = import.meta.glob<{ default: Messages }>("../data/i18n/*.json");
const cache: Partial<Record<UiLanguage, Messages>> = {};
const listeners = new Set<() => void>();

function load(lang: UiLanguage) {
  if (lang === "en" || cache[lang]) return;
  const loader = loaders[`../data/i18n/${lang}.json`];
  loader?.().then(
    (m) => {
      cache[lang] = m.default;
      listeners.forEach((l) => l());
    },
    (err: unknown) => console.error(`i18n: couldn't load ${lang}:`, err instanceof Error ? err.message : err),
  );
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The chosen language (the accessibility menu's Language). */
export function useLanguage(): UiLanguage {
  return useStore().state.a11y.language;
}

/** t() in the chosen language: English until its dictionary has loaded, and for any text not translated yet. */
export function useT(): T {
  const lang = useLanguage();
  const messages = useSyncExternalStore(subscribe, () => cache[lang]);
  useEffect(() => load(lang), [lang]);
  return useMemo(() => makeT(lang, messages), [lang, messages]);
}
