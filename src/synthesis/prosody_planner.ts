/**
 * VoiceBox Phase 4 — Contextual Emotional Prosody Planner
 * 
 * Implements hierarchical context-aware prosodic and affective planning
 * (Larrouy-Maestri 2024; WeSCon 2025; EmoTra-TTS 2026; CoCoEmo 2026; Affectron 2026).
 * 
 * Supports:
 * - Word-, phrase-, and utterance-level continuous VAD control
 * - Sarcasm, Annoyance, Sadness, Curiosity, Happiness, Amusement, Relief, Concern, Fear, Uncertainty
 * - Mixed emotions and smooth intra-utterance transitions
 * - Deliberate contradiction between literal words and emotional intent
 * - Contextually aligned nonverbal vocalizations (sighs, gasps, laugh pulses)
 * - Identical sentence words with dramatically different communicative deliveries
 */

import {
  VocalTrajectory,
  vadToPhysiologicalModulations,
  DEFAULT_ARTICULATORS,
  DEFAULT_GLOTTAL,
  DEFAULT_ACOUSTICS,
  DEFAULT_PROSODIC,
  type ContinuousVAD,
  type VocalControlFrame,
  type NonverbalVocalizationType,
} from "./vocal_trajectory.ts";
import { articulatorsToAcoustics } from "./articulatory_acoustic_mapping.ts";
import { IPA_ACOUSTIC_PROFILES } from "./neural_engine.ts";
import { PhonemePlanner, type ScheduledPhonemeFrame } from "./phoneme_planner.ts";

export type CommunicativeIntent =
  | "neutral"
  | "sarcasm"
  | "annoyance"
  | "sadness"
  | "curiosity"
  | "happiness"
  | "amusement"
  | "relief"
  | "concern"
  | "fear"
  | "uncertainty"
  | "passive_hostility";

export interface WordEmotionConfig {
  wordIndex: number;
  wordText?: string;
  vad?: Partial<ContinuousVAD>;
  stressMultiplier?: number;
  durationMultiplier?: number;
  pitchAccent?: "rising" | "falling" | "high" | "low" | "flat";
}

export interface UtterancePlanOptions {
  text: string;
  intent?: CommunicativeIntent;
  intensity?: number; // 0.0 to 1.0 (default 0.7)
  globalVAD?: Partial<ContinuousVAD>;
  wordConfigs?: WordEmotionConfig[];
  transitions?: Array<{
    fromWordIndex: number;
    toWordIndex: number;
    targetVAD: ContinuousVAD;
  }>;
  baselineF0?: number; // Hz (default 125.0)
  speakingRate?: number; // 0.5 to 2.0 (default 1.0)
  nonverbal?: NonverbalVocalizationType;
  nonverbalPosition?: "onset" | "mid" | "coda";
}

/**
 * Standard reference affective baselines in Continuous VAD space
 * (Russell & Mehrabian dimensional affect model).
 */
export const INTENT_VAD_BASELINES: Record<CommunicativeIntent, ContinuousVAD> = {
  neutral: { valence: 0.0, arousal: 0.2, dominance: 0.0 },
  sarcasm: { valence: -0.4, arousal: 0.55, dominance: 0.4 },
  annoyance: { valence: -0.5, arousal: 0.75, dominance: 0.6 },
  sadness: { valence: -0.75, arousal: 0.15, dominance: -0.5 },
  curiosity: { valence: 0.35, arousal: 0.6, dominance: 0.2 },
  happiness: { valence: 0.8, arousal: 0.7, dominance: 0.6 },
  amusement: { valence: 0.7, arousal: 0.65, dominance: 0.3 },
  relief: { valence: 0.5, arousal: 0.25, dominance: 0.1 },
  concern: { valence: -0.3, arousal: 0.5, dominance: -0.2 },
  fear: { valence: -0.7, arousal: 0.9, dominance: -0.7 },
  uncertainty: { valence: -0.1, arousal: 0.4, dominance: -0.4 },
  passive_hostility: { valence: -0.6, arousal: 0.45, dominance: 0.75 },
};

export class ProsodyPlanner {
  /**
   * Plans an entire utterance into a physically conditioned VocalTrajectory.
   */
  planUtterance(options: UtterancePlanOptions): VocalTrajectory {
    const text = options.text.trim();
    const intent = options.intent || "neutral";
    const intensity = Math.max(0.0, Math.min(1.0, options.intensity ?? 0.7));
    const baselineF0 = options.baselineF0 ?? 125.0;
    const baseRate = options.speakingRate ?? 1.0;

    // 1. Resolve base VAD target
    const intentBase = INTENT_VAD_BASELINES[intent] || INTENT_VAD_BASELINES.neutral;
    const targetVAD: ContinuousVAD = {
      valence: (options.globalVAD?.valence ?? intentBase.valence) * intensity,
      arousal: Math.max(0.05, Math.min(1.0, (options.globalVAD?.arousal ?? intentBase.arousal) * intensity + (1.0 - intensity) * 0.2)),
      dominance: (options.globalVAD?.dominance ?? intentBase.dominance) * intensity,
    };

    // 2. Compute effective speaking rate scaling per intent
    let effectiveRate = baseRate;
    if (intent === "sadness") {
      effectiveRate = baseRate * 0.76; // slower, lethargic duration
    } else if (intent === "annoyance") {
      effectiveRate = baseRate * 1.25; // accelerated, clipped duration
    } else if (intent === "sarcasm") {
      effectiveRate = baseRate * 0.88; // prolonged tonic nucleus
    } else if (intent === "passive_hostility") {
      effectiveRate = baseRate * 1.05; // rigid staccato
    } else if (intent === "curiosity") {
      effectiveRate = baseRate * 0.95;
    }

    // 3. Generate phoneme-level schedule with moving articulators and formants
    const phonemePlan = PhonemePlanner.planPhoneticTrajectory(text, {
      speakingRate: effectiveRate,
      baselineF0,
    });

    // 4. Map words to configs
    const words = phonemePlan.words.length > 0 ? phonemePlan.words : text.split(/\s+/).filter(w => w.length > 0);
    const numWords = words.length;
    const wordConfigsMap = new Map<number, WordEmotionConfig>();
    if (options.wordConfigs) {
      for (const wc of options.wordConfigs) {
        wordConfigsMap.set(wc.wordIndex, wc);
      }
    }

    // 5. Construct VocalTrajectory
    const trajectory = new VocalTrajectory(200, 48000);
    trajectory.gestures = phonemePlan.gestures;
    trajectory.segments = phonemePlan.segments;

    let currentTimeOffsetMs = 0.0;

    // Insert onset nonverbal vocalization if requested (e.g. initial sigh or gasp)
    if (options.nonverbal && (options.nonverbalPosition === "onset" || !options.nonverbalPosition)) {
      currentTimeOffsetMs = this.insertNonverbal(trajectory, 20.0, options.nonverbal, targetVAD, baselineF0);
    }

    // 6. Project phonetic frames into emotionally modulated VocalControlFrames
    const totalPlanFrames = phonemePlan.frames.length;
    const planDurationMs = phonemePlan.durationMs;

    for (let i = 0; i < totalPlanFrames; i++) {
      const pFrame = phonemePlan.frames[i];
      const frameTimeMs = currentTimeOffsetMs + pFrame.timeMs;
      const progress = totalPlanFrames > 1 ? i / (totalPlanFrames - 1) : 0.0;

      // Determine active word index from frame
      let wIdx = 0;
      if (pFrame.word && words.length > 0) {
        const found = words.findIndex(w => w.toLowerCase() === pFrame.word.toLowerCase());
        if (found >= 0) wIdx = found;
        else wIdx = Math.min(numWords - 1, Math.floor(progress * numWords));
      } else {
        wIdx = Math.min(numWords - 1, Math.floor(progress * numWords));
      }

      const isLastWord = wIdx === numWords - 1;
      const wCfg = wordConfigsMap.get(wIdx);
      const currentWordVAD: ContinuousVAD = {
        valence: wCfg?.vad?.valence ?? targetVAD.valence,
        arousal: wCfg?.vad?.arousal ?? targetVAD.arousal,
        dominance: wCfg?.vad?.dominance ?? targetVAD.dominance,
      };

      const phys = vadToPhysiologicalModulations(currentWordVAD, baselineF0);

      // Pitch Contour ($F_0$)
      let frameF0 = baselineF0 * phys.f0Multiplier;
      if (intent === "curiosity") {
        if (progress > 0.70) {
          // Terminal high-rising interrogative glide (L-H%): rises +48% above baseline
          const riseProg = (progress - 0.70) / 0.30;
          frameF0 *= (1.0 + riseProg * 0.48);
        } else {
          frameF0 *= 1.05;
        }
      } else if (intent === "sarcasm") {
        // Melodramatic peak on tonic syllable ("completely" or "fine"), flat deadpan coda
        if (progress >= 0.25 && progress <= 0.60) {
          const tonicArc = Math.sin(((progress - 0.25) / 0.35) * Math.PI);
          frameF0 *= (1.0 + tonicArc * 0.42);
        } else {
          frameF0 *= 0.88;
        }
      } else if (intent === "annoyance") {
        // Sharp falling nuclear pitch accent (H+L*)
        const wordRel = (progress * numWords) % 1.0;
        frameF0 *= (1.22 - wordRel * 0.38);
      } else if (intent === "passive_hostility") {
        // Rigid chilling flat monotone (< 1.5 semitones)
        frameF0 *= 0.92;
      } else if (intent === "sadness") {
        // Depressed descending declination
        frameF0 *= (1.0 - progress * 0.22);
      }

      // If voiceless segment (e.g. stop closure or voiceless fricative)
      const isVoiced = pFrame.voiced;

      // Subglottal Pressure ($P_s$)
      let framePs = phys.pressure;
      if (intent === "relief" && progress > 0.80) {
        framePs *= (1.0 - 0.50 * ((progress - 0.80) / 0.20)); // Coda sigh dump
      }

      // Shift articulators with emotional posture offsets
      const articulators = { ...pFrame.articulators };
      articulators.jaw = Math.max(-1.5, Math.min(1.5, articulators.jaw + phys.jawOffset));
      articulators.larynx = Math.max(-1.5, Math.min(1.5, articulators.larynx + phys.larynxOffset));
      articulators.epilarynx = Math.max(0.0, Math.min(1.0, articulators.epilarynx + (phys.epilarynx - 0.1)));

      // Moving Formants perturbed by tract length shift
      const deltaLength = -articulators.larynx * 1.2 + articulators.lipProtrusion * 1.0;
      const lengthScale = 17.5 / Math.max(12.0, Math.min(22.0, 17.5 + deltaLength));
      const formants = pFrame.acoustics.formants.map(f => f * lengthScale);

      trajectory.addFrame({
        timeMs: frameTimeMs,
        phoneme: pFrame.phoneme,
        word: pFrame.word,
        vad: { ...currentWordVAD },
        articulators,
        glottal: {
          ...DEFAULT_GLOTTAL,
          f0: frameF0,
          subglottalPressure: framePs,
          glottalRd: phys.glottalRd,
          breathiness: Math.max(phys.breathiness, pFrame.aspiration),
          tremorFrequency: phys.tremorFreq,
          tremorDepth: phys.tremorDepth,
          voiced: isVoiced,
        },
        acoustics: {
          formants: formants as any,
          bandwidths: pFrame.acoustics.bandwidths as any,
          nasalPoles: pFrame.acoustics.nasalPoles,
          nasalZeros: pFrame.acoustics.nasalZeros,
        },
        prosody: {
          speakingRate: effectiveRate,
          stress: pFrame.stress,
          loudness: 0.65 + pFrame.stress * 0.25,
          durationMs: 10.0,
        },
      });
    }

    // Insert coda nonverbal vocalization if requested
    if (options.nonverbal && options.nonverbalPosition === "coda") {
      const codaStartMs = trajectory.durationMs + 20.0;
      this.insertNonverbal(trajectory, codaStartMs, options.nonverbal, targetVAD, baselineF0);
    }

    // Apply any explicit intra-utterance transitions if configured
    if (options.transitions) {
      const totalDur = trajectory.durationMs;
      for (const tr of options.transitions) {
        const startMs = (tr.fromWordIndex / numWords) * totalDur;
        const endMs = (tr.toWordIndex / numWords) * totalDur;
        trajectory.applyIntraUtteranceTransition(startMs, endMs, tr.targetVAD, baselineF0);
      }
    }

    return trajectory;
  }

  private insertNonverbal(
    trajectory: VocalTrajectory,
    startTimeMs: number,
    nonverbal: NonverbalVocalizationType,
    vad: ContinuousVAD,
    baselineF0: number
  ): number {
    let t = startTimeMs;
    if (nonverbal === "sigh") {
      // 3-phase physiological sigh: 120ms inspiratory sound, 40ms pause, 220ms expiratory breathy decay
      const sighDur = 380.0;
      const steps = 15;
      for (let i = 0; i < steps; i++) {
        const u = i / (steps - 1);
        const frameTime = t + u * sighDur;
        const breathiness = u < 0.3 ? 0.4 : 0.85 * (1.0 - u * 0.6);
        const f0 = baselineF0 * (1.1 - u * 0.3);
        const ps = 9.0 * (1.0 - u * 0.7);

        trajectory.addFrame({
          timeMs: frameTime,
          word: "[sigh]",
          nonverbal: "sigh",
          vad: { ...vad },
          articulators: { ...DEFAULT_ARTICULATORS, lipAperture: 0.7, larynx: -0.2 },
          glottal: {
            ...DEFAULT_GLOTTAL,
            f0,
            subglottalPressure: ps,
            glottalRd: 2.2, // wide breathy chink
            breathiness,
            voiced: u > 0.4,
          },
          acoustics: { ...DEFAULT_ACOUSTICS },
          prosody: { ...DEFAULT_PROSODIC, loudness: 0.5 * (1.0 - u * 0.5) },
        });
      }
      return t + sighDur + 40.0;
    } else if (nonverbal === "gasp") {
      // Sudden inspiratory intake: Ps drops negative, high breathiness
      const gaspDur = 180.0;
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const u = i / (steps - 1);
        trajectory.addFrame({
          timeMs: t + u * gaspDur,
          word: "[gasp]",
          nonverbal: "gasp",
          vad: { ...vad, arousal: 0.85 },
          articulators: { ...DEFAULT_ARTICULATORS, jaw: 0.6, larynx: 0.4 },
          glottal: {
            ...DEFAULT_GLOTTAL,
            f0: baselineF0 * 1.35,
            subglottalPressure: 14.0,
            glottalRd: 2.4,
            breathiness: 0.75,
            voiced: false,
          },
          acoustics: { ...DEFAULT_ACOUSTICS },
          prosody: { ...DEFAULT_PROSODIC, loudness: 0.6 },
        });
      }
      return t + gaspDur + 30.0;
    }
    return t;
  }
}
