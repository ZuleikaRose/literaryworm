import { useEffect, useRef, useState } from "react";
import { planById } from "../data/plans";
import { useStore } from "../store/context";
import { listeningBetween } from "./accountApi";
import { today } from "./reading";
import { listenedSoFar, listenedThisMonth, listeningLeft, monthRange, nextMonthLabel } from "./planLimits";

/** While playing, a member's listening on other devices is looked up this often. */
const CHECK_MS = 5 * 60_000;

/**
 * The account's audiobook hours this month (Basic 5, Standard 30, Premium unlimited), for the
 * whole household on every device. `reached` pauses the player until next month. Members' other
 * devices are counted from the server's total, checked when playing starts and every 5 minutes;
 * in-memory accounts count what's in the store.
 */
export function useListeningAllowance(playing: boolean) {
  const { state } = useStore();
  const account = state.account;
  const planId = account?.planId ?? null;
  const member = Boolean(account?.userId);
  const hours = planById.get(planId ?? "basic")?.audioHoursPerMonth ?? null;

  const day = today();
  const { from, to } = monthRange(day);
  const local = listenedThisMonth(
    state.profiles.map((p) => state.profileData[p.id]?.readingDays ?? {}),
    day,
  );
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  });

  const [check, setCheck] = useState<{ month: string; server: number; local: number } | null>(null);
  useEffect(() => {
    if (!member || !playing || hours === null) return;
    let live = true;
    const look = () =>
      listeningBetween(from, to).then(
        (server) => live && setCheck({ month: from, server, local: localRef.current }),
        (err: Error) => console.error("allowance: couldn't check this month's listening:", err.message),
      );
    void look();
    const id = window.setInterval(look, CHECK_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [member, playing, hours, from, to]);

  const listened = check?.month === from ? listenedSoFar(check.server, check.local, local) : local;
  const left = listeningLeft(planId, listened);
  return {
    /** The plan's hours a month, or null for unlimited. */
    hours,
    planId,
    planName: planById.get(planId ?? "basic")?.name ?? "Basic",
    leftSeconds: left,
    reached: left !== null && left <= 0,
    resumesOn: nextMonthLabel(day),
  };
}
