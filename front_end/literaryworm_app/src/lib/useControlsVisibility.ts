import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_AFTER_MS = 4000;

/**
 * Reader and player controls fade out while reading and come back on a tap, mouse move,
 * key press or focus. They stay up while `canHide` is false (a panel is open), and never hide
 * while focus is inside them, so keyboard users don't lose what they're on.
 */
export function useControlsVisibility(canHide: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    if (!canHide) return;
    timer.current = window.setTimeout(() => {
      const active = document.activeElement;
      if (active?.closest(".reader-bar, .player-bar")) return;
      setVisible(false);
    }, HIDE_AFTER_MS);
  }, [canHide]);

  const show = useCallback(() => {
    setVisible(true);
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    const onKey = () => show();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [schedule, show]);

  return { visible: visible || !canHide, show };
}
