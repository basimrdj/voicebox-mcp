/**
 * VoiceBox Phase 2 — Unified Vocal Control Trajectory
 * 
 * Replaces static categorical emotional presets with a continuous,
 * time-varying articulatory and acoustic control trajectory.
 * 
 * Directly represents:
 * - Fundamental frequency F0 and intonation contour
 * - Subglottal pressure Ps and respiratory dynamics
 * - Vocal-fold adduction Qa and glottal pulse shape Rd
 * - Supraglottal vocal tract articulators (jaw, tongue, lips, velum, larynx, epilarynx)
 * - Formant trajectories (F1-F5) and bandwidths (B1-B5)
 * - Speaking rate, syllable duration, and stress
 * - Continuous Valence-Arousal-Dominance (VAD) space
 * - Physiological nonverbal vocalizations (sigh, gasp, laugh, sob)
 */

export interface ContinuousVAD {
  /** Valence: -1.0 (unpleasant / negative / distress) to +1.0 (pleasant / positive / joy) */
  valence: number;
  /** Arousal: 0.0 (calm / hypokinetic / low energy) to 1.0 (activated / intense / excited) */
  arousal: number;
  /** Dominance: -1.0 (submissive / helpless / timid) to +1.0 (dominant / assertive / aggressive) */
  dominance: number;
}

export interface ArticulatoryPosition {
  jaw: number;          // -1.0 (clenched/tense) to 1.0 (wide open)
  tongueBodyX: number;  // -1.0 (back) to 1.0 (front)
  tongueBodyY: number;  // -1.0 (low) to 1.0 (high)
  tongueTipX: number;   // -1.0 (retracted) to 1.0 (advanced)
  tongueTipY: number;   // -1.0 (floor) to 1.0 (alveolar/palatal contact)
  tongueTipCurl: number;// 0.0 to 1.0 (retroflex curl)
  lipAperture: number;  // 0.0 (closed) to 1.0 (wide open)
  lipProtrusion: number;// 0.0 to 1.0 (rounded / lengthened tract)
  lipWidth: number;     // -1.0 (narrowed) to 1.0 (spread / smile)
  velum: number;        // -1.0 (tight velopharyngeal seal) to 1.0 (lowered / nasal)
  larynx: number;       // -1.5 (lowered / lengthened tract) to 1.5 (elevated / shortened tract)
  epilarynx: number;    // 0.0 (open) to 1.0 (constricted / twang / singer's resonance)
}

export interface GlottalSourceState {
  f0: number;                  // Fundamental frequency in Hz
  subglottalPressure: number;  // Lung pressure Ps in cmH2O (typically 3.0 to 35.0)
  vocalFoldAdduction: number;  // Qa: 0.0 (breathy / incomplete closure) to 1.0 (pressed)
  glottalRd: number;           // Gunnar Fant Rd parameter (0.3 pressed to 3.0 breathy)
  openQuotient: number;        // Oq: ratio of open phase to cycle (0.3 to 0.85)
  spectralTilt: number;        // Extra high-frequency attenuation in dB/octave
  breathiness: number;         // Turbulent aspiration noise gain [0.0, 1.0]
  creakiness: number;          // Subharmonic / vocal fry excitation [0.0, 1.0]
  roughness: number;           // Cycle-to-cycle jitter and shimmer [0.0, 1.0]
  tremorFrequency: number;     // Neuromuscular tremor frequency in Hz (typically 5.0 - 9.0)
  tremorDepth: number;         // Modulation depth [0.0, 1.0]
  voiced: boolean;             // True if glottal oscillation is active
}

export interface AcousticResonanceState {
  formants: [number, number, number, number, number];    // F1, F2, F3, F4, F5 in Hz
  bandwidths: [number, number, number, number, number];  // B1, B2, B3, B4, B5 in Hz
  nasalPoles: [number, number];                          // Formant poles added by nasal branch
  nasalZeros: [number, number];                          // Antiresonance zeros
}

export interface ProsodicState {
  speakingRate: number; // Local rate multiplier (1.0 = baseline)
  stress: number;       // Metrical stress weight [0.0, 1.0]
  loudness: number;     // Acoustic energy / intensity [0.0, 1.0]
  durationMs: number;   // Target duration for current unit
}

export type NonverbalVocalizationType =
  | "sigh"
  | "gasp"
  | "throat_clear"
  | "laugh_pulse"
  | "sob"
  | "snicker"
  | "apneic_pause";

export interface VocalControlFrame {
  timeMs: number;
  phoneme?: string;
  word?: string;
  vad: ContinuousVAD;
  articulators: ArticulatoryPosition;
  glottal: GlottalSourceState;
  acoustics: AcousticResonanceState;
  prosody: ProsodicState;
  nonverbal?: NonverbalVocalizationType;
}

export const DEFAULT_VAD: ContinuousVAD = {
  valence: 0.0,
  arousal: 0.2,
  dominance: 0.0,
};

export const DEFAULT_ARTICULATORS: ArticulatoryPosition = {
  jaw: 0.0,
  tongueBodyX: 0.0,
  tongueBodyY: 0.0,
  tongueTipX: 0.0,
  tongueTipY: 0.0,
  tongueTipCurl: 0.0,
  lipAperture: 0.5,
  lipProtrusion: 0.1,
  lipWidth: 0.0,
  velum: -0.8, // sealed
  larynx: 0.0,
  epilarynx: 0.1,
};

export const DEFAULT_GLOTTAL: GlottalSourceState = {
  f0: 125.0,
  subglottalPressure: 8.0,
  vocalFoldAdduction: 0.5,
  glottalRd: 1.0,
  openQuotient: 0.55,
  spectralTilt: 0.0,
  breathiness: 0.1,
  creakiness: 0.0,
  roughness: 0.05,
  tremorFrequency: 0.0,
  tremorDepth: 0.0,
  voiced: true,
};

export const DEFAULT_ACOUSTICS: AcousticResonanceState = {
  formants: [500, 1500, 2500, 3500, 4500],
  bandwidths: [70, 100, 140, 210, 290],
  nasalPoles: [250, 1000],
  nasalZeros: [350, 1200],
};

export const DEFAULT_PROSODIC: ProsodicState = {
  speakingRate: 1.0,
  stress: 0.5,
  loudness: 0.7,
  durationMs: 100,
};

/**
 * Maps continuous Valence-Arousal-Dominance to physiological vocal parameters.
 * Grounded in Scherer (2003), Gobl & Ní Chasaide (2003), and Titze (2008).
 */
export function vadToPhysiologicalModulations(
  vad: ContinuousVAD,
  baselineF0: number = 125.0
): {
  f0Multiplier: number;
  pressure: number;
  glottalRd: number;
  breathiness: number;
  larynxOffset: number;
  epilarynx: number;
  jawOffset: number;
  tremorFreq: number;
  tremorDepth: number;
  rateMultiplier: number;
} {
  const v = Math.max(-1.0, Math.min(1.0, vad.valence));
  const a = Math.max(0.0, Math.min(1.0, vad.arousal));
  const d = Math.max(-1.0, Math.min(1.0, vad.dominance));

  // 1. Subglottal Pressure Ps: strongly driven by Arousal and Dominance
  // Calm/sad: Ps ≈ 4-6 cmH2O. Intense/angry: Ps ≈ 18-30 cmH2O.
  const pressure = 6.0 + a * 16.0 + d * 5.0;

  // 2. Fundamental Frequency F0 Multiplier
  // Arousal strongly elevates baseline pitch (up to +45-55% in high arousal).
  // Positive valence slightly warms and elevates pitch.
  const f0Mult = 1.0 + (a - 0.2) * 0.55 + v * 0.08;

  // 3. Glottal Declination Rd (Vocal fold adduction Qa)
  // Low arousal / negative valence (dejection/sadness): Rd > 1.6 (breathy, lax)
  // High arousal / high dominance (anger/hostility): Rd < 0.65 (pressed, hyper-adducted)
  let glottalRd = 1.0 - (a - 0.3) * 1.0 - d * 0.6 - v * 0.2;
  glottalRd = Math.max(0.35, Math.min(2.8, glottalRd));

  // 4. Breathiness
  const breathiness = glottalRd > 1.4 ? Math.min(0.85, 0.1 + (glottalRd - 1.4) * 0.5) : 0.08;

  // 5. Laryngeal vertical positioning
  // Fear/excitement: elevated larynx (+0.4) -> shorter vocal tract -> higher formants
  // Solemnity/grief/authority: lowered larynx (-0.4) -> longer vocal tract -> lower formants
  const larynxOffset = (a - 0.5) * 0.4 - (d * 0.2);

  // 6. Epilaryngeal narrowing (twang / acoustic inertance reinforcement)
  const epilarynx = Math.max(0.0, Math.min(1.0, 0.15 + d * 0.4 + a * 0.3));

  // 7. Jaw offset
  // Dominance/cold hostility clenches jaw; high arousal / joy opens jaw
  const jawOffset = v > 0 ? (v * 0.2 + a * 0.2) : (d > 0 ? -d * 0.25 : -0.1);

  // 8. Tremor (Neuromuscular instability under high arousal with low dominance: anxiety/panic)
  let tremorDepth = 0.0;
  let tremorFreq = 0.0;
  if (a > 0.4 && d < -0.1) {
    tremorDepth = Math.min(0.35, (a - 0.4) * 0.4 + (-d) * 0.3);
    tremorFreq = 7.5 + (a * 1.5); // 7.5 to 9.0 Hz tremor
  }

  // 9. Speaking rate multiplier
  const rateMultiplier = Math.max(0.5, Math.min(2.0, 1.0 + (a - 0.3) * 0.5 + d * 0.15));

  return {
    f0Multiplier: Math.max(0.5, Math.min(2.5, f0Mult)),
    pressure: Math.max(3.5, Math.min(38.0, pressure)),
    glottalRd,
    breathiness,
    larynxOffset,
    epilarynx,
    jawOffset,
    tremorFreq,
    tremorDepth,
    rateMultiplier,
  };
}

/**
 * Time-Varying Vocal Control Trajectory.
 * Provides continuous, smooth C1-interpolated physical and acoustic control
 * over an entire utterance.
 */
export class VocalTrajectory {
  readonly frameRateHz: number;
  readonly sampleRate: number;
  readonly frames: VocalControlFrame[];

  constructor(
    frameRateHz: number = 200, // 5ms per control frame
    sampleRate: number = 48000,
    frames: VocalControlFrame[] = []
  ) {
    this.frameRateHz = frameRateHz;
    this.sampleRate = sampleRate;
    this.frames = [...frames];
  }

  get durationMs(): number {
    if (this.frames.length === 0) return 0;
    return this.frames[this.frames.length - 1].timeMs;
  }

  addFrame(frame: VocalControlFrame): void {
    this.frames.push(frame);
  }

  /**
   * Evaluates continuous frame parameters at any arbitrary continuous timestamp t (ms)
   * using Hermite / cubic interpolation to guarantee C1 smoothness with zero clicks.
   */
  interpolateAt(timeMs: number): VocalControlFrame {
    if (this.frames.length === 0) {
      return {
        timeMs,
        vad: { ...DEFAULT_VAD },
        articulators: { ...DEFAULT_ARTICULATORS },
        glottal: { ...DEFAULT_GLOTTAL },
        acoustics: { ...DEFAULT_ACOUSTICS },
        prosody: { ...DEFAULT_PROSODIC },
      };
    }

    if (timeMs <= this.frames[0].timeMs) {
      return { ...this.frames[0], timeMs };
    }

    const last = this.frames[this.frames.length - 1];
    if (timeMs >= last.timeMs) {
      return { ...last, timeMs };
    }

    // Binary search for enclosing frame interval [i, i + 1]
    let low = 0;
    let high = this.frames.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.frames[mid].timeMs <= timeMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const i0 = Math.max(0, high);
    const i1 = Math.min(this.frames.length - 1, i0 + 1);

    const f0 = this.frames[i0];
    const f1 = this.frames[i1];

    const dt = f1.timeMs - f0.timeMs;
    if (dt <= 1e-4) {
      return { ...f0, timeMs };
    }

    // Normalized linear blending factor alpha
    const alpha = (timeMs - f0.timeMs) / dt;
    // Raised-cosine S-curve smoothing for C1 continuous derivatives: S(a) = 0.5 - 0.5 * cos(pi * a)
    const smoothAlpha = 0.5 - 0.5 * Math.cos(Math.PI * alpha);

    const lerp = (a: number, b: number) => a + smoothAlpha * (b - a);

    // Interpolate VAD
    const vad: ContinuousVAD = {
      valence: lerp(f0.vad.valence, f1.vad.valence),
      arousal: lerp(f0.vad.arousal, f1.vad.arousal),
      dominance: lerp(f0.vad.dominance, f1.vad.dominance),
    };

    // Interpolate Articulators
    const articulators: ArticulatoryPosition = {
      jaw: lerp(f0.articulators.jaw, f1.articulators.jaw),
      tongueBodyX: lerp(f0.articulators.tongueBodyX, f1.articulators.tongueBodyX),
      tongueBodyY: lerp(f0.articulators.tongueBodyY, f1.articulators.tongueBodyY),
      tongueTipX: lerp(f0.articulators.tongueTipX, f1.articulators.tongueTipX),
      tongueTipY: lerp(f0.articulators.tongueTipY, f1.articulators.tongueTipY),
      tongueTipCurl: lerp(f0.articulators.tongueTipCurl, f1.articulators.tongueTipCurl),
      lipAperture: lerp(f0.articulators.lipAperture, f1.articulators.lipAperture),
      lipProtrusion: lerp(f0.articulators.lipProtrusion, f1.articulators.lipProtrusion),
      lipWidth: lerp(f0.articulators.lipWidth, f1.articulators.lipWidth),
      velum: lerp(f0.articulators.velum, f1.articulators.velum),
      larynx: lerp(f0.articulators.larynx, f1.articulators.larynx),
      epilarynx: lerp(f0.articulators.epilarynx, f1.articulators.epilarynx),
    };

    // Interpolate Glottal Source
    const glottal: GlottalSourceState = {
      f0: lerp(f0.glottal.f0, f1.glottal.f0),
      subglottalPressure: lerp(f0.glottal.subglottalPressure, f1.glottal.subglottalPressure),
      vocalFoldAdduction: lerp(f0.glottal.vocalFoldAdduction, f1.glottal.vocalFoldAdduction),
      glottalRd: lerp(f0.glottal.glottalRd, f1.glottal.glottalRd),
      openQuotient: lerp(f0.glottal.openQuotient, f1.glottal.openQuotient),
      spectralTilt: lerp(f0.glottal.spectralTilt, f1.glottal.spectralTilt),
      breathiness: lerp(f0.glottal.breathiness, f1.glottal.breathiness),
      creakiness: lerp(f0.glottal.creakiness, f1.glottal.creakiness),
      roughness: lerp(f0.glottal.roughness, f1.glottal.roughness),
      tremorFrequency: lerp(f0.glottal.tremorFrequency, f1.glottal.tremorFrequency),
      tremorDepth: lerp(f0.glottal.tremorDepth, f1.glottal.tremorDepth),
      voiced: alpha < 0.5 ? f0.glottal.voiced : f1.glottal.voiced,
    };

    // Interpolate Formants and Bandwidths
    const formants: [number, number, number, number, number] = [
      lerp(f0.acoustics.formants[0], f1.acoustics.formants[0]),
      lerp(f0.acoustics.formants[1], f1.acoustics.formants[1]),
      lerp(f0.acoustics.formants[2], f1.acoustics.formants[2]),
      lerp(f0.acoustics.formants[3], f1.acoustics.formants[3]),
      lerp(f0.acoustics.formants[4], f1.acoustics.formants[4]),
    ];

    const bandwidths: [number, number, number, number, number] = [
      lerp(f0.acoustics.bandwidths[0], f1.acoustics.bandwidths[0]),
      lerp(f0.acoustics.bandwidths[1], f1.acoustics.bandwidths[1]),
      lerp(f0.acoustics.bandwidths[2], f1.acoustics.bandwidths[2]),
      lerp(f0.acoustics.bandwidths[3], f1.acoustics.bandwidths[3]),
      lerp(f0.acoustics.bandwidths[4], f1.acoustics.bandwidths[4]),
    ];

    const acoustics: AcousticResonanceState = {
      formants,
      bandwidths,
      nasalPoles: [
        lerp(f0.acoustics.nasalPoles[0], f1.acoustics.nasalPoles[0]),
        lerp(f0.acoustics.nasalPoles[1], f1.acoustics.nasalPoles[1]),
      ],
      nasalZeros: [
        lerp(f0.acoustics.nasalZeros[0], f1.acoustics.nasalZeros[0]),
        lerp(f0.acoustics.nasalZeros[1], f1.acoustics.nasalZeros[1]),
      ],
    };

    // Interpolate Prosodic
    const prosody: ProsodicState = {
      speakingRate: lerp(f0.prosody.speakingRate, f1.prosody.speakingRate),
      stress: lerp(f0.prosody.stress, f1.prosody.stress),
      loudness: lerp(f0.prosody.loudness, f1.prosody.loudness),
      durationMs: lerp(f0.prosody.durationMs, f1.prosody.durationMs),
    };

    return {
      timeMs,
      phoneme: alpha < 0.5 ? f0.phoneme : f1.phoneme,
      word: alpha < 0.5 ? f0.word : f1.word,
      vad,
      articulators,
      glottal,
      acoustics,
      prosody,
      nonverbal: alpha < 0.5 ? f0.nonverbal : f1.nonverbal,
    };
  }

  /**
   * Smoothly transitions emotion within an utterance (EmoTra-TTS style).
   * Blends between current trajectory and a target VAD between startMs and endMs.
   */
  applyIntraUtteranceTransition(
    startMs: number,
    endMs: number,
    targetVAD: ContinuousVAD,
    baselineF0: number = 125.0
  ): void {
    if (endMs <= startMs) return;

    for (let i = 0; i < this.frames.length; i++) {
      const f = this.frames[i];
      if (f.timeMs >= startMs && f.timeMs <= endMs) {
        const u = (f.timeMs - startMs) / (endMs - startMs);
        const w = 0.5 - 0.5 * Math.cos(Math.PI * u); // Smooth S-curve

        // Blend VAD
        f.vad.valence = f.vad.valence * (1 - w) + targetVAD.valence * w;
        f.vad.arousal = f.vad.arousal * (1 - w) + targetVAD.arousal * w;
        f.vad.dominance = f.vad.dominance * (1 - w) + targetVAD.dominance * w;

        // Apply updated physiological modulation
        const mods = vadToPhysiologicalModulations(f.vad, baselineF0);
        f.glottal.subglottalPressure = mods.pressure;
        f.glottal.glottalRd = mods.glottalRd;
        f.glottal.breathiness = mods.breathiness;
        f.glottal.f0 = baselineF0 * mods.f0Multiplier;
        f.glottal.tremorFrequency = mods.tremorFreq;
        f.glottal.tremorDepth = mods.tremorDepth;
        f.articulators.larynx = mods.larynxOffset;
        f.articulators.epilarynx = mods.epilarynx;
        f.articulators.jaw += mods.jawOffset * 0.5;
      } else if (f.timeMs > endMs) {
        // Carry forward final state
        f.vad = { ...targetVAD };
        const mods = vadToPhysiologicalModulations(f.vad, baselineF0);
        f.glottal.subglottalPressure = mods.pressure;
        f.glottal.glottalRd = mods.glottalRd;
        f.glottal.breathiness = mods.breathiness;
        f.glottal.f0 = baselineF0 * mods.f0Multiplier;
        f.glottal.tremorFrequency = mods.tremorFreq;
        f.glottal.tremorDepth = mods.tremorDepth;
        f.articulators.larynx = mods.larynxOffset;
        f.articulators.epilarynx = mods.epilarynx;
      }
    }
  }

  /**
   * Blends two trajectories with a weight w in [0, 1] (CoCoEmo style mixed emotions).
   */
  blendWith(other: VocalTrajectory, weight: number): VocalTrajectory {
    const w = Math.max(0.0, Math.min(1.0, weight));
    const blended = new VocalTrajectory(this.frameRateHz, this.sampleRate);

    const maxDur = Math.max(this.durationMs, other.durationMs);
    const dt = 1000.0 / this.frameRateHz;

    for (let t = 0; t <= maxDur; t += dt) {
      const fa = this.interpolateAt(t);
      const fb = other.interpolateAt(t);

      const lerp = (a: number, b: number) => a * (1 - w) + b * w;

      blended.addFrame({
        timeMs: t,
        phoneme: w < 0.5 ? fa.phoneme : fb.phoneme,
        word: w < 0.5 ? fa.word : fb.word,
        vad: {
          valence: lerp(fa.vad.valence, fb.vad.valence),
          arousal: lerp(fa.vad.arousal, fb.vad.arousal),
          dominance: lerp(fa.vad.dominance, fb.vad.dominance),
        },
        articulators: {
          jaw: lerp(fa.articulators.jaw, fb.articulators.jaw),
          tongueBodyX: lerp(fa.articulators.tongueBodyX, fb.articulators.tongueBodyX),
          tongueBodyY: lerp(fa.articulators.tongueBodyY, fb.articulators.tongueBodyY),
          tongueTipX: lerp(fa.articulators.tongueTipX, fb.articulators.tongueTipX),
          tongueTipY: lerp(fa.articulators.tongueTipY, fb.articulators.tongueTipY),
          tongueTipCurl: lerp(fa.articulators.tongueTipCurl, fb.articulators.tongueTipCurl),
          lipAperture: lerp(fa.articulators.lipAperture, fb.articulators.lipAperture),
          lipProtrusion: lerp(fa.articulators.lipProtrusion, fb.articulators.lipProtrusion),
          lipWidth: lerp(fa.articulators.lipWidth, fb.articulators.lipWidth),
          velum: lerp(fa.articulators.velum, fb.articulators.velum),
          larynx: lerp(fa.articulators.larynx, fb.articulators.larynx),
          epilarynx: lerp(fa.articulators.epilarynx, fb.articulators.epilarynx),
        },
        glottal: {
          f0: lerp(fa.glottal.f0, fb.glottal.f0),
          subglottalPressure: lerp(fa.glottal.subglottalPressure, fb.glottal.subglottalPressure),
          vocalFoldAdduction: lerp(fa.glottal.vocalFoldAdduction, fb.glottal.vocalFoldAdduction),
          glottalRd: lerp(fa.glottal.glottalRd, fb.glottal.glottalRd),
          openQuotient: lerp(fa.glottal.openQuotient, fb.glottal.openQuotient),
          spectralTilt: lerp(fa.glottal.spectralTilt, fb.glottal.spectralTilt),
          breathiness: lerp(fa.glottal.breathiness, fb.glottal.breathiness),
          creakiness: lerp(fa.glottal.creakiness, fb.glottal.creakiness),
          roughness: lerp(fa.glottal.roughness, fb.glottal.roughness),
          tremorFrequency: lerp(fa.glottal.tremorFrequency, fb.glottal.tremorFrequency),
          tremorDepth: lerp(fa.glottal.tremorDepth, fb.glottal.tremorDepth),
          voiced: w < 0.5 ? fa.glottal.voiced : fb.glottal.voiced,
        },
        acoustics: {
          formants: [
            lerp(fa.acoustics.formants[0], fb.acoustics.formants[0]),
            lerp(fa.acoustics.formants[1], fb.acoustics.formants[1]),
            lerp(fa.acoustics.formants[2], fb.acoustics.formants[2]),
            lerp(fa.acoustics.formants[3], fb.acoustics.formants[3]),
            lerp(fa.acoustics.formants[4], fb.acoustics.formants[4]),
          ],
          bandwidths: [
            lerp(fa.acoustics.bandwidths[0], fb.acoustics.bandwidths[0]),
            lerp(fa.acoustics.bandwidths[1], fb.acoustics.bandwidths[1]),
            lerp(fa.acoustics.bandwidths[2], fb.acoustics.bandwidths[2]),
            lerp(fa.acoustics.bandwidths[3], fb.acoustics.bandwidths[3]),
            lerp(fa.acoustics.bandwidths[4], fb.acoustics.bandwidths[4]),
          ],
          nasalPoles: [
            lerp(fa.acoustics.nasalPoles[0], fb.acoustics.nasalPoles[0]),
            lerp(fa.acoustics.nasalPoles[1], fb.acoustics.nasalPoles[1]),
          ],
          nasalZeros: [
            lerp(fa.acoustics.nasalZeros[0], fb.acoustics.nasalZeros[0]),
            lerp(fa.acoustics.nasalZeros[1], fb.acoustics.nasalZeros[1]),
          ],
        },
        prosody: {
          speakingRate: lerp(fa.prosody.speakingRate, fb.prosody.speakingRate),
          stress: lerp(fa.prosody.stress, fb.prosody.stress),
          loudness: lerp(fa.prosody.loudness, fb.prosody.loudness),
          durationMs: lerp(fa.prosody.durationMs, fb.prosody.durationMs),
        },
        nonverbal: w < 0.5 ? fa.nonverbal : fb.nonverbal,
      });
    }

    return blended;
  }

  // Sample-rate extraction vectors
  getF0Vector(targetSampleRate: number = 48000): Float32Array {
    const totalSamples = Math.ceil((this.durationMs / 1000.0) * targetSampleRate);
    const out = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const tMs = (i / targetSampleRate) * 1000.0;
      out[i] = this.interpolateAt(tMs).glottal.f0;
    }
    return out;
  }

  getPressureVector(targetSampleRate: number = 48000): Float32Array {
    const totalSamples = Math.ceil((this.durationMs / 1000.0) * targetSampleRate);
    const out = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const tMs = (i / targetSampleRate) * 1000.0;
      out[i] = this.interpolateAt(tMs).glottal.subglottalPressure;
    }
    return out;
  }

  getRdVector(targetSampleRate: number = 48000): Float32Array {
    const totalSamples = Math.ceil((this.durationMs / 1000.0) * targetSampleRate);
    const out = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const tMs = (i / targetSampleRate) * 1000.0;
      out[i] = this.interpolateAt(tMs).glottal.glottalRd;
    }
    return out;
  }
}
