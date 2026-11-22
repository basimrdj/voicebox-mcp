/**
 * Bio-NAVB v2 (Biophysical Neural-Acoustic Voice Box)
 * Human-Grade Acoustic Synthesis Engine & DDSP Resonator Bank.
 * Converts 29 biophysical parameters (17 articulators + 12 laryngeal sources)
 * into organic, smooth, crystal-clear human speech with zero comb-filter kazoo buzz.
 */

import { type Gesture, type VoiceSource } from "../ffi/types.ts";
import {
  solveLfFromRd,
  evaluateLfFlowDerivative,
  InteractiveGlottalFlow,
} from "./glottal_flow.ts";
import {
  generateSubtextTrajectory,
  type SubtextState,
  type PhonemeTiming,
  isVoicelessPlosive,
} from "./subtext_engine.ts";
import {
  scheduleMetricalGestures,
  isVowel,
} from "./hierarchical_prosody.ts";

export type EmotionType =
  | "neutral"
  | "sadness"
  | "hot_anger"
  | "cold_anger"
  | "frustration"
  | "tenderness";

export interface SynthesizeOptions {
  emotion?: EmotionType;
  subtext?: SubtextState;
  subtextIntensity?: number;
  singing?: boolean;
  continuous?: boolean;
}

export interface ArticulatorState {
  jaw: number;
  tbX: number;
  tbY: number;
  ttX: number;
  ttY: number;
  ttCurl: number;
  root: number;
  lipAp: number;
  lipProt: number;
  lipWidth: number;
  labiodental: number;
  velum: number;
  larynx: number;
  epilarynx: number;
  ventricular: number;
  lateral: number;
  dorsum: number;
}

export const DEFAULT_ARTICULATORS: ArticulatorState = {
  jaw: 0.0,
  tbX: 0.0,
  tbY: 0.0,
  ttX: 0.0,
  ttY: 0.0,
  ttCurl: 0.0,
  root: 0.0,
  lipAp: 0.0,
  lipProt: 0.0,
  lipWidth: 0.0,
  labiodental: 0.0,
  velum: 0.0,
  larynx: 0.0,
  epilarynx: 0.0,
  ventricular: 0.0,
  lateral: 0.0,
  dorsum: 0.0,
};

export const NEUTRAL_PHYSICAL_ARTICULATORS: ArticulatorState = {
  jaw: 0.6,
  tbX: 2.9,
  tbY: 6.85,
  ttX: 6.45,
  ttY: 7.3,
  ttCurl: 0.0,
  root: 0.0,
  lipAp: 0.7,
  lipProt: 0.2,
  lipWidth: 0.5,
  labiodental: 0.0,
  velum: -0.15,
  larynx: 0.0,
  epilarynx: 0.0,
  ventricular: 0.0,
  lateral: 0.0,
  dorsum: 0.0,
};

export const DEFAULT_LARYNGEAL: VoiceSource = {
  f0: 125.0,
  glide: 0.06,
  pressure: 8.0,
  breathiness: 0.12,
  tension: 0.5,
  fry: 0.0,
  roughness: 0.08,
  vibratoDepth: 0.0,
  vibratoRate: 5.8,
  drift: 3.0,
  voiced: true,
  brightness: 0.35,
};

/**
 * Acoustically calibrated formant targets for English IPA phonemes (Male baseline, Fant 1960).
 */
export const IPA_ACOUSTIC_PROFILES: Record<string, {
  formants: [number, number, number, number, number];
  bandwidths: [number, number, number, number, number];
  voiced: boolean;
  fricationFreq?: number;
  fricationGain?: number;
  burstFreq?: number;
  burstGain?: number;
  nasal?: boolean;
}> = {
  // --- Vowels ---
  "i": { formants: [280, 2280, 2950, 3600, 4500], bandwidths: [50, 90, 130, 200, 280], voiced: true },
  "ɪ": { formants: [390, 1990, 2550, 3550, 4500], bandwidths: [60, 95, 140, 200, 280], voiced: true },
  "e": { formants: [450, 2050, 2600, 3600, 4500], bandwidths: [65, 100, 140, 210, 280], voiced: true },
  "eɪ":{ formants: [450, 2050, 2600, 3600, 4500], bandwidths: [65, 100, 140, 210, 280], voiced: true },
  "ɛ": { formants: [530, 1840, 2480, 3550, 4500], bandwidths: [70, 100, 150, 210, 280], voiced: true },
  "æ": { formants: [660, 1720, 2410, 3500, 4500], bandwidths: [80, 110, 160, 220, 290], voiced: true },
  "a": { formants: [730, 1450, 2450, 3500, 4500], bandwidths: [85, 115, 160, 220, 290], voiced: true },
  "ɑ": { formants: [730, 1090, 2440, 3500, 4500], bandwidths: [85, 110, 160, 220, 290], voiced: true },
  "ɒ": { formants: [680, 1000, 2400, 3500, 4500], bandwidths: [80, 105, 160, 220, 290], voiced: true },
  "ɔ": { formants: [570, 840, 2410, 3500, 4500], bandwidths: [75, 100, 150, 220, 290], voiced: true },
  "o": { formants: [480, 950, 2350, 3500, 4500], bandwidths: [70, 95, 145, 210, 290], voiced: true },
  "oʊ":{ formants: [480, 950, 2350, 3500, 4500], bandwidths: [70, 95, 145, 210, 290], voiced: true },
  "ʊ": { formants: [440, 1020, 2240, 3450, 4500], bandwidths: [65, 95, 140, 200, 290], voiced: true },
  "u": { formants: [300, 870, 2240, 3400, 4500], bandwidths: [55, 90, 130, 200, 290], voiced: true },
  "ʌ": { formants: [640, 1190, 2390, 3500, 4500], bandwidths: [75, 105, 150, 210, 290], voiced: true },
  "ə": { formants: [500, 1500, 2500, 3500, 4500], bandwidths: [70, 100, 140, 210, 290], voiced: true },
  "ɜ": { formants: [490, 1350, 1690, 3400, 4500], bandwidths: [70, 100, 140, 210, 290], voiced: true },
  "aɪ":{ formants: [680, 1550, 2500, 3550, 4500], bandwidths: [80, 110, 150, 210, 290], voiced: true },
  "aʊ":{ formants: [680, 1200, 2400, 3500, 4500], bandwidths: [80, 110, 150, 210, 290], voiced: true },
  "ɔɪ":{ formants: [550, 1100, 2450, 3500, 4500], bandwidths: [75, 105, 150, 210, 290], voiced: true },

  // --- Approximants / Liquids / Glides ---
  "w": { formants: [310, 700, 2200, 3400, 4500], bandwidths: [60, 90, 130, 200, 290], voiced: true },
  "j": { formants: [290, 2250, 3000, 3600, 4500], bandwidths: [55, 90, 130, 200, 290], voiced: true },
  "l": { formants: [380, 1150, 2800, 3700, 4500], bandwidths: [70, 110, 150, 220, 300], voiced: true },
  "r": { formants: [420, 1300, 1600, 3400, 4500], bandwidths: [75, 105, 120, 210, 290], voiced: true },
  "ɹ": { formants: [420, 1300, 1600, 3400, 4500], bandwidths: [75, 105, 120, 210, 290], voiced: true },

  // --- Nasals ---
  "m": { formants: [280, 1100, 2400, 3400, 4500], bandwidths: [90, 150, 200, 250, 300], voiced: true, nasal: true },
  "n": { formants: [290, 1500, 2500, 3500, 4500], bandwidths: [90, 150, 200, 250, 300], voiced: true, nasal: true },
  "ŋ": { formants: [280, 2100, 2600, 3500, 4500], bandwidths: [100, 160, 210, 260, 310], voiced: true, nasal: true },

  // --- Fricatives ---
  "s": { formants: [300, 1500, 2600, 3600, 5500], bandwidths: [150, 200, 250, 300, 400], voiced: false, fricationFreq: 5800, fricationGain: 0.45 },
  "z": { formants: [300, 1500, 2600, 3600, 5500], bandwidths: [120, 180, 220, 280, 380], voiced: true, fricationFreq: 5800, fricationGain: 0.30 },
  "ʃ": { formants: [320, 1700, 2600, 3500, 4500], bandwidths: [140, 190, 240, 290, 380], voiced: false, fricationFreq: 3400, fricationGain: 0.50 },
  "ʒ": { formants: [320, 1700, 2600, 3500, 4500], bandwidths: [110, 170, 220, 270, 360], voiced: true, fricationFreq: 3400, fricationGain: 0.32 },
  "f": { formants: [300, 1200, 2400, 3400, 4500], bandwidths: [180, 220, 260, 310, 400], voiced: false, fricationFreq: 4200, fricationGain: 0.30 },
  "v": { formants: [300, 1200, 2400, 3400, 4500], bandwidths: [130, 180, 220, 270, 360], voiced: true, fricationFreq: 4200, fricationGain: 0.22 },
  "θ": { formants: [300, 1400, 2500, 3500, 4500], bandwidths: [180, 220, 260, 310, 400], voiced: false, fricationFreq: 4800, fricationGain: 0.32 },
  "ð": { formants: [300, 1400, 2500, 3500, 4500], bandwidths: [130, 180, 220, 270, 360], voiced: true, fricationFreq: 4800, fricationGain: 0.22 },
  "h": { formants: [500, 1500, 2500, 3500, 4500], bandwidths: [140, 180, 220, 270, 350], voiced: false, fricationFreq: 2400, fricationGain: 0.35 },

  // --- Stops (Affricates / Plosives) ---
  "p": { formants: [300, 900, 2400, 3400, 4500], bandwidths: [150, 180, 220, 270, 350], voiced: false, burstFreq: 800, burstGain: 0.35 },
  "b": { formants: [250, 900, 2400, 3400, 4500], bandwidths: [110, 160, 200, 250, 320], voiced: true, burstFreq: 800, burstGain: 0.22 },
  "t": { formants: [300, 1700, 2600, 3500, 4500], bandwidths: [150, 180, 220, 270, 350], voiced: false, burstFreq: 3800, burstGain: 0.45 },
  "d": { formants: [250, 1700, 2600, 3500, 4500], bandwidths: [110, 160, 200, 250, 320], voiced: true, burstFreq: 3800, burstGain: 0.25 },
  "k": { formants: [300, 1800, 2500, 3500, 4500], bandwidths: [150, 180, 220, 270, 350], voiced: false, burstFreq: 2200, burstGain: 0.40 },
  "g": { formants: [250, 1800, 2500, 3500, 4500], bandwidths: [110, 160, 200, 250, 320], voiced: true, burstFreq: 2200, burstGain: 0.25 },
};

/**
 * 2nd-order IIR Resonator Biquad filter with exact DC unity normalization.
 * H(z) = (1 - a1 - a2) / (1 - a1*z^-1 - a2*z^-2)
 */
export class ResonatorFilter {
  private y1 = 0;
  private y2 = 0;
  private currentA1 = 0;
  private currentA2 = 0;
  private currentGain = 1;

  reset() {
    this.y1 = 0;
    this.y2 = 0;
    this.currentA1 = 0;
    this.currentA2 = 0;
    this.currentGain = 1;
  }

  process(x: number, freq: number, bw: number, sampleRate: number): number {
    const cf = Math.max(50, Math.min(sampleRate * 0.48, freq));
    const cbw = Math.max(20, Math.min(2000, bw));

    const theta = (2 * Math.PI * cf) / sampleRate;
    const r = Math.exp((-Math.PI * cbw) / sampleRate);

    const targetA1 = 2 * r * Math.cos(theta);
    const targetA2 = -r * r;
    // DC unity gain normalization
    const targetGain = 1.0 - targetA1 - targetA2;

    // Smooth parameter interpolation
    this.currentA1 += 0.05 * (targetA1 - this.currentA1);
    this.currentA2 += 0.05 * (targetA2 - this.currentA2);
    this.currentGain += 0.05 * (targetGain - this.currentGain);

    const y = this.currentGain * x + this.currentA1 * this.y1 + this.currentA2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return isNaN(y) ? 0.0 : y;
  }
}

/**
 * Bio-NAVB v2 Synthesizer: Neural Acoustic & DDSP Engine.
 */
export class BioNavbSynthesizer {
  readonly sampleRate: number;
  private resonators: ResonatorFilter[];
  private nasalResonator: ResonatorFilter;
  private fricationBandpass: ResonatorFilter;
  private burstBandpass: ResonatorFilter;
  private glottalFlow: InteractiveGlottalFlow;

  // Glottal cycle states
  private glottalPhase = 0;
  private glottalCycleCount = 0;
  private jitterOffset = 0;
  private shimmerGain = 1.0;
  private prevLipRad = 0;
  private prevHigherPole = 0;
  private randomSeed = 12345;

  // Persistent continuous streaming states across chunk boundaries
  private f0Smoothed = 125.0;
  private f0Velocity = 0.0;
  private lastTargetActiveF0 = 125.0;
  private persistentLungPressure = 8.0;
  private streamTimeOffset = 0.0;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
    this.resonators = [
      new ResonatorFilter(), // F1
      new ResonatorFilter(), // F2
      new ResonatorFilter(), // F3
      new ResonatorFilter(), // F4
      new ResonatorFilter(), // F5
    ];
    this.nasalResonator = new ResonatorFilter();
    this.fricationBandpass = new ResonatorFilter();
    this.burstBandpass = new ResonatorFilter();
    this.glottalFlow = new InteractiveGlottalFlow(sampleRate);
  }

  private nextGaussian(): number {
    this.randomSeed = (this.randomSeed * 1664525 + 1013904223) >>> 0;
    const u1 = (this.randomSeed & 0xffff) / 65536.0;
    this.randomSeed = (this.randomSeed * 1664525 + 1013904223) >>> 0;
    const u2 = (this.randomSeed & 0xffff) / 65536.0;
    return Math.sqrt(-2.0 * Math.log(Math.max(1e-7, u1))) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Evaluates continuous formant frequencies from 17 physical articulators.
   */
  evaluateFormantsFromArticulators(
    artic: ArticulatorState,
    body: { female: number; child: number }
  ): { formants: number[]; bandwidths: number[] } {
    const scale = 1.0 / (1.0 - 0.16 * body.female - 0.32 * body.child);
    const isPhysical =
      (artic.tbY !== undefined && artic.tbY > 2.0) ||
      (artic.tbX !== undefined && artic.tbX > 2.0);

    const dJaw = isPhysical ? ((artic.jaw ?? 0.6) - 0.6) : (artic.jaw ?? 0.0);
    const dTbX = isPhysical ? ((artic.tbX ?? 2.9) - 2.9) / 1.1 : (artic.tbX ?? 0.0);
    const dTbY = isPhysical ? ((artic.tbY ?? 6.85) - 6.85) / 1.1 : (artic.tbY ?? 0.0);
    const dTtX = isPhysical ? ((artic.ttX ?? 6.45) - 6.45) / 1.5 : (artic.ttX ?? 0.0);
    const dTtY = isPhysical ? ((artic.ttY ?? 7.3) - 7.3) / 1.5 : (artic.ttY ?? 0.0);
    const dTtCurl = artic.ttCurl ?? 0.0;
    const dLipAp = isPhysical ? ((artic.lipAp ?? 0.7) - 0.7) : (artic.lipAp ?? 0.0);
    const dLipProt = isPhysical ? ((artic.lipProt ?? 0.2) - 0.2) : (artic.lipProt ?? 0.0);
    const dLarynx = artic.larynx ?? 0.0;
    const dVelum = isPhysical ? ((artic.velum ?? -0.15) - (-0.15)) : (artic.velum ?? 0.0);

    // Baseline neutral tube (Fant 1960)
    let f1 = (505 + 260 * dJaw - 200 * dTbY - 80 * Math.max(0, -dLipAp) + 35 * dLarynx) * scale;
    let f2 = (1510 + 760 * dTbX + 240 * dTbY - 280 * dLipProt - 130 * dJaw) * scale;
    let f3 = (2520 + 400 * dTtY - 450 * dTtCurl - 220 * dLipProt + 160 * dTbX) * scale;
    let f4 = (3530 + 280 * dTtY - 150 * dLipProt + 200 * dLarynx) * scale;
    let f5 = (4550 + 160 * dLarynx) * scale;

    // Lip rounding lowering factor
    const lipFactor = 1.0 - 0.16 * Math.max(0, dLipProt) + 0.06 * Math.max(0, dLipAp);
    f1 *= lipFactor;
    f2 *= lipFactor;
    f3 *= lipFactor;
    f4 *= lipFactor;
    f5 *= lipFactor;

    // Epilaryngeal constriction (Sundberg 1:6 ratio, A_epi/A_pharynx <= 0.16)
    const dEpilarynx = Math.max(0, Math.min(1.0, artic.epilarynx ?? 0.0));
    if (dEpilarynx > 0.05) {
      f3 = (1.0 - 0.75 * dEpilarynx) * f3 + 0.75 * dEpilarynx * 2820 * scale;
      f4 = (1.0 - 0.75 * dEpilarynx) * f4 + 0.75 * dEpilarynx * 3000 * scale;
      f5 = (1.0 - 0.75 * dEpilarynx) * f5 + 0.75 * dEpilarynx * 3200 * scale;
    }

    f1 = Math.max(200, Math.min(1050, f1));
    f2 = Math.max(600, Math.min(2750, f2));
    f3 = Math.max(1400, Math.min(3700, f3));
    f4 = Math.max(2800, Math.min(4500, f4));
    f5 = Math.max(3800, Math.min(5200, f5));

    const bandwidths = [
      60 + 35 * Math.max(0, -dLipAp) + 30 * Math.max(0, dVelum),
      90 + 25 * Math.max(0, dVelum),
      135 + 20 * Math.max(0, dVelum),
      210,
      280,
    ];

    return { formants: [f1, f2, f3, f4, f5], bandwidths };
  }

  public reset(): void {
    for (const r of this.resonators) r.reset();
    this.nasalResonator.reset();
    this.fricationBandpass.reset();
    this.burstBandpass.reset();
    this.glottalFlow.reset();
    this.glottalPhase = 0;
    this.glottalCycleCount = 0;
    this.prevLipRad = 0;
    this.prevHigherPole = 0;
    this.f0Smoothed = 125.0;
    this.f0Velocity = 0.0;
    this.lastTargetActiveF0 = 125.0;
    this.persistentLungPressure = 8.0;
    this.streamTimeOffset = 0.0;
  }

  /**
   * Generates human-grade speech audio from an Articulatory Phonology gestural plan.
   */
  synthesizePlan(
    gestures: Gesture[],
    totalDurationSec: number,
    body: { female: number; child: number } = { female: 0.0, child: 0.0 },
    baseSource: VoiceSource = DEFAULT_LARYNGEAL,
    options?: SynthesizeOptions
  ): Float32Array {
    // 1. Metrical phonology duration scheduling for subtext
    let scheduledGestures = gestures;
    let actualDurationSec = totalDurationSec;

    if (options?.subtext) {
      const scheduled = scheduleMetricalGestures(
        gestures,
        options.subtext,
        options.subtextIntensity ?? 0.7
      );
      scheduledGestures = scheduled.gestures;
      actualDurationSec = Math.max(0.05, scheduled.newDuration + 0.05);
    }

    // 2. Build phoneme timings for pre-plosive micro-glottal stops
    const phonemeTimings: PhonemeTiming[] = scheduledGestures.map((g) => ({
      phoneme: g.label || "",
      t0: g.t0,
      t1: g.t1,
      isVowel: isVowel(g.label || ""),
      isVoicelessPlosive: isVoicelessPlosive(g.label || ""),
    }));

    const subtextTrajectory = options?.subtext
      ? generateSubtextTrajectory(
          options.subtext,
          options.subtextIntensity ?? 0.7,
          actualDurationSec,
          phonemeTimings
        )
      : null;

    const totalFrames = Math.max(1024, Math.ceil(actualDurationSec * this.sampleRate));
    const output = new Float32Array(totalFrames);

    const isContinuous = options?.continuous === true;
    if (!isContinuous) {
      this.reset();
      this.f0Smoothed = baseSource.f0;
      this.lastTargetActiveF0 = baseSource.f0;
      this.persistentLungPressure = baseSource.pressure || 8.0;
      this.streamTimeOffset = 0.0;
    }

    // 2nd-order critically damped filter state on activeF0 (ζ = 1.0, ωn = 25 rad/s)
    const omegaN = 25.0; // rad/s
    const dt = 1.0 / this.sampleRate;

    const controlRate = 250; // Hz
    const samplesPerControl = Math.floor(this.sampleRate / controlRate);

    let currentArtic = { ...DEFAULT_ARTICULATORS };
    let currentSource = { ...baseSource };

    let currentFormants = [500, 1500, 2500, 3500, 4500];
    let currentBandwidths = [70, 100, 140, 220, 300];
    let voicingGain = 1.0;
    let fricationGain = 0.0;
    let fricationFreq = 4000.0;
    let burstGain = 0.0;
    let burstFreq = 3000.0;
    let nasalFactor = 0.0;
    let activeVibrato = baseSource.vibratoDepth || 0.0;
    let targetActiveF0 = this.lastTargetActiveF0;
    let lungPressureNow = this.persistentLungPressure;

    // Unified 8.5 Hz neuromuscular tremor parameters
    const tremorFreq = 8.5;
    const tremorPhase = 0.35;

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      const t = (isContinuous ? this.streamTimeOffset : 0.0) + (frameIdx / this.sampleRate);

      // Update control parameters at control rate
      if (frameIdx % samplesPerControl === 0) {
        let activeFricationGain = 0.0;
        let activeFricationFreq = 4000.0;
        let activeBurstGain = 0.0;
        let activeBurstFreq = 3000.0;
        let activeVoicing = 1.0;
        let isNasal = false;
        let stepF0: number | null = null;
        let activePressure = 0.0;
        let breathGestureActive = false;
        activeVibrato = baseSource.vibratoDepth || 0.0;

        const articSum: Record<keyof ArticulatorState, number> = {
          jaw: 0, tbX: 0, tbY: 0, ttX: 0, ttY: 0, ttCurl: 0, root: 0,
          lipAp: 0, lipProt: 0, lipWidth: 0, labiodental: 0, velum: 0,
          larynx: 0, epilarynx: 0, ventricular: 0, lateral: 0, dorsum: 0,
        };
        const articWeights: Record<keyof ArticulatorState, number> = {
          jaw: 0, tbX: 0, tbY: 0, ttX: 0, ttY: 0, ttCurl: 0, root: 0,
          lipAp: 0, lipProt: 0, lipWidth: 0, labiodental: 0, velum: 0,
          larynx: 0, epilarynx: 0, ventricular: 0, lateral: 0, dorsum: 0,
        };

        let profileFormants: [number, number, number, number, number] | null = null;
        let profileBandwidths: [number, number, number, number, number] | null = null;
        let profileWeight = 0.0;

        for (const g of scheduledGestures) {
          const t0 = g.t0 - (g.rampIn || 0.02);
          const t1 = g.t1 + (g.rampOut || 0.02);
          if (t >= t0 && t <= t1) {
            let act = 1.0;
            if (t < g.t0 && (g.rampIn || 0.02) > 0) {
              act = 0.5 - 0.5 * Math.cos((Math.PI * (t - t0)) / (g.t0 - t0));
            } else if (t > g.t1 && (g.rampOut || 0.02) > 0) {
              act = 0.5 + 0.5 * Math.cos((Math.PI * (t - g.t1)) / (t1 - g.t1));
            }

            const w = act * (g.strength || 1.0);

            if (g.targets && typeof g.targets.breath === "number") {
              breathGestureActive = true;
              activePressure = Math.max(activePressure, g.targets.breath * (baseSource.pressure || 8.0) * act);
            }

            if (g.targets) {
              for (const [k, val] of Object.entries(g.targets)) {
                if (typeof val === "number" && !isNaN(val)) {
                  if (k in articSum) {
                    articSum[k as keyof ArticulatorState] += val * w;
                    articWeights[k as keyof ArticulatorState] += w;
                  } else if (k === "f0") {
                    stepF0 = val;
                  } else if (k === "vibrato") {
                    const depth = val > 1.0 ? Math.min(1.5, val / 50.0) : val;
                    activeVibrato = Math.max(activeVibrato, depth * act);
                  } else if (k === "abduction" && val > 0.4) {
                    activeVoicing = Math.min(activeVoicing, 0.15);
                  }
                }
              }
            }

            if (g.label) {
              const cleanLabel = g.label.trim();
              const profile = IPA_ACOUSTIC_PROFILES[cleanLabel];
              if (profile) {
                if (!profile.voiced) activeVoicing = Math.min(activeVoicing, 0.1);
                if (profile.formants && act > profileWeight) {
                  profileFormants = profile.formants;
                  profileBandwidths = profile.bandwidths;
                  profileWeight = act;
                }
                if (profile.fricationGain) {
                  activeFricationGain = Math.max(activeFricationGain, profile.fricationGain * act);
                  activeFricationFreq = profile.fricationFreq || activeFricationFreq;
                }
                if (profile.burstGain && t >= g.t0 && t <= g.t0 + 0.025) {
                  activeBurstGain = Math.max(activeBurstGain, profile.burstGain * act);
                  activeBurstFreq = profile.burstFreq || activeBurstFreq;
                }
                if (profile.nasal) isNasal = true;
              }
            }
          }
        }

        if (!breathGestureActive) {
          activePressure = baseSource.pressure || 8.0;
        }

        if (stepF0 !== null) {
          this.lastTargetActiveF0 = stepF0;
        }
        targetActiveF0 = this.lastTargetActiveF0;

        // Smooth lung pressure decay/attack
        this.persistentLungPressure += 0.15 * (activePressure - this.persistentLungPressure);
        lungPressureNow = this.persistentLungPressure;

        const blendedArtic = { ...DEFAULT_ARTICULATORS };
        for (const k of Object.keys(blendedArtic) as (keyof ArticulatorState)[]) {
          if (articWeights[k] > 0) {
            blendedArtic[k] = articSum[k] / articWeights[k];
          } else {
            blendedArtic[k] = DEFAULT_ARTICULATORS[k];
          }
        }

        // Apply subtext articulatory perturbations
        if (subtextTrajectory) {
          blendedArtic.jaw += subtextTrajectory.getDeltaJaw(t);
          blendedArtic.larynx += subtextTrajectory.getDeltaLarynx(t);
        }

        currentArtic = blendedArtic;
        voicingGain = activeVoicing;
        fricationGain = activeFricationGain;
        fricationFreq = activeFricationFreq;
        burstGain = activeBurstGain;
        burstFreq = activeBurstFreq;
        nasalFactor = isNasal ? 0.8 : Math.max(0, currentArtic.velum);

        const evaluated = this.evaluateFormantsFromArticulators(currentArtic, body);
        if (profileFormants && profileBandwidths) {
          currentFormants = evaluated.formants.map((f, i) =>
            (1.0 - 0.75 * profileWeight) * f + 0.75 * profileWeight * profileFormants![i]
          );
          currentBandwidths = evaluated.bandwidths.map((b, i) =>
            (1.0 - 0.75 * profileWeight) * b + 0.75 * profileWeight * profileBandwidths![i]
          );
        } else {
          currentFormants = evaluated.formants;
          currentBandwidths = evaluated.bandwidths;
        }

        if (options?.singing) {
          const scale = 1.0 / (1.0 - 0.16 * (body?.female ?? 0) - 0.32 * (body?.child ?? 0));
          currentFormants[2] = 2820 * scale;
          currentFormants[3] = 3000 * scale;
          currentFormants[4] = 3200 * scale;
          currentBandwidths[2] = 70;
          currentBandwidths[3] = 80;
          currentBandwidths[4] = 90;
        }

        if (options?.emotion === "cold_anger") {
          burstGain *= 1.5;
        }
      }

      // Step 2nd-order critically damped filter on activeF0
      const f0Error = targetActiveF0 - this.f0Smoothed;
      const f0Accel = omegaN * omegaN * f0Error - 2.0 * omegaN * this.f0Velocity;
      this.f0Velocity += f0Accel * dt;
      this.f0Smoothed += this.f0Velocity * dt;
      currentSource.f0 = this.f0Smoothed;

      // Subglottal driving pressure calculation
      let effectivePressure = lungPressureNow;
      if (subtextTrajectory) {
        effectivePressure = subtextTrajectory.getPs(t) * subtextTrajectory.getTremorPsFactor(t);
      } else if (options?.emotion === "frustration") {
        // Phase-coupled 8.5 Hz subglottal pressure fluctuation
        effectivePressure = Math.max(0.5, effectivePressure + 3.0 * Math.sin(2.0 * Math.PI * tremorFreq * t));
      }

      if (effectivePressure < 0.5) {
        output[frameIdx] = 0.0;
        continue;
      }

      // Physical Glottal Oscillator
      let vibratoPitchFactor = 1.0;
      let vibratoAmFactor = 1.0;

      if (options?.singing || activeVibrato > 0.01) {
        const depth = Math.max(activeVibrato, baseSource.vibratoDepth || 0.35);
        const vibRate = baseSource.vibratoRate || 5.8;
        const cents = 50.0 * depth * Math.sin(2.0 * Math.PI * vibRate * t);
        vibratoPitchFactor = Math.pow(2.0, cents / 1200.0);
        vibratoAmFactor = 1.0 + 0.16 * depth * Math.sin(2.0 * Math.PI * vibRate * t);
      }

      let emotionF0Factor = 1.0;
      if (subtextTrajectory) {
        const normT = Math.min(1.0, t / actualDurationSec);
        emotionF0Factor *= subtextTrajectory.getPitchContourScale(normT);
        emotionF0Factor *= subtextTrajectory.getTremorF0Factor(t);
      } else {
        if (options?.emotion === "sadness") {
          emotionF0Factor = 1.0 - 0.18 * Math.min(1.0, t / Math.max(0.2, actualDurationSec));
        } else if (options?.emotion === "frustration") {
          // Synchronous phase-coupled pitch tremor at 8.5 Hz with phase offset
          emotionF0Factor = 1.0 + 0.035 * Math.sin(2.0 * Math.PI * tremorFreq * t + tremorPhase);
        }
      }

      const slowDrift = (options?.singing || options?.emotion === "cold_anger")
        ? 0.0
        : (0.006 * (currentSource.drift ?? 1.0) * Math.sin(2.0 * Math.PI * 1.3 * t));

      const instantaneousF0 = Math.max(40, currentSource.f0 * vibratoPitchFactor * emotionF0Factor * (1.0 + this.jitterOffset + slowDrift));
      const glottalPeriod = this.sampleRate / instantaneousF0;

      this.glottalPhase += 1.0;
      if (this.glottalPhase >= glottalPeriod) {
        this.glottalPhase -= glottalPeriod;
        this.glottalCycleCount++;
        if (options?.emotion === "frustration" || options?.subtext === "anxiety" || options?.subtext === "annoyance") {
          this.jitterOffset = 0.025 * this.nextGaussian();
          this.shimmerGain = 1.0 + 0.060 * this.nextGaussian();
        } else if (options?.emotion === "cold_anger") {
          this.jitterOffset = 0.002 * this.nextGaussian();
          this.shimmerGain = 1.0 + 0.008 * this.nextGaussian();
        } else {
          const roughMod = 1.0 + 3.0 * (currentSource.roughness || 0.0);
          this.jitterOffset = 0.008 * roughMod * this.nextGaussian();
          this.shimmerGain = 1.0 + 0.025 * roughMod * this.nextGaussian();
        }
      }

      // Vocal fry subharmonics
      let fryScale = 1.0;
      if (currentSource.fry && currentSource.fry > 0.05) {
        if (this.glottalCycleCount % 2 === 1) {
          fryScale = 1.0 - 0.65 * currentSource.fry;
        }
      }

      // Gunnar Fant differential LF model
      let instantaneousRd = 1.0;
      if (subtextTrajectory) {
        instantaneousRd = subtextTrajectory.getRd(t);
      } else if (options?.emotion === "hot_anger") {
        instantaneousRd = 0.42;
      } else if (options?.emotion === "cold_anger") {
        instantaneousRd = 0.55;
      } else if (options?.emotion === "sadness") {
        instantaneousRd = 1.80;
      } else if (options?.emotion === "tenderness") {
        instantaneousRd = 1.65;
      } else if (options?.emotion === "frustration") {
        instantaneousRd = 0.68;
      } else {
        instantaneousRd = Math.max(
          0.35,
          Math.min(
            2.80,
            1.0 - 0.60 * ((currentSource.tension ?? 0.5) - 0.5) +
              0.80 * ((currentSource.breathiness ?? 0.12) - 0.12) -
              0.40 * ((currentSource.brightness ?? 0.35) - 0.35)
          )
        );
      }

      const T0 = 1.0 / instantaneousF0;
      const targetEe = 0.8 + 0.4 * (currentSource.tension ?? 0.5) + 0.3 * (currentSource.brightness ?? 0.35);
      const lfParams = solveLfFromRd(instantaneousRd, T0, targetEe);
      const cycleTime = this.glottalPhase / this.sampleRate;
      let glottalFlowDeriv = evaluateLfFlowDerivative(cycleTime, lfParams, T0);

      glottalFlowDeriv *= this.shimmerGain * voicingGain * fryScale * vibratoAmFactor;

      // Continuous aspiration turbulence noise
      const aspirationNoise =
        this.nextGaussian() *
        (0.012 + 0.06 * (currentSource.breathiness ?? 0.12) + (1.0 - voicingGain) * 0.16);

      // Raw uncoupled glottal excitation
      const rawExcitation = (glottalFlowDeriv * 0.80 + aspirationNoise) * Math.sqrt(effectivePressure / 8.0);

      // 1-sample unit-delay interactive supraglottal inertance coupling
      let excitation = this.glottalFlow.step(rawExcitation, effectivePressure);

      if (options?.emotion === "tenderness") {
        const onsetGain = Math.min(1.0, t / 0.085);
        excitation *= onsetGain;
      }

      // Pre-plosive micro-glottal stops for tense/hostile states
      if (subtextTrajectory) {
        excitation *= subtextTrajectory.getMicroGlottalStopGain(t);
      }

      // Cascaded Differentiable Formant Filter Bank
      let y = excitation;
      for (let k = 0; k < 5; k++) {
        y = this.resonators[k].process(
          y,
          currentFormants[k],
          currentBandwidths[k],
          this.sampleRate
        );
      }

      // Nasal cavity parallel coupling
      if (nasalFactor > 0.05) {
        const nasalPole = this.nasalResonator.process(excitation, 280, 100, this.sampleRate);
        y = y * (1.0 - 0.35 * nasalFactor) + nasalPole * 0.35 * nasalFactor;
      }

      // Higher-pole frequency equalization
      const higherPoleHighpass = y - 0.85 * this.prevHigherPole;
      this.prevHigherPole = y;
      let oralOut = y + 0.45 * higherPoleHighpass;

      // Plosive burst and frication injection
      if (burstGain > 0.01) {
        const burstNoise = this.burstBandpass.process(this.nextGaussian(), burstFreq, 450, this.sampleRate);
        oralOut += burstNoise * burstGain * 1.4;
      }
      if (fricationGain > 0.01) {
        const fricNoise = this.fricationBandpass.process(this.nextGaussian(), fricationFreq, 1400, this.sampleRate);
        oralOut += fricNoise * fricationGain * 1.1;
      }

      // Lip Radiation
      const lipRadiation = oralOut - 0.98 * this.prevLipRad;
      this.prevLipRad = oralOut;

      // Soft Tissue Acoustic Damping & Natural Warmth Saturation
      const saturated = Math.tanh(1.10 * lipRadiation) * 0.80;

      output[frameIdx] = saturated;
    }

    if (isContinuous) {
      this.streamTimeOffset += actualDurationSec;
    }

    return output;
  }

  /**
   * Synthesize sustained posture (for motor babbling & target verification).
   */
  synthesizePosture(
    artic: Partial<ArticulatorState>,
    durationMs: number = 200,
    source: Partial<VoiceSource> = {},
    options?: SynthesizeOptions
  ): Float32Array {
    const fullArtic: ArticulatorState = { ...DEFAULT_ARTICULATORS, ...artic };
    const fullSource: VoiceSource = { ...DEFAULT_LARYNGEAL, ...source };
    const durSec = durationMs / 1000.0;

    const fakeGesture: Gesture = {
      t0: 0.0,
      t1: durSec,
      rampIn: 0.01,
      rampOut: 0.01,
      strength: 1.0,
      targets: {
        ...(fullArtic as any),
        breath: 1.0,
        f0: fullSource.f0,
      },
    };

    return this.synthesizePlan([fakeGesture], durSec, { female: 0.0, child: 0.0 }, fullSource, options);
  }
}
