import { describe, it, expect } from "bun:test";
import {
  VocalTrajectory,
  vadToPhysiologicalModulations,
  DEFAULT_VAD,
  DEFAULT_ARTICULATORS,
  DEFAULT_GLOTTAL,
  DEFAULT_ACOUSTICS,
  DEFAULT_PROSODIC,
  type ContinuousVAD,
} from "../src/synthesis/vocal_trajectory.ts";

describe("Phase 2: Unified Vocal Control Trajectory", () => {
  it("maps continuous VAD to physiological vocal parameters correctly", () => {
    // 1. High Arousal + High Dominance (Tense / Hot Anger)
    const hotAngerVAD: ContinuousVAD = { valence: -0.6, arousal: 0.9, dominance: 0.8 };
    const angryPhys = vadToPhysiologicalModulations(hotAngerVAD, 120.0);
    expect(angryPhys.pressure).toBeGreaterThan(18.0); // High lung pressure Ps > 18 cmH2O
    expect(angryPhys.glottalRd).toBeLessThan(0.7);    // Pressed glottal phonation (tight adduction)
    expect(angryPhys.f0Multiplier).toBeGreaterThan(1.2); // Elevated pitch
    expect(angryPhys.epilarynx).toBeGreaterThan(0.5); // Epilaryngeal constriction

    // 2. Low Arousal + Low Dominance (Quiet Dejection / Grief)
    const sadVAD: ContinuousVAD = { valence: -0.8, arousal: 0.1, dominance: -0.6 };
    const sadPhys = vadToPhysiologicalModulations(sadVAD, 120.0);
    expect(sadPhys.pressure).toBeLessThan(7.0);       // Collapsed lung pressure Ps < 7 cmH2O
    expect(sadPhys.glottalRd).toBeGreaterThan(1.6);    // Breathy, lax vocal folds
    expect(sadPhys.breathiness).toBeGreaterThan(0.15); // Audible aspiration
    expect(sadPhys.rateMultiplier).toBeLessThan(0.9); // Sluggish speaking rate

    // 3. High Arousal + Low Dominance (Shaky Anxiety / Panic)
    const anxietyVAD: ContinuousVAD = { valence: -0.5, arousal: 0.85, dominance: -0.7 };
    const anxPhys = vadToPhysiologicalModulations(anxietyVAD, 120.0);
    expect(anxPhys.tremorDepth).toBeGreaterThan(0.2); // Active physiological tremor
    expect(anxPhys.tremorFreq).toBeGreaterThan(7.0);   // 7.5 - 9.0 Hz tremor
    expect(anxPhys.tremorFreq).toBeLessThan(10.0);
  });

  it("constructs a trajectory and performs C1 continuous hermite interpolation with zero discontinuities", () => {
    const traj = new VocalTrajectory(200, 48000);

    // Frame 0: Neutral onset
    traj.addFrame({
      timeMs: 0,
      vad: { valence: 0.0, arousal: 0.2, dominance: 0.0 },
      articulators: { ...DEFAULT_ARTICULATORS, jaw: 0.2 },
      glottal: { ...DEFAULT_GLOTTAL, f0: 120.0, subglottalPressure: 8.0 },
      acoustics: { ...DEFAULT_ACOUSTICS, formants: [500, 1500, 2500, 3500, 4500] },
      prosody: { ...DEFAULT_PROSODIC },
    });

    // Frame 1: Reaches peak emphasis at 200ms
    traj.addFrame({
      timeMs: 200,
      vad: { valence: 0.4, arousal: 0.7, dominance: 0.5 },
      articulators: { ...DEFAULT_ARTICULATORS, jaw: 0.7 },
      glottal: { ...DEFAULT_GLOTTAL, f0: 180.0, subglottalPressure: 15.0 },
      acoustics: { ...DEFAULT_ACOUSTICS, formants: [750, 1300, 2400, 3500, 4500] },
      prosody: { ...DEFAULT_PROSODIC, speakingRate: 1.2 },
    });

    expect(traj.durationMs).toBe(200);

    // Sample at intermediate point 100ms
    const mid = traj.interpolateAt(100);
    expect(mid.glottal.f0).toBeCloseTo(150.0, 1);
    expect(mid.glottal.subglottalPressure).toBeCloseTo(11.5, 1);
    expect(mid.articulators.jaw).toBeCloseTo(0.45, 1);
    expect(mid.acoustics.formants[0]).toBeCloseTo(625.0, 1);

    // Verify vector extraction
    const f0Vec = traj.getF0Vector(48000);
    expect(f0Vec.length).toBe(Math.ceil((200 / 1000) * 48000));
    expect(f0Vec[0]).toBeCloseTo(120.0, 1);
    expect(f0Vec[f0Vec.length - 1]).toBeCloseTo(180.0, 1);
  });

  it("executes smooth intra-utterance emotional transitions (EmoTra-TTS style)", () => {
    const traj = new VocalTrajectory(100, 48000);
    for (let t = 0; t <= 1000; t += 100) {
      traj.addFrame({
        timeMs: t,
        vad: { valence: 0.2, arousal: 0.3, dominance: 0.1 }, // Starts neutral/polite
        articulators: { ...DEFAULT_ARTICULATORS },
        glottal: { ...DEFAULT_GLOTTAL, f0: 125.0, subglottalPressure: 8.0 },
        acoustics: { ...DEFAULT_ACOUSTICS },
        prosody: { ...DEFAULT_PROSODIC },
      });
    }

    // Shift emotion mid-sentence: transition from polite to bitter sarcasm/dejection between 400ms and 800ms
    const targetVAD: ContinuousVAD = { valence: -0.7, arousal: 0.2, dominance: -0.5 };
    traj.applyIntraUtteranceTransition(400, 800, targetVAD, 125.0);

    const fEarly = traj.interpolateAt(200);
    const fTransition = traj.interpolateAt(600);
    const fLate = traj.interpolateAt(900);

    expect(fEarly.vad.valence).toBeCloseTo(0.2, 1);
    expect(fLate.vad.valence).toBeCloseTo(-0.7, 1);
    // At midpoint of transition, valence should be intermediate
    expect(fTransition.vad.valence).toBeLessThan(0.0);
    expect(fTransition.vad.valence).toBeGreaterThan(-0.7);
    // Glottal Rd should have expanded (laxer/breathier)
    expect(fLate.glottal.glottalRd).toBeGreaterThan(fEarly.glottal.glottalRd);
  });

  it("blends two distinct trajectories for mixed emotions (CoCoEmo style)", () => {
    const trajA = new VocalTrajectory(100, 48000);
    const trajB = new VocalTrajectory(100, 48000);

    for (let t = 0; t <= 500; t += 100) {
      trajA.addFrame({
        timeMs: t,
        vad: { valence: 0.5, arousal: 0.8, dominance: 0.6 }, // Joy/confidence
        articulators: { ...DEFAULT_ARTICULATORS },
        glottal: { ...DEFAULT_GLOTTAL, f0: 160.0 },
        acoustics: { ...DEFAULT_ACOUSTICS },
        prosody: { ...DEFAULT_PROSODIC },
      });
      trajB.addFrame({
        timeMs: t,
        vad: { valence: -0.5, arousal: 0.8, dominance: -0.6 }, // Anxiety
        articulators: { ...DEFAULT_ARTICULATORS },
        glottal: { ...DEFAULT_GLOTTAL, f0: 200.0, tremorDepth: 0.3 },
        acoustics: { ...DEFAULT_ACOUSTICS },
        prosody: { ...DEFAULT_PROSODIC },
      });
    }

    // Blend 70% A + 30% B (nervous excitement)
    const blended = trajA.blendWith(trajB, 0.3);
    const mid = blended.interpolateAt(250);

    expect(mid.vad.valence).toBeCloseTo(0.5 * 0.7 + (-0.5) * 0.3, 2);
    expect(mid.glottal.f0).toBeCloseTo(160.0 * 0.7 + 200.0 * 0.3, 1);
    expect(mid.glottal.tremorDepth).toBeCloseTo(0.3 * 0.3, 2);
  });
});
