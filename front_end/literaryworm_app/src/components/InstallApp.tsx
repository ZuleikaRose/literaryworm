import { useState } from "react";
import { useInstallApp } from "../lib/installApp";
import { Icon } from "./Icon";

/**
 * "Install the app": puts LiteraryWorm on the home screen or desktop, where it opens in its
 * own window and works offline. Says how on Safari, which has no install button.
 */
export function InstallApp() {
  const { state, install } = useInstallApp();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="install-app">
      <span>
        <strong>The LiteraryWorm app</strong>
        <small>
          {state === "installed"
            ? "You're using the app. It opens in its own window and keeps books you save for offline."
            : state === "safari"
              ? "To add it to your home screen, choose Share, then Add to Home Screen (on a Mac: File, then Add to Dock)."
              : state === "ready"
                ? "Add LiteraryWorm to your home screen or desktop. It opens in its own window and keeps books you save for offline."
                : "In Chrome or Edge, choose Install from the browser's menu or address bar (some browsers can't install apps). On an iPhone or iPad, choose Share, then Add to Home Screen."}
        </small>
      </span>
      {state === "ready" && (
        <button
          type="button"
          className="secondary-button"
          onClick={async () => {
            try {
              const done = await install();
              setMessage(done ? "Installed. You'll find LiteraryWorm with your other apps." : null);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Your browser couldn't install LiteraryWorm just now.");
            }
          }}
        >
          <Icon name="download" size={18} /> Install the app
        </button>
      )}
      <p className="install-done" role="status">
        {message ?? ""}
      </p>
    </div>
  );
}
