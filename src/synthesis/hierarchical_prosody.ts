/**
 * Syllable-Level Metrical Phonology & ToBI Pitch Contour Scheduler (Bio-NAVB v2)
 *
 * Implements:
 * 1. Syllable-level metrical phonology duration modification:
 *    Selectively stretches or clips vocalic nuclei without distorting consonant anatomy.
 *    - passive_hostility: -25% vocalic clipping (staccato clipped vowels, crisp consonants)
 *    - sarcasm: +45% elongation on tonic accented vowel
 *    - curiosity: +25% phrase-final elongation
 *    - exasperation: +30% initial nucleus, heavy final decay
 * 2. Continuous C1-smooth ToBI pitch contours (L-H%, L-L%, !H*, H*L-).
 */

import type { Gesture } from "../ffi/types.ts";
import type { SubtextState } from "./subtext_engine.ts";

export const VOWEL_PHONEMES = new Set([
  "a", "e", "i", "o", "u",
  "æ", "ɑ", "ɒ", "ɔ", "ɛ", "ɜ", "ɪ", "ʊ", "ʌ", "ə",
  "aɪ", "aʊ", "ɔɪ", "eɪ", "oʊ",
  "ɨ", "ʉ", "ʏ", "ø", "œ", "ɤ", "ɯ",
  "aa", "ae", "ah", "ao", "aw", "ay", "eh", "er", "ey", "ih", "iy", "ow", "oy", "uh", "uw"
]);

export function isVowel(phoneme: string = ""): boolean {
  const clean = phoneme.toLowerCase().replace(/[^a-zæɑɒɔɛɜɪʊʌəɨʉʏøœɤɯ]/g, "");
  return VOWEL_PHONEMES.has(clean) || clean.startsWith("vowel");
}

export type TobiToneType = "L-H%" | "L-L%" | "!H*" | "H*L-";

export interface PitchTargetPoint {
  timeRatio: number; // 0.0 to 1.0
  f0Ratio: number;    // Multiplier relative to base f0
}

/**
 * Standard ToBI boundary target definitions.
 */
export const TOBI_PROFILES: Record<TobiToneType, PitchTargetPoint[]> = {
  // Question / Inquisitive / Curiosity: Terminal boundary rise
  "L-H%": [
    { timeRatio: 0.0, f0Ratio: 1.00 },
    { timeRatio: 0.35, f0Ratio: 0.96 },
    { timeRatio: 0.70, f0Ratio: 1.14 },
    { timeRatio: 1.00, f0Ratio: 1.42 },
  ],
  // Finality / Quiet Dejection: Low falling boundary
  "L-L%": [
    { timeRatio: 0.0, f0Ratio: 1.04 },
    { timeRatio: 0.30, f0Ratio: 0.98 },
    { timeRatio: 0.70, f0Ratio: 0.88 },
    { timeRatio: 1.00, f0Ratio: 0.75 },
  ],
  // Sarcasm / Downstepped high accent (!H*): Circumflex rise-fall on tonic then low flat
  "!H*": [
    { timeRatio: 0.0, f0Ratio: 0.96 },
    { timeRatio: 0.32, f0Ratio: 1.28 },
    { timeRatio: 0.60, f0Ratio: 0.92 },
    { timeRatio: 1.00, f0Ratio: 0.86 },
  ],
  // Standard declarative statement (H*L-)
  "H*L-": [
    { timeRatio: 0.0, f0Ratio: 1.00 },
    { timeRatio: 0.28, f0Ratio: 1.18 },
    { timeRatio: 0.70, f0Ratio: 0.94 },
    { timeRatio: 1.00, f0Ratio: 0.86 },
  ],
};

/**
 * Evaluates continuous C1-smooth pitch curve using cubic Hermite interpolation between ToBI anchor points.
 */
export function evaluateTobiPitch(
  normT: number,
  tone: TobiToneType,
  baseF0: number,
  intensity: number = 1.0
): number {
  const points = TOBI_PROFILES[tone];
  const t = Math.max(0.0, Math.min(1.0, normT));

  // Find surrounding anchor points
  let idx = 0;
  while (idx < points.length - 2 && points[idx + 1].timeRatio < t) {
    idx++;
  }

  const p0 = points[Math.max(0, idx - 1)];
  const p1 = points[idx];
  const p2 = points[idx + 1];
  const p3 = points[Math.min(points.length - 1, idx + 2)];

  const span = Math.max(1e-5, p2.timeRatio - p1.timeRatio);
  const u = (t - p1.timeRatio) / span;

  // Tangents using central differences (Catmull-Rom)
  const m1 = (p2.f0Ratio - p0.f0Ratio) / (p2.timeRatio - p0.timeRatio || 1);
  const m2 = (p3.f0Ratio - p1.f0Ratio) / (p3.timeRatio - p1.timeRatio || 1);

  // Hermite basis functions
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;

  const rawRatio = h00 * p1.f0Ratio + h10 * span * m1 + h01 * p2.f0Ratio + h11 * span * m2;
  const scaledRatio = 1.0 + (rawRatio - 1.0) * intensity;

  return baseF0 * scaledRatio;
}

/**
 * Reschedule an array of gestural records with metrical phonology duration scaling.
 * Modifies vocalic nuclei durations according to subtext without distorting consonants
 * and preserving 100% concurrency across parallel articulatory tiers via monotonic time warping.
 */
export function scheduleMetricalGestures(
  gestures: Gesture[],
  subtext?: SubtextState,
  intensity: number = 0.7
): { gestures: Gesture[]; newDuration: number } {
  if (!subtext || intensity <= 0.0 || gestures.length === 0) {
    const end = gestures.reduce((max, g) => Math.max(max, g.t1), 0);
    return { gestures, newDuration: end };
  }

  // 1. Identify distinct vocalic intervals in the utterance timeline
  const rawVowels: Array<{ t0: number; t1: number }> = [];
  for (const g of gestures) {
    if (g.label && isVowel(g.label)) {
      rawVowels.push({ t0: g.t0, t1: g.t1 });
    }
  }

  if (rawVowels.length === 0) {
    const end = gestures.reduce((max, g) => Math.max(max, g.t1), 0);
    return { gestures, newDuration: end };
  }

  rawVowels.sort((a, b) => a.t0 - b.t0);

  // Merge contiguous or overlapping vowel intervals into unified vocalic nuclei
  const vowelIntervals: Array<{ t0: number; t1: number }> = [];
  for (const v of rawVowels) {
    if (vowelIntervals.length === 0) {
      vowelIntervals.push({ t0: v.t0, t1: v.t1 });
    } else {
      const last = vowelIntervals[vowelIntervals.length - 1];
      if (v.t0 <= last.t1 + 0.01) {
        last.t1 = Math.max(last.t1, v.t1);
      } else {
        vowelIntervals.push({ t0: v.t0, t1: v.t1 });
      }
    }
  }

  // Identify tonic vowel nucleus (longest vocalic duration)
  let tonicIdx = 0;
  let maxVowelDur = 0;
  for (let k = 0; k < vowelIntervals.length; k++) {
    const dur = vowelIntervals[k].t1 - vowelIntervals[k].t0;
    if (dur > maxVowelDur) {
      maxVowelDur = dur;
      tonicIdx = k;
    }
  }

  const finalIdx = vowelIntervals.length - 1;

  // 2. Assign metrical duration scale factor per vocalic nucleus
  const scales: number[] = vowelIntervals.map((v, k) => {
    const isTonic = k === tonicIdx;
    const isFinal = k === finalIdx;

    switch (subtext) {
      case "passive_hostility":
        // -25% vocalic clipping for curt staccato delivery
        return 1.0 - 0.25 * intensity;
      case "sarcasm":
        // +45% elongation on tonic vowel drawl
        return isTonic ? (1.0 + 0.45 * intensity) : (1.0 - 0.05 * intensity);
      case "curiosity":
        // +25% final elongation
        return isFinal ? (1.0 + 0.25 * intensity) : 1.0;
      case "exasperation":
        if (k === 0) return 1.0 + 0.30 * intensity;
        if (isFinal) return 1.0 - 0.20 * intensity;
        return 1.0;
      case "anxiety":
        return 1.0 - 0.15 * intensity;
      case "quiet_dejection":
        return 1.0 + 0.15 * intensity;
      case "annoyance":
        return 1.0 - 0.10 * intensity;
    }
  });

  // 3. Construct piecewise linear monotonic time-warp mapping tau(t)
  // Breakpoints: [(origT, newT)]
  const points: Array<{ origT: number; newT: number }> = [{ origT: 0.0, newT: 0.0 }];
  let currentOrig = 0.0;
  let currentNew = 0.0;

  for (let k = 0; k < vowelIntervals.length; k++) {
    const v = vowelIntervals[k];
    const s = scales[k];

    // Consonantal region before vowel (rate 1.0)
    if (v.t0 > currentOrig) {
      const dt = v.t0 - currentOrig;
      currentOrig = v.t0;
      currentNew += dt;
      points.push({ origT: currentOrig, newT: currentNew });
    }

    // Vocalic region (rate s)
    const vDur = Math.max(0.005, v.t1 - v.t0);
    currentOrig = v.t1;
    currentNew += vDur * s;
    points.push({ origT: currentOrig, newT: currentNew });
  }

  function tau(t: number): number {
    if (t <= points[0].origT) return t;
    const last = points[points.length - 1];
    if (t >= last.origT) {
      return last.newT + (t - last.origT);
    }
    // Find surrounding segment
    let i = 0;
    while (i < points.length - 1 && points[i + 1].origT < t) {
      i++;
    }
    const p1 = points[i];
    const p2 = points[i + 1];
    const ratio = (t - p1.origT) / (p2.origT - p1.origT || 1e-6);
    return p1.newT + ratio * (p2.newT - p1.newT);
  }

  // 4. Map gestures through tau(t) preserving concurrency across parallel tiers
  const newGestures: Gesture[] = [];
  let maxNewEnd = 0.0;

  for (const orig of gestures) {
    const newT0 = tau(orig.t0);
    const newT1 = tau(orig.t1);
    const origDur = Math.max(1e-4, orig.t1 - orig.t0);
    const newDur = Math.max(1e-4, newT1 - newT0);
    const ratio = newDur / origDur;

    newGestures.push({
      ...orig,
      t0: newT0,
      t1: newT1,
      rampIn: Math.min(newDur * 0.45, (orig.rampIn || 0.02) * ratio),
      rampOut: Math.min(newDur * 0.45, (orig.rampOut || 0.02) * ratio),
    });

    if (newT1 > maxNewEnd) {
      maxNewEnd = newT1;
    }
  }

  return { gestures: newGestures, newDuration: maxNewEnd };
}
