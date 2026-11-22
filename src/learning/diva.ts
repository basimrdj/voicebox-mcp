/**
 * DIVA Sensorimotor Learning & Auditory Feedback Engine
 * Implements Frank Guenther's DIVA Model (Directions Into Velocities of Articulators)
 * and Curiosity-Driven Developmental Babbling (Oudeyer & Kaplan).
 * 
 * Enables an embodied AI agent to:
 * 1. Calculate auditory errors between heard sound and phonetic acoustic targets (e_auditory = y_target - y_heard).
 * 2. Compute the local articulatory-to-acoustic Jacobian matrix J = dy/dx via finite differences.
 * 3. Solve the damped pseudo-inverse motor correction: delta x = alpha * J^dagger * e_auditory.
 * 4. Actively practice, adapt motor effectors over episodes, and converge on target vowels and words.
 */

import {
  BioNavbSynthesizer,
  DEFAULT_ARTICULATORS,
  DEFAULT_LARYNGEAL,
  IPA_ACOUSTIC_PROFILES,
  type ArticulatorState,
} from "../synthesis/neural_engine.ts";
import { analyzeAudio } from "../analysis/perception.ts";
import { toBase64Wav } from "../vault/audio.ts";

export interface DivaTarget {
  f1: number;
  f2: number;
  f3?: number;
  f0?: number;
}

export interface DivaEpisode {
  episode: number;
  articulators: Partial<ArticulatorState>;
  heardFormants: number[];
  errorHz: {
    f1: number;
    f2: number;
    f3?: number;
    euclidean: number;
  };
  errorBark: number;
  motorDelta: Partial<ArticulatorState>;
}

export interface DivaLearningResult {
  target: DivaTarget;
  initialArticulators: Partial<ArticulatorState>;
  learnedArticulators: Partial<ArticulatorState>;
  initialErrorHz: number;
  finalErrorHz: number;
  improvementPercentage: number;
  episodes: DivaEpisode[];
  converged: boolean;
  initialAudioBase64?: string;
  finalAudioBase64?: string;
}

export interface CuriosityBabbleStep {
  step: number;
  posture: Partial<ArticulatorState>;
  formants: number[];
  f0: number;
  hnrDb: number;
  closestPhoneme: string;
  competenceProgress: number;
}

export interface CuriosityBabbleResult {
  totalSteps: number;
  discoveredVowelQuadrilateral: {
    highFront_i: { posture: Partial<ArticulatorState>; formants: number[] };
    lowFront_ae: { posture: Partial<ArticulatorState>; formants: number[] };
    lowBack_a: { posture: Partial<ArticulatorState>; formants: number[] };
    highBack_u: { posture: Partial<ArticulatorState>; formants: number[] };
  };
  explorationSteps: CuriosityBabbleStep[];
  audioBase64?: string;
}

/**
 * Convert frequency in Hz to Bark psychoacoustic scale (Traunmüller 1990).
 */
export function hzToBark(freqHz: number): number {
  return (26.81 * freqHz) / (1960.0 + freqHz) - 0.53;
}

/**
 * 6 Key articulators most active in vowel and resonant vocalic modulation.
 */
const CONTROLLABLE_KEYS: (keyof ArticulatorState)[] = [
  "jaw",
  "tbX",
  "tbY",
  "ttY",
  "lipAp",
  "lipProt",
  "larynx",
];

export class DivaMotorLearner {
  private synth: BioNavbSynthesizer;
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
    this.synth = new BioNavbSynthesizer(sampleRate);
  }

  /**
   * Forward kinematics: Articulators -> Auditory Formants (F1, F2, F3).
   */
  forwardKinematics(
    artic: Partial<ArticulatorState>,
    body: { female: number; child: number } = { female: 0.0, child: 0.0 }
  ): [number, number, number] {
    const full: ArticulatorState = { ...DEFAULT_ARTICULATORS, ...artic };
    const { formants } = this.synth.evaluateFormantsFromArticulators(full, body);
    return [formants[0], formants[1], formants[2]];
  }

  /**
   * Compute the Jacobian matrix J = d(F1, F2, F3) / d(x_keys) numerically.
   */
  computeJacobian(
    artic: ArticulatorState,
    body: { female: number; child: number },
    keys: (keyof ArticulatorState)[] = CONTROLLABLE_KEYS,
    eps: number = 0.04
  ): number[][] {
    const m = 3; // F1, F2, F3
    const n = keys.length;
    const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

    for (let j = 0; j < n; j++) {
      const key = keys[j];
      const origVal = artic[key];

      // Forward perturbation
      const forwardArtic = { ...artic, [key]: Math.min(1.0, origVal + eps) };
      const [f1Plus, f2Plus, f3Plus] = this.forwardKinematics(forwardArtic, body);

      // Backward perturbation
      const backwardArtic = { ...artic, [key]: Math.max(-1.0, origVal - eps) };
      const [f1Minus, f2Minus, f3Minus] = this.forwardKinematics(backwardArtic, body);

      const delta = Math.max(1e-5, forwardArtic[key] - backwardArtic[key]);
      J[0][j] = (f1Plus - f1Minus) / delta;
      J[1][j] = (f2Plus - f2Minus) / delta;
      J[2][j] = (f3Plus - f3Minus) / delta;
    }

    return J;
  }

  /**
   * Compute Moore-Penrose pseudo-inverse with Levenberg-Marquardt regularization:
   * J^dagger = J^T * (J * J^T + lambda * I)^-1
   */
  solveDampedInverse(J: number[][], errorVec: number[], lambda: number = 1e-4): number[] {
    const m = J.length; // 3
    const n = J[0].length; // number of articulators

    // Compute A = J * J^T (3x3)
    const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += J[i][k] * J[j][k];
        }
        A[i][j] = sum + (i === j ? lambda : 0);
      }
    }

    // Invert 3x3 matrix A analytically
    const invA = this.invert3x3(A);

    // v = invA * errorVec (3x1)
    const v = [
      invA[0][0] * errorVec[0] + invA[0][1] * errorVec[1] + invA[0][2] * errorVec[2],
      invA[1][0] * errorVec[0] + invA[1][1] * errorVec[1] + invA[1][2] * errorVec[2],
      invA[2][0] * errorVec[0] + invA[2][1] * errorVec[1] + invA[2][2] * errorVec[2],
    ];

    // deltaX = J^T * v (n x 1)
    const deltaX = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let i = 0; i < m; i++) {
        sum += J[i][j] * v[i];
      }
      deltaX[j] = sum;
    }

    return deltaX;
  }

  private invert3x3(m: number[][]): number[][] {
    const [
      [a, b, c],
      [d, e, f],
      [g, h, k],
    ] = m;

    const A = e * k - f * h;
    const B = -(d * k - f * g);
    const C = d * h - e * g;
    const D = -(b * k - c * h);
    const E = a * k - c * g;
    const F = -(a * h - b * g);
    const G = b * f - c * e;
    const H = -(a * f - c * d);
    const K = a * e - b * d;

    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-9) {
      // Near-singular fallback: diagonal identity
      return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
    }

    const invDet = 1.0 / det;
    return [
      [A * invDet, D * invDet, G * invDet],
      [B * invDet, E * invDet, H * invDet],
      [C * invDet, F * invDet, K * invDet],
    ];
  }

  /**
   * Closed-loop sensorimotor learning: Iteratively adapts articulators to hit acoustic target.
   */
  learnArticulatoryTarget(
    targetInput: DivaTarget | string,
    initialArtic: Partial<ArticulatorState> = {},
    maxEpisodes: number = 8,
    learningRate: number = 0.45,
    body: { female: number; child: number } = { female: 0.0, child: 0.0 }
  ): DivaLearningResult {
    // Resolve target formants (from explicit object or phonetic IPA profile)
    let target: DivaTarget;
    if (typeof targetInput === "string") {
      const profile = IPA_ACOUSTIC_PROFILES[targetInput.trim()] || IPA_ACOUSTIC_PROFILES["i"];
      target = {
        f1: profile.formants[0],
        f2: profile.formants[1],
        f3: profile.formants[2],
      };
    } else {
      target = targetInput;
    }

    const targetF1 = Math.max(150, Math.min(1200, isNaN(target.f1) ? 500 : target.f1));
    const targetF2 = Math.max(500, Math.min(3000, isNaN(target.f2) ? 1500 : target.f2));
    const targetF3 = Math.max(1200, Math.min(4000, isNaN(target.f3 ?? 2500) ? 2500 : (target.f3 ?? 2500)));

    const currentArtic: ArticulatorState = { ...DEFAULT_ARTICULATORS };
    if (initialArtic) {
      for (const [k, v] of Object.entries(initialArtic)) {
        if (typeof v === "number" && !isNaN(v) && k in currentArtic) {
          (currentArtic as any)[k] = Math.max(-1.0, Math.min(1.0, v));
        }
      }
    }

    const episodes: DivaEpisode[] = [];
    const keys = CONTROLLABLE_KEYS;

    // Render initial sound for auditory verification
    const initialAudio = this.synth.synthesizePosture(currentArtic, 180);
    const initialBase64 = toBase64Wav(initialAudio, this.sampleRate);

    let initialErrorHz = 0;
    let finalErrorHz = 0;

    for (let ep = 0; ep < maxEpisodes; ep++) {
      // 1. Synthesize probe and perceive heard formants
      const [f1Heard, f2Heard, f3Heard] = this.forwardKinematics(currentArtic, body);

      // 2. Compute auditory error vector e = y_target - y_heard
      const e1 = targetF1 - f1Heard;
      const e2 = targetF2 - f2Heard;
      const e3 = targetF3 - f3Heard;

      const euclideanHz = Math.sqrt(e1 * e1 + e2 * e2 + (e3 * 0.3) * (e3 * 0.3));
      const errorBark = Math.sqrt(
        Math.pow(hzToBark(targetF1) - hzToBark(f1Heard), 2) +
        Math.pow(hzToBark(targetF2) - hzToBark(f2Heard), 2)
      );

      if (ep === 0) initialErrorHz = euclideanHz;
      finalErrorHz = euclideanHz;

      // 3. Compute Jacobian matrix
      const J = this.computeJacobian(currentArtic, body, keys);

      // 4. Solve damped least squares for motor delta
      const deltaVec = this.solveDampedInverse(J, [e1, e2, e3]);

      // 5. Update articulators
      const motorDelta: Partial<ArticulatorState> = {};
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j];
        // Scale step with learning rate and clamp to reasonable single-step magnitude
        const rawStep = isNaN(deltaVec[j]) ? 0 : deltaVec[j] * learningRate;
        const step = Math.max(-0.25, Math.min(0.25, rawStep));
        currentArtic[k] = Math.max(-1.0, Math.min(1.0, currentArtic[k] + step));
        motorDelta[k] = Math.round(step * 1000) / 1000;
      }

      episodes.push({
        episode: ep + 1,
        articulators: { ...currentArtic },
        heardFormants: [Math.round(f1Heard), Math.round(f2Heard), Math.round(f3Heard)],
        errorHz: {
          f1: Math.round(e1),
          f2: Math.round(e2),
          f3: Math.round(e3),
          euclidean: Math.round(euclideanHz),
        },
        errorBark: Math.round(errorBark * 100) / 100,
        motorDelta,
      });

      // Stop early if converged within 25 Hz
      if (euclideanHz < 25.0) break;
    }

    // Render final sound after learning
    const finalAudio = this.synth.synthesizePosture(currentArtic, 180);
    const finalBase64 = toBase64Wav(finalAudio, this.sampleRate);

    const improvement = initialErrorHz > 0
      ? Math.max(0, Math.round(((initialErrorHz - finalErrorHz) / initialErrorHz) * 100))
      : 100;

    return {
      target,
      initialArticulators: { ...initialArtic },
      learnedArticulators: { ...currentArtic },
      initialErrorHz: Math.round(initialErrorHz),
      finalErrorHz: Math.round(finalErrorHz),
      improvementPercentage: improvement,
      episodes,
      converged: finalErrorHz < 60.0,
      initialAudioBase64: initialBase64,
      finalAudioBase64: finalBase64,
    };
  }

  /**
   * Curiosity-driven developmental motor babbling.
   * Explores the articulatory space and discovers cardinal vowel anchors.
   */
  curiosityBabble(
    numSteps: number = 16,
    body: { female: number; child: number } = { female: 0.0, child: 0.0 }
  ): CuriosityBabbleResult {
    const steps: CuriosityBabbleStep[] = [];
    const audioChunks: Float32Array[] = [];

    let prevCompetence = 0.0;

    // Discovery tracking for cardinal anchors
    let best_i = { dist: Infinity, posture: {}, formants: [0, 0, 0] };
    let best_a = { dist: Infinity, posture: {}, formants: [0, 0, 0] };
    let best_u = { dist: Infinity, posture: {}, formants: [0, 0, 0] };
    let best_ae = { dist: Infinity, posture: {}, formants: [0, 0, 0] };

    // Cardinal targets
    const target_i = [280, 2280];
    const target_a = [730, 1450];
    const target_u = [300, 870];
    const target_ae = [660, 1720];

    for (let s = 0; s < numSteps; s++) {
      // Systematic babbling sweeping the articulatory manifold
      const u = s / (numSteps - 1 || 1);
      const angle = u * 2 * Math.PI;

      // Motor babbling postures
      const jaw = 0.5 * Math.sin(angle);
      const tbX = 0.6 * Math.cos(angle);
      const tbY = 0.5 * Math.sin(angle + 0.5);
      const lipProt = Math.max(0, -0.4 * tbX);

      const posture: Partial<ArticulatorState> = {
        jaw: Math.round(jaw * 100) / 100,
        tbX: Math.round(tbX * 100) / 100,
        tbY: Math.round(tbY * 100) / 100,
        lipProt: Math.round(lipProt * 100) / 100,
      };

      // Synthesize micro-burst of sound (80ms)
      const chunk = this.synth.synthesizePosture(posture, 80);
      audioChunks.push(chunk);

      // Auditory perception
      const perception = analyzeAudio(chunk, this.sampleRate);
      const [f1, f2] = perception.formants;

      // Find closest phonemic label
      let closestPhoneme = "ə";
      let minDist = Infinity;
      for (const [phoneme, prof] of Object.entries(IPA_ACOUSTIC_PROFILES)) {
        if (prof.formants) {
          const d = Math.hypot(prof.formants[0] - f1, prof.formants[1] - f2);
          if (d < minDist) {
            minDist = d;
            closestPhoneme = phoneme;
          }
        }
      }

      // Update cardinal discovered anchors
      const d_i = Math.hypot(target_i[0] - f1, target_i[1] - f2);
      if (d_i < best_i.dist) best_i = { dist: d_i, posture, formants: perception.formants };

      const d_a = Math.hypot(target_a[0] - f1, target_a[1] - f2);
      if (d_a < best_a.dist) best_a = { dist: d_a, posture, formants: perception.formants };

      const d_u = Math.hypot(target_u[0] - f1, target_u[1] - f2);
      if (d_u < best_u.dist) best_u = { dist: d_u, posture, formants: perception.formants };

      const d_ae = Math.hypot(target_ae[0] - f1, target_ae[1] - f2);
      if (d_ae < best_ae.dist) best_ae = { dist: d_ae, posture, formants: perception.formants };

      // Competence progress metric: rate of information acquisition
      const currentCompetence = 1000.0 / (minDist + 50.0);
      const competenceProgress = Math.round((currentCompetence - prevCompetence) * 100) / 100;
      prevCompetence = currentCompetence;

      steps.push({
        step: s + 1,
        posture,
        formants: perception.formants,
        f0: perception.f0,
        hnrDb: perception.hnrDb,
        closestPhoneme,
        competenceProgress,
      });
    }

    // Concatenate babbling audio stream
    const totalSamples = audioChunks.reduce((acc, c) => acc + c.length, 0);
    const combinedAudio = new Float32Array(totalSamples);
    let offset = 0;
    for (const c of audioChunks) {
      combinedAudio.set(c, offset);
      offset += c.length;
    }

    return {
      totalSteps: numSteps,
      discoveredVowelQuadrilateral: {
        highFront_i: { posture: best_i.posture, formants: best_i.formants },
        lowFront_ae: { posture: best_ae.posture, formants: best_ae.formants },
        lowBack_a: { posture: best_a.posture, formants: best_a.formants },
        highBack_u: { posture: best_u.posture, formants: best_u.formants },
      },
      explorationSteps: steps,
      audioBase64: toBase64Wav(combinedAudio, this.sampleRate),
    };
  }
}
