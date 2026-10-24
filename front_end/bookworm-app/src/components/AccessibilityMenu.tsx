import { useId } from "react";
import { usePopover } from "../lib/usePopover";
import { useStore } from "../store/context";
import { defaultA11y } from "../store/state";
import type { A11ySettings } from "../types";
import { Icon } from "./Icon";

const textSizes = [
  { value: 1, label: "Default" },
  { value: 1.15, label: "Large" },
  { value: 1.3, label: "Larger" },
];

const toggles: { key: keyof A11ySettings; label: string; hint: string }[] = [
  { key: "readableFont", label: "Dyslexia-friendly font", hint: "Switches the interface to Lexend" },
  { key: "highContrast", label: "High contrast", hint: "Brighter text and stronger edges" },
  { key: "underlineLinks", label: "Highlight links", hint: "Underlines every link" },
  { key: "reduceMotion", label: "Stop animations", hint: "Turns off movement and the carousel" },
];

export function AccessibilityMenu() {
  const { state, dispatch } = useStore();
  const { open, toggle, wrapRef, triggerRef } = usePopover();
  const panelId = useId();
  const a11y = state.a11y;
  const set = (patch: Partial<A11ySettings>) => dispatch({ type: "updateA11y", patch });

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
        <span className="visually-hidden">Accessibility menu</span>
      </button>
      {open && (
        <div id={panelId} className="popover a11y-panel" role="region" aria-label="Accessibility settings">
          <h2 className="popover-title">Accessibility</h2>

          <fieldset className="segmented">
            <legend>Text size</legend>
            <div>
              {textSizes.map((s) => (
                <label key={s.value}>
                  <input
                    type="radio"
                    name="text-size"
                    checked={a11y.textScale === s.value}
                    onChange={() => set({ textScale: s.value })}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="segmented">
            <legend>Theme</legend>
            <div>
              {(["dark", "light"] as const).map((t) => (
                <label key={t}>
                  <input type="radio" name="theme" checked={a11y.theme === t} onChange={() => set({ theme: t })} />
                  <span>
                    <Icon name={t === "dark" ? "moon" : "sun"} size={15} /> {t === "dark" ? "Dark" : "Light"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <ul className="switch-list">
            {toggles.map((t) => (
              <li key={t.key}>
                <label className="switch-row">
                  <span>
                    <strong>{t.label}</strong>
                    <small>{t.hint}</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={Boolean(a11y[t.key])}
                    onChange={(e) => set({ [t.key]: e.target.checked })}
                  />
                </label>
              </li>
            ))}
          </ul>

          <button type="button" className="text-button" onClick={() => set(defaultA11y)}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
