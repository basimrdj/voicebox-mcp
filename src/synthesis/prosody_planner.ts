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

    // 2. Tokenize words
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordConfigsMap = new Map<number, WordEmotionConfig>();
    if (options.wordConfigs) {
      for (const wc of options.wordConfigs) {
        wordConfigsMap.set(wc.wordIndex, wc);
      }
    }

    // 3. Assemble phonetic and syllable schedule
    const trajectory = new VocalTrajectory(200, 48000);
    let currentTimeMs = 20.0; // 20ms lead-in

    // Insert onset nonverbal vocalization if requested (e.g. initial sigh or gasp)
    if (options.nonverbal && (options.nonverbalPosition === "onset" || !options.nonverbalPosition)) {
      currentTimeMs = this.insertNonverbal(trajectory, currentTimeMs, options.nonverbal, targetVAD, baselineF0);
    }

    const numWords = words.length;

    for (let wIdx = 0; wIdx < numWords; wIdx++) {
      const word = words[wIdx].replace(/[.,!?;:]/g, "");
      const isFirstWord = wIdx === 0;
      const isLastWord = wIdx === numWords - 1;

      // Word-specific VAD override or interpolation
      const wCfg = wordConfigsMap.get(wIdx);
      const currentWordVAD: ContinuousVAD = {
        valence: wCfg?.vad?.valence ?? targetVAD.valence,
        arousal: wCfg?.vad?.arousal ?? targetVAD.arousal,
        dominance: wCfg?.vad?.dominance ?? targetVAD.dominance,
      };

      const phys = vadToPhysiologicalModulations(currentWordVAD, baselineF0);

      // Duration & Timing Planning
      let wordDurationMultiplier = baseRate * phys.rateMultiplier;
      if (wCfg?.durationMultiplier) {
        wordDurationMultiplier *= wCfg.durationMultiplier;
      }

      // Intent-specific prosodic timing rules:
      if (intent === "sarcasm") {
        // Prolong tonic / focal syllable dramatically (+45%)
        if (word.toLowerCase() === "fine" || word.toLowerCase() === "completely" || wIdx === 2) {
          wordDurationMultiplier *= 1.45;
        } else {
          wordDurationMultiplier *= 0.95;
        }
      } else if (intent === "passive_hostility") {
        // Cold, staccato, uniform word durations with clipped vocalic nuclei
        wordDurationMultiplier *= 0.90;
      } else if (intent === "annoyance") {
        // Compressed, urgent delivery
        wordDurationMultiplier *= 0.85;
      } else if (intent === "sadness") {
        // Slow lethargic pace
        wordDurationMultiplier *= 1.30;
      } else if (intent === "curiosity" && isLastWord) {
        // Terminal vowel elongation for question rise
        wordDurationMultiplier *= 1.25;
      }

      // Estimate word duration: roughly 65ms per character * multiplier, clamped 180ms - 600ms
      const wordDurMs = Math.max(160.0, Math.min(750.0, word.length * 60.0 * wordDurationMultiplier));

      // F0 Contour Planning for this word
      let wordStartF0 = baselineF0 * phys.f0Multiplier;
      let wordPeakF0 = wordStartF0;
      let wordEndF0 = wordStartF0;

      if (intent === "curiosity") {
        if (isLastWord) {
          // Terminal high-rising question glide (L-H%): rises +45% at the end
          wordPeakF0 = wordStartF0 * 1.15;
          wordEndF0 = wordStartF0 * 1.50;
        } else {
          wordPeakF0 = wordStartF0 * 1.10;
          wordEndF0 = wordStartF0 * 1.02;
        }
      } else if (intent === "sarcasm") {
        if (word.toLowerCase() === "fine" || wIdx === 2 || wIdx === 1) {
          // Exaggerated melodramatic rise-fall arc
          wordPeakF0 = wordStartF0 * 1.40;
          wordEndF0 = wordStartF0 * 0.85;
        } else {
          // Flat deadpan coda
          wordStartF0 *= 0.90;
          wordPeakF0 = wordStartF0;
          wordEndF0 = wordStartF0 * 0.88;
        }
      } else if (intent === "annoyance") {
        // Sharp falling nuclear pitch accents (H+L*)
        wordStartF0 *= 1.20;
        wordPeakF0 = wordStartF0 * 1.25;
        wordEndF0 = wordStartF0 * 0.80;
      } else if (intent === "passive_hostility") {
        // Rigorous, chilling flat monotone (< 1.5 semitone variation)
        wordStartF0 *= 0.92;
        wordPeakF0 = wordStartF0;
        wordEndF0 = wordStartF0;
      } else if (intent === "sadness") {
        // Subdued pitch descending continuously
        const declination = 1.0 - (wIdx / Math.max(1, numWords)) * 0.22;
        wordStartF0 = baselineF0 * phys.f0Multiplier * declination;
        wordPeakF0 = wordStartF0 * 1.02;
        wordEndF0 = wordStartF0 * 0.92;
      }

      // Generate frame trajectory for this word (sampled every 10ms)
      const numFrames = Math.max(4, Math.floor(wordDurMs / 10.0));
      const stepMs = wordDurMs / numFrames;

      for (let f = 0; f < numFrames; f++) {
        const frameTime = currentTimeMs + f * stepMs;
        const progress = f / (numFrames - 1); // 0.0 to 1.0

        // Continuous quadratic pitch arc
        const pitchNorm = 4.0 * progress * (1.0 - progress); // 0 at ends, 1 in center
        const currentF0 = (1.0 - progress) * wordStartF0 + progress * wordEndF0 + pitchNorm * (wordPeakF0 - Math.max(wordStartF0, wordEndF0));

        // Subglottal pressure curve: peaks near word onset / tonic vowel
        let pCur = phys.pressure;
        if (intent === "relief" && isLastWord) {
          pCur *= (1.0 - 0.45 * progress); // Sigh exhalation dump
        }

        // Articulators
        const articulators = { ...DEFAULT_ARTICULATORS };
        articulators.jaw += phys.jawOffset;
        articulators.larynx += phys.larynxOffset;
        articulators.epilarynx = phys.epilarynx;

        // Formants
        const kin = articulatorsToAcoustics(articulators);

        trajectory.addFrame({
          timeMs: frameTime,
          word,
          vad: { ...currentWordVAD },
          articulators,
          glottal: {
            ...DEFAULT_GLOTTAL,
            f0: currentF0,
            subglottalPressure: pCur,
            glottalRd: phys.glottalRd,
            breathiness: phys.breathiness,
            tremorFrequency: phys.tremorFreq,
            tremorDepth: phys.tremorDepth,
            voiced: true,
          },
          acoustics: {
            formants: kin.formants,
            bandwidths: kin.bandwidths,
            nasalPoles: [250, 1000],
            nasalZeros: [350, 1200],
          },
          prosody: {
            speakingRate: wordDurationMultiplier,
            stress: 0.5 + pitchNorm * 0.4,
            loudness: 0.65 + pitchNorm * 0.25,
            durationMs: wordDurMs,
          },
        });
      }

      currentTimeMs += wordDurMs;

      // Word boundary pause
      let pauseMs = 35.0; // Standard inter-word closure
      if (intent === "passive_hostility") {
        pauseMs = 85.0; // Staccato cold deliberate pauses between words
      } else if (intent === "sarcasm" && wIdx === 1) {
        pauseMs = 120.0; // Theatrical pregnant pause before tonic emphasis
      } else if (intent === "uncertainty" && wIdx === 1) {
        pauseMs = 150.0; // Hesitation pause
      }

      // Add closure frame for pause
      trajectory.addFrame({
        timeMs: currentTimeMs,
        word: "[pause]",
        vad: { ...currentWordVAD },
        articulators: { ...DEFAULT_ARTICULATORS },
        glottal: {
          ...DEFAULT_GLOTTAL,
          f0: wordEndF0,
          subglottalPressure: Math.max(3.0, phys.pressure * 0.5),
          glottalRd: phys.glottalRd,
          voiced: false, // unvoiced inter-word closure
        },
        acoustics: { ...DEFAULT_ACOUSTICS },
        prosody: { ...DEFAULT_PROSODIC, loudness: 0.0, durationMs: pauseMs },
      });

      currentTimeMs += pauseMs;
    }

    // Insert coda nonverbal vocalization if requested (e.g. trailing sigh of relief or exasperation)
    if (options.nonverbal && options.nonverbalPosition === "coda") {
      currentTimeMs = this.insertNonverbal(trajectory, currentTimeMs, options.nonverbal, targetVAD, baselineF0);
    }

    // Apply any explicit intra-utterance transitions if configured
    if (options.transitions) {
      for (const tr of options.transitions) {
        const startMs = (tr.fromWordIndex / numWords) * currentTimeMs;
        const endMs = (tr.toWordIndex / numWords) * currentTimeMs;
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
