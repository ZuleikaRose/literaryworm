import { useEffect, useId, useState } from "react";
import { Icon } from "./Icon";
import { useT } from "../lib/useT";

interface ShareImageProps<T extends string> {
  /** The looks to choose from; the first is chosen to begin with. */
  themes: { value: T; label: string }[];
  /** Draws the picture in a look. */
  draw: (theme: T) => Promise<Blob>;
  fileName: string;
  /** The share sheet's title. */
  shareTitle: string;
  /** The picture's words: its alt text, the text shared with it, and what Copy copies. */
  text: string;
  copyLabel: string;
  copiedMessage: string;
  /** The picture's height at 1080 wide: 1350 for cards, 1920 for story screens. */
  height?: number;
}

/**
 * A picture to share, drawn in the browser: a choice of look, a preview, then Share (on devices
 * that can share files), Download, and Copy as text. Nothing is uploaded. Used by the quote card
 * and the Year in Review card.
 */
export function ShareImage<T extends string>({ themes, draw, fileName, shareTitle, text, copyLabel, copiedMessage, height = 1350 }: ShareImageProps<T>) {
  const t = useT();
  const [theme, setTheme] = useState<T>(themes[0].value);
  const [card, setCard] = useState<{ theme: T; blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const name = useId();

  useEffect(() => {
    let live = true;
    let url: string | null = null;
    draw(theme).then(
      (blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ theme, blob, url });
        setFailed(null);
      },
      (err: Error) => {
        if (live) setFailed(err.message);
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draw, theme]);

  const ready = card?.theme === theme ? card : null;
  const file = ready ? new File([ready.blob], fileName, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: shareTitle, text });
      setStatus(t("Shared."));
    } catch (err) {
      // Closing the share sheet isn't a failure.
      if ((err as Error).name !== "AbortError") setStatus(t("We couldn't open sharing. Download the picture instead."));
    }
  };
  const download = () => {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = fileName;
    a.click();
    setStatus(t("Picture downloaded."));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(copiedMessage);
    } catch {
      setStatus(t("We couldn't copy it. Select the text and copy it instead."));
    }
  };

  return (
    <div className="quote-card">
      <fieldset className="segmented">
        <legend className="field-label">{t("Look")}</legend>
        <div>
          {themes.map((look) => (
            <label key={look.value}>
              <input type="radio" name={name} value={look.value} checked={theme === look.value} onChange={() => setTheme(look.value)} />
              <span>{t(look.label)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="quote-card-preview" aria-busy={!ready && !failed}>
        {failed ? (
          <p className="field-error" role="alert">
            <Icon name="alert" size={15} /> {failed}
          </p>
        ) : ready ? (
          <img src={ready.url} width={1080} height={height} alt={t("Picture: {text}", { text })} />
        ) : (
          <p className="quote-card-loading">{t("Drawing the card…")}</p>
        )}
      </div>

      <div className="modal-actions">
        {canShareFile && (
          <button type="button" className="primary-button" onClick={share}>
            <Icon name="share" size={17} /> {t("Share")}
          </button>
        )}
        <button type="button" className={canShareFile ? "secondary-button" : "primary-button"} disabled={!ready} onClick={download}>
          <Icon name="download" size={17} /> {t("Download picture")}
        </button>
        <button type="button" className="ghost-button" onClick={copy}>
          {copyLabel}
        </button>
      </div>
      <p className="form-success quote-card-status" role="status">
        {status}
      </p>
    </div>
  );
}
