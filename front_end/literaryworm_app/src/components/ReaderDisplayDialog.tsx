import { useId } from "react";
import { tk } from "../lib/i18n";
import { READER_SIZES } from "../lib/reading";
import { useT } from "../lib/useT";
import { useProfileData, useStore } from "../store/context";
import type { ReaderSettings } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

interface Choice<K extends keyof ReaderSettings> {
  value: ReaderSettings[K];
  label: string;
}

function Choices<K extends keyof ReaderSettings>({ legend, setting, options }: { legend: string; setting: K; options: Choice<K>[] }) {
  const t = useT();
  const { dispatch } = useStore();
  const current = useProfileData().readerSettings[setting];
  const name = useId();
  return (
    <fieldset className="filter-group">
      <legend>{t(legend)}</legend>
      <div className="chip-group">
        {options.map((o) => (
          <label key={String(o.value)} className={`chip reader-choice-${setting}-${String(o.value)}`}>
            <input
              type="radio"
              name={name}
              checked={current === o.value}
              onChange={() => dispatch({ type: "updateReaderSettings", patch: { [setting]: o.value } })}
            />
            <span>{t(o.label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Font, size, reading guide, line spacing, margins and theme. Kept for the profile until the page is refreshed. */
export function ReaderDisplayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { dispatch } = useStore();
  const { size } = useProfileData().readerSettings;
  const setSize = (next: number) => dispatch({ type: "updateReaderSettings", patch: { size: next } });

  return (
    <Dialog open={open} onClose={onClose} title={t("Display")} description={<p>{t("Changes show on the page straight away.")}</p>}>
      <div className="reader-display">
        <Choices
          legend={tk("Theme")}
          setting="theme"
          options={[
            { value: "light", label: tk("Light") },
            { value: "sepia", label: tk("Sepia") },
            { value: "dark", label: tk("Dark") },
          ]}
        />
        <Choices
          legend={tk("Font")}
          setting="font"
          options={[
            { value: "serif", label: tk("Literata (serif)") },
            { value: "sans", label: "DM Sans" },
            { value: "readable", label: tk("Lexend (easier reading)") },
            { value: "dyslexic", label: "OpenDyslexic" },
          ]}
        />
        <fieldset className="filter-group">
          <legend>{t("Text size")}</legend>
          <div className="size-stepper">
            <button type="button" className="icon-button" disabled={size === 0} onClick={() => setSize(size - 1)}>
              <span aria-hidden="true">A−</span>
              <span className="visually-hidden">{t("Smaller text")}</span>
            </button>
            <output aria-live="polite">{READER_SIZES[size]} px</output>
            <button type="button" className="icon-button" disabled={size === READER_SIZES.length - 1} onClick={() => setSize(size + 1)}>
              <span aria-hidden="true">A+</span>
              <span className="visually-hidden">{t("Larger text")}</span>
            </button>
          </div>
        </fieldset>
        <Choices
          legend={tk("Reading guide")}
          setting="guide"
          options={[
            { value: "off", label: tk("Off") },
            { value: "ruler", label: tk("Reading ruler") },
            { value: "focus", label: tk("Line focus") },
          ]}
        />
        <p className="field-hint reader-guide-hint">{t("The guide follows your pointer or a tap; J and K move it a line down or up.")}</p>
        <Choices
          legend={tk("Line spacing")}
          setting="spacing"
          options={[
            { value: "compact", label: tk("Compact") },
            { value: "normal", label: tk("Normal") },
            { value: "relaxed", label: tk("Relaxed") },
          ]}
        />
        <Choices
          legend={tk("Margins")}
          setting="margins"
          options={[
            { value: "narrow", label: tk("Narrow") },
            { value: "normal", label: tk("Normal") },
            { value: "wide", label: tk("Wide") },
          ]}
        />
        <button type="button" className="primary-button" onClick={onClose}>
          <Icon name="check" size={18} /> {t("Done")}
        </button>
      </div>
    </Dialog>
  );
}
