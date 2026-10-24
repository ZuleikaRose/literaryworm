import { useId } from "react";
import { READER_SIZES } from "../lib/reading";
import { useProfileData, useStore } from "../store/context";
import type { ReaderSettings } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

interface Choice<K extends keyof ReaderSettings> {
  value: ReaderSettings[K];
  label: string;
}

function Choices<K extends keyof ReaderSettings>({ legend, setting, options }: { legend: string; setting: K; options: Choice<K>[] }) {
  const { dispatch } = useStore();
  const current = useProfileData().readerSettings[setting];
  const name = useId();
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      <div className="chip-group">
        {options.map((o) => (
          <label key={String(o.value)} className={`chip reader-choice-${setting}-${String(o.value)}`}>
            <input
              type="radio"
              name={name}
              checked={current === o.value}
              onChange={() => dispatch({ type: "updateReaderSettings", patch: { [setting]: o.value } })}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Font, size, line spacing, margins and theme. Kept for the profile until the page is refreshed. */
export function ReaderDisplayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const { size } = useProfileData().readerSettings;
  const setSize = (next: number) => dispatch({ type: "updateReaderSettings", patch: { size: next } });

  return (
    <Dialog open={open} onClose={onClose} title="Display" description={<p>Changes show on the page straight away.</p>}>
      <div className="reader-display">
        <Choices
          legend="Theme"
          setting="theme"
          options={[
            { value: "light", label: "Light" },
            { value: "sepia", label: "Sepia" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <Choices
          legend="Font"
          setting="font"
          options={[
            { value: "serif", label: "Literata (serif)" },
            { value: "sans", label: "DM Sans" },
            { value: "readable", label: "Lexend (easier reading)" },
          ]}
        />
        <fieldset className="filter-group">
          <legend>Text size</legend>
          <div className="size-stepper">
            <button type="button" className="icon-button" disabled={size === 0} onClick={() => setSize(size - 1)}>
              <span aria-hidden="true">A−</span>
              <span className="visually-hidden">Smaller text</span>
            </button>
            <output aria-live="polite">{READER_SIZES[size]} px</output>
            <button type="button" className="icon-button" disabled={size === READER_SIZES.length - 1} onClick={() => setSize(size + 1)}>
              <span aria-hidden="true">A+</span>
              <span className="visually-hidden">Larger text</span>
            </button>
          </div>
        </fieldset>
        <Choices
          legend="Line spacing"
          setting="spacing"
          options={[
            { value: "compact", label: "Compact" },
            { value: "normal", label: "Normal" },
            { value: "relaxed", label: "Relaxed" },
          ]}
        />
        <Choices
          legend="Margins"
          setting="margins"
          options={[
            { value: "narrow", label: "Narrow" },
            { value: "normal", label: "Normal" },
            { value: "wide", label: "Wide" },
          ]}
        />
        <button type="button" className="primary-button" onClick={onClose}>
          <Icon name="check" size={18} /> Done
        </button>
      </div>
    </Dialog>
  );
}
