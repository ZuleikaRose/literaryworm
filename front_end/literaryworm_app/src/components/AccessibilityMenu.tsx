import { useId, useLayoutEffect, useRef } from "react";
import { tk, UI_LANGUAGES, type UiLanguage } from "../lib/i18n";
import { TRANSCRIPT_LANGUAGES, TRANSCRIPT_SIZES } from "../lib/transcript";
import { usePopover } from "../lib/usePopover";
import { useT } from "../lib/useT";
import { useStore } from "../store/context";
import { startingA11y } from "../store/state";
import type { A11ySettings } from "../types";
import { Icon } from "./Icon";

const textSizes = [
  { value: 1, label: tk("Default") },
  { value: 1.15, label: tk("Large") },
  { value: 1.3, label: tk("Larger") },
];

type ToggleKey = "readableFont" | "dyslexicFont" | "highContrast" | "underlineLinks" | "reduceMotion";

const toggles: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "readableFont", label: tk("Dyslexia-friendly font"), hint: tk("Switches the interface to Lexend") },
  {
    key: "dyslexicFont",
    label: tk("OpenDyslexic font"),
    hint: tk("Switches the interface to OpenDyslexic, a typeface made for readers with dyslexia"),
  },
  {
    key: "highContrast",
    label: tk("High contrast"),
    hint: tk("Black or white backgrounds, bolder text and edges; on when your device asks for more contrast"),
  },
  { key: "underlineLinks", label: tk("Highlight links"), hint: tk("Underlines every link") },
  { key: "reduceMotion", label: tk("Stop animations"), hint: tk("Turns off movement and the carousel") },
];

/** One interface font at a time: turning Lexend or OpenDyslexic on turns the other off. */
function togglePatch(key: ToggleKey, on: boolean): Partial<A11ySettings> {
  if (on && key === "readableFont") return { readableFont: true, dyslexicFont: false };
  if (on && key === "dyslexicFont") return { dyslexicFont: true, readableFont: false };
  return { [key]: on };
}

export function AccessibilityMenu() {
  const { state, dispatch } = useStore();
  const t = useT();
  const { open, toggle, wrapRef, triggerRef } = usePopover();
  const panelId = useId();
  const languageId = useId();
  const a11y = state.a11y;
  const set = (patch: Partial<A11ySettings>) => dispatch({ type: "updateA11y", patch });
  const panelRef = useRef<HTMLDivElement>(null);

  // The panel fits the window below where it opens (lower when the maintenance banner shows) and
  // scrolls inside itself, so its last settings are never cut off on a short screen.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const fit = () => {
      const room = window.innerHeight - panel.getBoundingClientRect().top - 12;
      panel.style.maxHeight = `${Math.max(room, 160)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, { passive: true });
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit);
    };
  }, [open]);

  return (
    <div className="popover-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <Icon name="accessibility" />
        <span className="visually-hidden">{t("Accessibility menu")}</span>
      </button>
      {open && (
        <div ref={panelRef} id={panelId} className="popover a11y-panel" role="region" aria-label={t("Accessibility settings")}>
          <h2 className="popover-title">{t("Accessibility")}</h2>

          <div className="field a11y-language">
            <label className="field-label" htmlFor={languageId}>
              {t("Language")}
            </label>
            <select id={languageId} className="field-input" value={a11y.language} onChange={(e) => set({ language: e.target.value as UiLanguage })}>
              {UI_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} lang={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="segmented">
            <legend>{t("Text size")}</legend>
            <div>
              {textSizes.map((s) => (
                <label key={s.value}>
                  <input
                    type="radio"
                    name="text-size"
                    checked={a11y.textScale === s.value}
                    onChange={() => set({ textScale: s.value })}
                  />
                  <span>{t(s.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="segmented">
            <legend>{t("Theme")}</legend>
            <div>
              {(["dark", "light"] as const).map((theme) => (
                <label key={theme}>
                  <input type="radio" name="theme" checked={a11y.theme === theme} onChange={() => set({ theme })} />
                  <span>
                    <Icon name={theme === "dark" ? "moon" : "sun"} size={15} /> {theme === "dark" ? t("Dark") : t("Light")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <ul className="switch-list">
            {toggles.map((item) => (
              <li key={item.key}>
                <label className="switch-row">
                  <span>
                    <strong>{t(item.label)}</strong>
                    <small>{t(item.hint)}</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={Boolean(a11y[item.key])}
                    onChange={(e) => set(togglePatch(item.key, e.target.checked))}
                  />
                </label>
              </li>
            ))}
          </ul>

          <h3 className="popover-subtitle">{t("Audio and transcripts")}</h3>
          <label className="switch-row a11y-transcript-switch">
            <span>
              <strong>{t("Read-along transcript")}</strong>
              <small>{t("Shows the words in the audiobook player")}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={a11y.transcript}
              onChange={(e) => set({ transcript: e.target.checked })}
            />
          </label>
          <fieldset className="segmented">
            <legend>{t("Transcript size")}</legend>
            <div>
              {TRANSCRIPT_SIZES.map((s) => (
                <label key={s.value}>
                  <input
                    type="radio"
                    name="transcript-size"
                    checked={a11y.transcriptSize === s.value}
                    onChange={() => set({ transcriptSize: s.value })}
                  />
                  <span>{t(s.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="segmented">
            <legend>{t("Transcript language")}</legend>
            <div>
              {TRANSCRIPT_LANGUAGES.map((l) => (
                <label key={l.value}>
                  <input
                    type="radio"
                    name="transcript-language"
                    checked={a11y.transcriptLanguage === l.value}
                    onChange={() => set({ transcriptLanguage: l.value })}
                  />
                  <span lang={l.value}>{l.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="button" className="text-button" onClick={() => set(startingA11y())}>
            {t("Reset to defaults")}
          </button>
        </div>
      )}
    </div>
  );
}
