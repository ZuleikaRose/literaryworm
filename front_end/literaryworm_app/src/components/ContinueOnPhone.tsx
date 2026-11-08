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
export function ContinueDialog({
  open,
  onClose,
  url,
  title,
  demo = false,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  /** The demo's link (demoLink()): the same dialog, worded for trying the demo on a phone. */
  demo?: boolean;
}) {
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
    <Dialog open={open} onClose={onClose} title={demo ? t("Open the demo on your phone") : t("Continue on your phone")} size="sm">
      <p className="goal-hint">
        {demo ? t("Scan this with your phone's camera to open the demo there.") : t("Scan this with your phone's camera to open {title} at this place.", { title })}
      </p>
      <svg
        className="continue-qr"
        viewBox={`-4 -4 ${cells.n + 8} ${cells.n + 8}`}
        role="img"
        aria-label={demo ? t("QR code that opens the LiteraryWorm demo") : t("QR code that opens {title} at this place", { title })}
        shapeRendering="crispEdges"
      >
        <rect x="-4" y="-4" width={cells.n + 8} height={cells.n + 8} className="continue-qr-paper" />
        <path d={cells.path} className="continue-qr-ink" />
      </svg>
      <p className="continue-link">{url}</p>
      <button type="button" className="secondary-button small-button" onClick={() => void copy()}>
        <Icon name="share" size={15} /> {copied ? t("Link copied") : t("Copy link")}
      </button>
      <p className="goal-hint">
        {demo ? t("The demo on your phone is its own sample household: nothing you do in one shows in the other.") : t("Members' places also follow them to every device they sign in on.")}
      </p>
    </Dialog>
  );
}

/** *Open the demo on your phone*: a text button that shows the demo's link as a QR code (log-in page, public home). */
export function DemoOnPhoneButton({ url }: { url: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        <Icon name="qr" size={15} /> {t("Open the demo on your phone")}
      </button>
      {open && <ContinueDialog open onClose={() => setOpen(false)} url={url} title="LiteraryWorm" demo />}
    </>
  );
}
