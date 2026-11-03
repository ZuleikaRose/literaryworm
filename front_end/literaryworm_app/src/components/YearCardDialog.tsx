import { useCallback, useMemo } from "react";
import type { YearStats } from "../lib/stats";
import { YEAR_CARD_THEMES, type YearCardTheme, yearCardBlob, yearCardFacts, yearCardFileName, yearCardText } from "../lib/yearCard";
import { Dialog } from "./Dialog";
import { ShareImage } from "./ShareImage";
import { useT } from "../lib/useT";

/** My Library → Stats → Share as a picture: the year's review as a card to share or download. */
export function YearCardDialog({ open, onClose, name, stats, goal }: { open: boolean; onClose: () => void; name: string; stats: YearStats; goal: number | null }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Share your year")} eyebrow={t("{year} in books", { year: stats.year })}>
      {open && <YearCard name={name} stats={stats} goal={goal} />}
    </Dialog>
  );
}

function YearCard({ name, stats, goal }: { name: string; stats: YearStats; goal: number | null }) {
  const t = useT();
  const facts = useMemo(() => yearCardFacts(name, stats, goal), [name, stats, goal]);
  const draw = useCallback((theme: YearCardTheme) => yearCardBlob(facts, theme), [facts]);
  return (
    <ShareImage
      themes={YEAR_CARD_THEMES}
      draw={draw}
      fileName={yearCardFileName(stats.year)}
      shareTitle={facts.title}
      text={yearCardText(facts)}
      copyLabel={t("Copy as text")}
      copiedMessage={t("Copied.")}
    />
  );
}
