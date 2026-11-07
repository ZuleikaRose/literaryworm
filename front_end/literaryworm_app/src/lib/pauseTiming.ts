/**
 * Timing a natural voice's part by its pauses. Google's Chirp 3 HD voices don't report when each
 * word is spoken, but a part is whole sentences and the voice pauses between them, so the quiet
 * stretches in the audio show where each sentence starts. The player matches each sentence break
 * to the pause nearest where it would fall by characters, and times the read-along from those
 * anchors instead of spreading the part's length evenly over its characters.
 */

/** A stretch of quiet: [start, end] in seconds. */
export type Pause = [number, number];

/** [character offset in the part, seconds into the part], in order. */
export type Anchor = [number, number];

/** Quiet stretches of at least `minSeconds`, from samples (any channel), by 20 ms windows. */
export function findPauses(samples: Float32Array, sampleRate: number, minSeconds = 0.18, threshold = 0.012): Pause[] {
  const window = Math.max(1, Math.round(sampleRate * 0.02));
  const pauses: Pause[] = [];
  let quietFrom: number | null = null;
  for (let i = 0; i < samples.length; i += window) {
    let sum = 0;
    const end = Math.min(samples.length, i + window);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    const quiet = Math.sqrt(sum / (end - i)) < threshold;
    const at = i / sampleRate;
    if (quiet && quietFrom === null) quietFrom = at;
    if (!quiet && quietFrom !== null) {
      if (at - quietFrom >= minSeconds) pauses.push([quietFrom, at]);
      quietFrom = null;
    }
  }
  return pauses;
}

/**
 * Anchors for a part `length` characters long and `duration` seconds long: its start and end, and
 * each sentence start (`breaks`, character offsets after 0) at the end of the pause nearest where it
 * would fall by characters, if one is close enough. Pauses are used in order, each at most once.
 */
export function pauseAnchors(breaks: number[], length: number, duration: number, pauses: Pause[]): Anchor[] {
  const anchors: Anchor[] = [[0, 0]];
  const tolerance = Math.max(1.5, duration * 0.12);
  let from = 0;
  for (const offset of breaks) {
    if (offset <= 0 || offset >= length) continue;
    const expected = (offset / length) * duration;
    let best = -1;
    for (let i = from; i < pauses.length; i++) {
      const middle = (pauses[i][0] + pauses[i][1]) / 2;
      if (middle > expected + tolerance) break;
      if (Math.abs(middle - expected) <= tolerance && (best < 0 || Math.abs(middle - expected) < Math.abs((pauses[best][0] + pauses[best][1]) / 2 - expected))) best = i;
    }
    if (best < 0) continue;
    const at = pauses[best][1];
    if (at <= anchors[anchors.length - 1][1] || at >= duration) continue;
    anchors.push([offset, at]);
    from = best + 1;
  }
  anchors.push([length, duration]);
  return anchors;
}

/** Characters into the part at `seconds`, between the anchors around it. */
export function charactersAt(anchors: Anchor[], seconds: number): number {
  for (let i = 1; i < anchors.length; i++) {
    const [c0, t0] = anchors[i - 1];
    const [c1, t1] = anchors[i];
    if (seconds <= t1) return t1 > t0 ? c0 + ((Math.max(seconds, t0) - t0) / (t1 - t0)) * (c1 - c0) : c0;
  }
  return anchors[anchors.length - 1][0];
}

/** Seconds into the part at `characters` (for going to a place). */
export function secondsAt(anchors: Anchor[], characters: number): number {
  for (let i = 1; i < anchors.length; i++) {
    const [c0, t0] = anchors[i - 1];
    const [c1, t1] = anchors[i];
    if (characters <= c1) return c1 > c0 ? t0 + ((Math.max(characters, c0) - c0) / (c1 - c0)) * (t1 - t0) : t0;
  }
  return anchors[anchors.length - 1][1];
}
