import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";
import { useT } from "../lib/useT";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * "Continue on your phone": the place as a link (lib/continueLink.ts) and a QR code to scan with
 * another device's camera. Drawn here as an SVG; nothing is sent anywhere. Used by the reader, the
 * player and the mini-player's More.
 */
export function ContinueDialog({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const dark: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push(`M${c} ${r}h1v1h-1z`);
    return { n, path: dark.join("") };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("Continue on your phone")} size="sm">
      <p className="goal-hint">{t("Scan this with your phone's camera to open {title} at this place.", { title })}</p>
      <svg
        className="continue-qr"
        viewBox={`-4 -4 ${cells.n + 8} ${cells.n + 8}`}
        role="img"
        aria-label={t("QR code that opens {title} at this place", { title })}
        shapeRendering="crispEdges"
      >
        <rect x="-4" y="-4" width={cells.n + 8} height={cells.n + 8} className="continue-qr-paper" />
        <path d={cells.path} className="continue-qr-ink" />
      </svg>
      <p className="continue-link">{url}</p>
      <button type="button" className="secondary-button small-button" onClick={() => void copy()}>
        <Icon name="share" size={15} /> {copied ? t("Link copied") : t("Copy link")}
      </button>
      <p className="goal-hint">{t("Members' places also follow them to every device they sign in on.")}</p>
    </Dialog>
  );
}
