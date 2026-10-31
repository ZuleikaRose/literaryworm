import { READER_SHORTCUTS } from "../lib/shortcuts";
import { Dialog } from "./Dialog";

/** The reader's keyboard shortcuts (press ? in the reader). */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      size="sm"
      description={<p>They work when focus isn't in a field. Ctrl, Alt and Cmd shortcuts stay the browser's.</p>}
    >
      <dl className="shortcut-list">
        {READER_SHORTCUTS.map((s) => (
          <div key={s.action} className="shortcut-row">
            <dt>
              {s.keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && <span className="muted"> or </span>}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
