import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveProfile, useStore } from "../store/context";
import { joinCount, useSprintCount } from "./sprintCounter";
import { isRunning, scopeKey, type Sprint, type SprintReader, type SprintScope } from "./sprints";
import * as sprintsApi from "./sprintsApi";

/**
 * One household's or club's reading sprint: Supabase for members (with Realtime, so everyone sees
 * who joins and the pages when it ends), in memory for the demo until refresh. When a sprint this
 * device joined ends, its page count is saved once.
 */
const demoSprints = new Map<string, { sprint: Sprint; readers: SprintReader[] }>();

/**
 * The demo's last sprint, so its results show before anyone starts one: yesterday evening's 20
 * minutes at home (Avery and Sam), and the demo club's with Jordan and Priya. Kept until refresh.
 */
function seedDemoSprint(key: string, profiles: { id: string; name: string }[], me: { id: string; name: string } | undefined) {
  const startsAt = new Date(Date.now() - 86_400_000).setHours(20, 0, 0, 0);
  const sprint = (id: string, clubId: string | null): Sprint => ({ id, clubId, minutes: 20, startsAt, endsAt: startsAt + 20 * 60_000 });
  let seeded: { sprint: Sprint; readers: SprintReader[] } | null = null;
  if (key === "household") {
    const pages: Record<string, number> = { Avery: 14, Sam: 9 };
    const readers = profiles.filter((p) => p.name in pages).map((p) => ({ profileId: p.id, name: p.name, pages: pages[p.name], finished: true, mine: true }));
    if (readers.length) seeded = { sprint: sprint("demo-sprint-home", null), readers };
  } else if (key === "club:demo-club" && me) {
    seeded = {
      sprint: sprint("demo-sprint-club", "demo-club"),
      readers: [
        { profileId: "demo-jordan", name: "Jordan", pages: 18, finished: true, mine: false },
        { profileId: me.id, name: me.name, pages: 12, finished: true, mine: true },
        { profileId: "demo-priya", name: "Priya", pages: 11, finished: true, mine: false },
      ],
    };
  }
  if (seeded) demoSprints.set(key, seeded);
  return seeded;
}

/** The demo's pages for a sprint, saved in memory when it ends. */
export function saveDemoPages(sprintId: string, profileId: string, pages: number) {
  for (const demo of demoSprints.values()) {
    if (demo.sprint.id === sprintId) demo.readers = demo.readers.map((r) => (r.profileId === profileId ? { ...r, pages, finished: true } : r));
  }
}

export function useReadingSprint(scope: SprintScope) {
  const { state } = useStore();
  const profile = useActiveProfile();
  const accountId = state.account?.userId ?? null;
  const remote = Boolean(accountId);
  const key = scopeKey(scope);
  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
  });
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [readers, setReaders] = useState<SprintReader[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const count = useSprintCount();

  const reload = useCallback(async () => {
    try {
      if (!remote || !accountId) {
        const demo = demoSprints.get(key) ?? seedDemoSprint(key, state.profiles, profile ?? undefined);
        setSprint(demo?.sprint ?? null);
        setReaders(demo ? [...demo.readers] : []);
      } else {
        const latest = await sprintsApi.loadLatestSprint(scopeRef.current, accountId);
        setSprint(latest);
        setReaders(latest ? await sprintsApi.loadSprintReaders(latest.id) : []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }, [remote, accountId, key, state.profiles, profile]);

  useEffect(() => {
    void reload();
    if (!remote || !accountId) return;
    return sprintsApi.watchSprints(scopeRef.current, accountId, () => void reload());
  }, [reload, remote, accountId]);

  const running = isRunning(sprint, now);
  // The timer: a tick a second while a sprint runs.
  useEffect(() => {
    if (!sprint || Date.now() >= sprint.endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sprint]);

  const joined = Boolean(sprint && profile && readers.some((r) => r.mine && r.profileId === profile.id));

  // Keep counting pages on this device for the profile while it's in the running sprint.
  useEffect(() => {
    if (sprint && profile && joined && Date.now() < sprint.endsAt) joinCount(sprint.id, profile.id, sprint.endsAt);
  }, [sprint, profile, joined]);

  // When this device's count is saved (lib/useSprintSaver.ts), show everyone's pages.
  const hadCount = useRef(false);
  useEffect(() => {
    if (count && sprint && count.sprintId === sprint.id) hadCount.current = true;
    else if (!count && hadCount.current) {
      hadCount.current = false;
      void reload();
    }
  }, [count, sprint, reload]);
  // Others' pages arrive by Realtime for members; the demo looks again when the timer ends.
  useEffect(() => {
    if (!sprint || remote) return;
    const wait = sprint.endsAt - Date.now();
    if (wait <= 0) return;
    const timer = window.setTimeout(() => void reload(), wait + 1500);
    return () => window.clearTimeout(timer);
  }, [sprint, remote, reload]);

  const start = useCallback(
    async (minutes: number) => {
      if (!profile) return;
      setBusy(true);
      setError(null);
      try {
        if (!remote) {
          const startsAt = Date.now();
          const fresh: Sprint = { id: `demo-sprint-${startsAt}`, clubId: scope.kind === "club" ? scope.clubId : null, minutes, startsAt, endsAt: startsAt + minutes * 60_000 };
          demoSprints.set(key, { sprint: fresh, readers: [{ profileId: profile.id, name: profile.name, pages: null, finished: false, mine: true }] });
        } else {
          await sprintsApi.startSprint(scope, profile.id, minutes);
        }
        setNow(Date.now());
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [profile, remote, scope, key, reload],
  );

  const join = useCallback(async () => {
    if (!profile || !sprint) return;
    setBusy(true);
    setError(null);
    try {
      if (!remote) {
        const demo = demoSprints.get(key);
        if (demo && !demo.readers.some((r) => r.profileId === profile.id)) {
          demo.readers = [...demo.readers, { profileId: profile.id, name: profile.name, pages: null, finished: false, mine: true }];
        }
      } else {
        await sprintsApi.joinSprint(sprint.id, profile.id);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [profile, sprint, remote, key, reload]);

  return { sprint, readers, loaded, error, busy, now, running, joined, myPages: count && sprint && count.sprintId === sprint.id ? count.pages : null, start, join };
}
