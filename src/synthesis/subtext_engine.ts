/**
 * Involuntary Limbic-PAG Motor Pathway Subtext Engine (Bio-NAVB v2)
 *
 * Implements the involuntary limbic-periaqueductal gray (PAG) motor pathway
 * for 7 nuanced psychological human vocal states:
 * - annoyance
 * - curiosity
 * - exasperation
 * - passive_hostility
 * - anxiety
 * - sarcasm
 * - quiet_dejection
 *
 * Computes dynamic, continuous biophysical trajectories for:
 * 1. Gunnar Fant Rd(t) glottal shape factor (0.35 - 2.80)
 * 2. Subglottal driving pressure Ps(t) and respiratory decay
 * 3. Articulatory offsets (Δjaw, vertical larynx offset ΔL)
 * 4. Synchronous phase-coupled 8-10 Hz neuromuscular tremor in Ps and f0
 * 5. Pre-plosive micro-glottal stops for tense/hostile states
 */

import { evaluateTobiPitch } from "./hierarchical_prosody.ts";

export type SubtextState =
  | "annoyance"
  | "curiosity"
  | "exasperation"
  | "passive_hostility"
  | "anxiety"
  | "sarcasm"
  | "quiet_dejection";

export interface SubtextBiophysicalTrajectory {
  state: SubtextState;
  intensity: number; // 0.0 - 1.0
  duration: number;  // total duration in seconds

  // Evaluation functions at instantaneous time t (0 <= t <= duration)
  getRd: (t: number) => number;
  getPs: (t: number) => number;
  getDeltaJaw: (t: number) => number;
  getDeltaLarynx: (t: number) => number;
  getTremorF0Factor: (t: number) => number;
  getTremorPsFactor: (t: number) => number;
  getVowelDurationScale: (isTonic: boolean, isFinal: boolean) => number;
  getMicroGlottalStopGain: (t: number) => number;
  getPitchContourScale: (normT: number) => number;
}

export interface PhonemeTiming {
  phoneme: string;
  t0: number;
  t1: number;
  isVowel: boolean;
  isVoicelessPlosive: boolean;
  isTonic?: boolean;
  isFinal?: boolean;
}

const VOICELESS_PLOSIVES = new Set(["p", "t", "k", "c", "q"]);

/**
 * Identify voiceless plosives from phoneme string.
 */
export function isVoicelessPlosive(p: string): boolean {
  const clean = p.toLowerCase().replace(/[^a-z]/g, "");
  return VOICELESS_PLOSIVES.has(clean);
}

/**
 * Generate complete dynamic biophysical trajectory for a given subtext state and intensity.
 */
export function generateSubtextTrajectory(
  state: SubtextState,
  intensity: number = 0.7,
  totalDuration: number = 1.0,
  phonemeTimings: PhonemeTiming[] = []
): SubtextBiophysicalTrajectory {
  const i = Math.max(0.0, Math.min(1.0, intensity));
  const dur = Math.max(0.05, totalDuration);

  // Tremor parameters (unified phase-coupled neuromuscular oscillator)
  const tremorFreq = 8.5; // 8.5 Hz central clonus frequency
  const tremorPhaseOffset = 0.35; // ~20 degrees physiological phase shift between pressure and vocal fold tension

  // Detect pre-plosive stop intervals (15 - 30 ms prior to voiceless plosive onset)
  const microStopIntervals: Array<{ start: number; end: number }> = [];
  if (state === "passive_hostility" || state === "annoyance") {
    const stopLead = (0.018 + 0.012 * i);
    for (const pt of phonemeTimings) {
      if (pt.isVoicelessPlosive && pt.t0 > 0.04) {
        microStopIntervals.push({
          start: Math.max(0, pt.t0 - stopLead),
          end: pt.t0,
        });
      }
    }
  }

  switch (state) {
    case "passive_hostility": {
      // Hyperadducted glottis (Rd ≈ 0.44), clenched jaw (Δjaw ≈ -0.28), elevated larynx (ΔL ≈ +0.22)
      // Held rigid pressure without normal respiratory decay, clipped vowels (-25%)
      const baseRd = 1.0 - 0.56 * i; // Rd ~ 0.44 at i=1.0
      const basePs = 8.0 + 5.5 * i;  // Ps ~ 13.5 cmH2O
      const deltaJaw = -0.28 * i;
      const deltaLarynx = 0.22 * i;

      return {
        state,
        intensity: i,
        duration: dur,
        getRd: (t: number) => baseRd + 0.05 * Math.sin(2.0 * Math.PI * 0.8 * (t / dur)),
        getPs: (t: number) => {
          // Rigidly maintained pressure with minimal respiratory decay
          const normT = Math.min(1.0, t / dur);
          return basePs * (1.0 - 0.04 * normT);
        },
        getDeltaJaw: () => deltaJaw,
        getDeltaLarynx: () => deltaLarynx,
        getTremorF0Factor: () => 1.0,
        getTremorPsFactor: () => 1.0,
        getVowelDurationScale: (isTonic: boolean) => 1.0 - 0.25 * i,
        getMicroGlottalStopGain: (t: number) => {
          for (const iv of microStopIntervals) {
            if (t >= iv.start && t <= iv.end) {
              const rel = (t - iv.start) / (iv.end - iv.start);
              // Smooth C1 raised-cosine closure into pre-plosive stop without click
              return 0.5 * (1.0 + Math.cos(Math.PI * rel));
            }
          }
          return 1.0;
        },
        getPitchContourScale: (normT: number) => {
          // Compressed flat, suppressed pitch range with subtle boundary drop
          return 1.0 - 0.05 * i * normT;
        },
      };
    }

    case "annoyance": {
      // Mildly pressed (Rd ≈ 0.65), short rapid pressure bursts, slight jaw clamp, elevated larynx
      const baseRd = 1.0 - 0.35 * i; // Rd ~ 0.65
      const basePs = 8.0 + 3.5 * i;  // Ps ~ 11.5 cmH2O
      const deltaJaw = -0.15 * i;
      const deltaLarynx = 0.14 * i;

      return {
        state,
        intensity: i,
        duration: dur,
        getRd: () => baseRd,
        getPs: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          return basePs * (1.0 - 0.12 * normT);
        },
        getDeltaJaw: () => deltaJaw,
        getDeltaLarynx: () => deltaLarynx,
        getTremorF0Factor: (t: number) => 1.0 + 0.015 * i * Math.sin(2.0 * Math.PI * tremorFreq * t + tremorPhaseOffset),
        getTremorPsFactor: (t: number) => 1.0 + 0.050 * i * Math.sin(2.0 * Math.PI * tremorFreq * t),
        getVowelDurationScale: () => 1.0 - 0.12 * i,
        getMicroGlottalStopGain: (t: number) => {
          for (const iv of microStopIntervals) {
            if (t >= iv.start && t <= iv.end) {
              const rel = (t - iv.start) / (iv.end - iv.start);
              return 0.5 * (1.0 + Math.cos(Math.PI * rel));
            }
          }
          return 1.0;
        },
        getPitchContourScale: (normT: number) => 1.0 + 0.06 * i * Math.sin(Math.PI * normT),
      };
    }

    case "anxiety": {
      // Sympathetic hyper-arousal: Rd ≈ 0.58, elevated larynx (ΔL ≈ +0.35),
      // Synchronous phase-coupled 8.5 Hz neuromuscular tremor in Ps and f0
      const baseRd = 1.0 - 0.42 * i; // Rd ~ 0.58
      const basePs = 8.0 + 3.0 * i;  // Ps ~ 11.0 cmH2O
      const deltaJaw = -0.12 * i;
      const deltaLarynx = 0.35 * i;

      return {
        state,
        intensity: i,
        duration: dur,
        getRd: (t: number) => baseRd + 0.08 * i * Math.sin(2.0 * Math.PI * tremorFreq * t),
        getPs: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          return basePs * (1.0 - 0.15 * normT);
        },
        getDeltaJaw: () => deltaJaw,
        getDeltaLarynx: () => deltaLarynx,
        getTremorF0Factor: (t: number) => {
          // Synchronous phase-coupled pitch tremor (excursion ~4.0% at i=1.0)
          return 1.0 + 0.040 * i * Math.sin(2.0 * Math.PI * tremorFreq * t + tremorPhaseOffset);
        },
        getTremorPsFactor: (t: number) => {
          // Synchronous phase-coupled pressure tremor (excursion ~12% at i=1.0)
          return 1.0 + 0.120 * i * Math.sin(2.0 * Math.PI * tremorFreq * t);
        },
        getVowelDurationScale: () => 1.0 - 0.14 * i,
        getMicroGlottalStopGain: () => 1.0,
        getPitchContourScale: (normT: number) => 1.0 + 0.08 * i * (1.0 - normT),
      };
    }

    case "exasperation": {
      // Expiratory sigh dump: Ps drops steeply (-60%), Rd increases from 0.75 to 2.20 (heavy sigh breathiness)
      // Larynx drops from +0.1 to -0.25
      return {
        state,
        intensity: i,
        duration: dur,
        getRd: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          const startRd = 0.75;
          const endRd = 1.0 + 1.25 * i; // Rd ~ 2.25 at end
          return startRd + (endRd - startRd) * Math.pow(normT, 1.4);
        },
        getPs: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          const startPs = 8.0 + 5.0 * i; // Starts high (13.0)
          const dropFactor = 1.0 - 0.60 * i * Math.pow(normT, 1.2);
          return Math.max(2.5, startPs * dropFactor);
        },
        getDeltaJaw: () => -0.05 * i,
        getDeltaLarynx: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          return (0.10 - 0.35 * normT) * i;
        },
        getTremorF0Factor: () => 1.0,
        getTremorPsFactor: () => 1.0,
        getVowelDurationScale: (isTonic: boolean, isFinal: boolean) => {
          if (isFinal) return 1.0 - 0.20 * i; // Breath cuts short final vowel
          return 1.0 + 0.30 * i;              // First vowels elongated with exasperated emphasis
        },
        getMicroGlottalStopGain: () => 1.0,
        getPitchContourScale: (normT: number) => {
          // Sharp downward pitch drop over phrase (H*L-)
          return evaluateTobiPitch(normT, "H*L-", 1.0, i);
        },
      };
    }

    case "sarcasm": {
      // Prolonged tonic vowel (+45%), circumflex pitch rise-fall or !H* downstep,
      // creaky vocal fry / Rd ≈ 1.35, lowered larynx (ΔL ≈ -0.15)
      const baseRd = 1.0 + 0.38 * i;
      const basePs = 8.0 - 0.5 * i;
      const deltaJaw = 0.05 * i;
      const deltaLarynx = -0.15 * i;

      return {
        state,
        intensity: i,
        duration: dur,
        getRd: (t: number) => {
          // Localized creak in middle of phrase
          const normT = Math.min(1.0, t / dur);
          const center = Math.exp(-Math.pow((normT - 0.5) / 0.25, 2));
          return baseRd + 0.35 * i * center;
        },
        getPs: () => basePs,
        getDeltaJaw: () => deltaJaw,
        getDeltaLarynx: () => deltaLarynx,
        getTremorF0Factor: () => 1.0,
        getTremorPsFactor: () => 1.0,
        getVowelDurationScale: (isTonic: boolean) => {
          if (isTonic) return 1.0 + 0.45 * i; // +45% elongation on tonic syllable
          return 1.0 - 0.05 * i;
        },
        getMicroGlottalStopGain: () => 1.0,
        getPitchContourScale: (normT: number) => {
          // Circumflex rise-fall (!H* downstep)
          return evaluateTobiPitch(normT, "!H*", 1.0, i);
        },
      };
    }

    case "curiosity": {
      // Inquisitive epistemic search: upward terminal rise (L-H%), open relaxed jaw,
      // supple glottis (Rd ≈ 0.95), final syllable elongation (+25%), larynx rising at tail
      const baseRd = 1.0 - 0.05 * i;
      const basePs = 8.0 + 0.6 * i;
      const deltaJaw = 0.12 * i;

      return {
        state,
        intensity: i,
        duration: dur,
        getRd: () => baseRd,
        getPs: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          // Sustained pressure maintaining phonation through final rise
          return basePs * (1.0 + 0.10 * i * Math.pow(normT, 2.0));
        },
        getDeltaJaw: () => deltaJaw,
        getDeltaLarynx: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          // Larynx ascends alongside pitch rise at terminal tail
          return 0.32 * i * Math.pow(normT, 2.5);
        },
        getTremorF0Factor: () => 1.0,
        getTremorPsFactor: () => 1.0,
        getVowelDurationScale: (_isTonic: boolean, isFinal: boolean) => {
          if (isFinal) return 1.0 + 0.25 * i; // +25% final elongation
          return 1.0;
        },
        getMicroGlottalStopGain: () => 1.0,
        getPitchContourScale: (normT: number) => {
          // L-H% boundary tone terminal excursion
          return evaluateTobiPitch(normT, "L-H%", 1.0, i);
        },
      };
    }

    case "quiet_dejection": {
      // Parasympathetic collapse: low Ps (~3.5 cmH2O), lax hypoadducted glottis (Rd ≈ 2.30),
      // depressed larynx (ΔL ≈ -0.28), trailing low fall (L-L%)
      const baseRd = 1.0 + 1.30 * i; // Rd ~ 2.30
      const basePs = 8.0 - 4.5 * i;  // Ps ~ 3.5 cmH2O
      const deltaJaw = 0.14 * i;
      const deltaLarynx = -0.28 * i;

      return {
        state,
        intensity: i,
        duration: dur,
        getRd: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          return baseRd + 0.25 * i * normT;
        },
        getPs: (t: number) => {
          const normT = Math.min(1.0, t / dur);
          return Math.max(1.8, basePs * (1.0 - 0.25 * normT));
        },
        getDeltaJaw: () => deltaJaw,
        getDeltaLarynx: () => deltaLarynx,
        getTremorF0Factor: () => 1.0,
        getTremorPsFactor: () => 1.0,
        getVowelDurationScale: () => 1.0 + 0.15 * i, // Slack, lax elongation
        getMicroGlottalStopGain: () => 1.0,
        getPitchContourScale: (normT: number) => {
          // Continuous declining L-L% intonation
          return evaluateTobiPitch(normT, "L-L%", 1.0, i);
        },
      };
    }
  }
}
