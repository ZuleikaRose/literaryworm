import { useState } from "react";
import { useInstallApp } from "../lib/installApp";
import { useT } from "../lib/useT";
import { Icon } from "./Icon";

/**
 * "Install the app": puts LiteraryWorm on the home screen or desktop, where it opens in its
 * own window and works offline. Says how on Safari, which has no install button.
 */
export function InstallApp() {
  const { state, install } = useInstallApp();
  const [message, setMessage] = useState<string | null>(null);
  const t = useT();

  return (
    <div className="install-app">
      <span>
        <strong>{t("The LiteraryWorm app")}</strong>
        <small>
          {state === "installed"
            ? t("You're using the app. It opens in its own window and keeps books you save for offline.")
            : state === "safari"
              ? t("To add it to your home screen, choose Share, then Add to Home Screen (on a Mac: File, then Add to Dock).")
              : state === "ready"
                ? t("Add LiteraryWorm to your home screen or desktop. It opens in its own window and keeps books you save for offline.")
                : t("In Chrome or Edge, choose Install from the browser's menu or address bar (some browsers can't install apps). On an iPhone or iPad, choose Share, then Add to Home Screen.")}
        </small>
      </span>
      {state === "ready" && (
        <button
          type="button"
          className="secondary-button"
          onClick={async () => {
            try {
              const done = await install();
              setMessage(done ? t("Installed. You'll find LiteraryWorm with your other apps.") : null);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : t("Your browser couldn't install LiteraryWorm just now."));
            }
          }}
        >
          <Icon name="download" size={18} /> {t("Install the app")}
        </button>
      )}
      <p className="install-done" role="status">
        {message ?? ""}
      </p>
    </div>
  );
}
