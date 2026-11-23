import { describe, it, expect } from "bun:test";
import { DivaUtteranceCalibrator } from "../src/learning/diva_utterance_calibration.ts";

describe("Phase 5: DIVA Closed-Loop Utterance Calibration", () => {
  const calibrator = new DivaUtteranceCalibrator();

  it("converges toward target acoustic parameters across calibration episodes", async () => {
    // Target: a warm, elevated female-range pitch target with clear formants
    const target = {
      targetF0: 175.0, // target 175 Hz from 125 Hz baseline
      targetF1: 580.0,
      targetF2: 1720.0,
      targetHnrDb: 18.0,
    };

    const result = await calibrator.calibrateUtterance(
      "I am completely fine with this decision.",
      target,
      4, // 4 iterations
      0.5 // learning rate
    );

    expect(result.totalIterations).toBeGreaterThan(1);
    expect(result.episodes.length).toBe(result.totalIterations);

    // Initial pitch error should be reduced in final episode
    const initialF0Err = Math.abs(result.episodes[0].errorF0Hz);
    const finalF0Err = Math.abs(result.episodes[result.episodes.length - 1].errorF0Hz);
    expect(finalF0Err).toBeLessThan(initialF0Err);

    // Formant error should improve or stabilize
    expect(result.improvementPercentage).toBeGreaterThanOrEqual(0.0);

    // Check calibrated profile offsets
    expect(result.calibratedProfile.f0Offset).toBeGreaterThan(10.0); // F0 was pushed upward toward 175 Hz
  });

  it("saves calibrated voice profile to disk successfully", () => {
    const profile = {
      f0Offset: 25.4,
      jawOffset: 0.12,
      tbXOffset: -0.08,
      tbYOffset: 0.15,
      larynxOffset: -0.10,
      pressureOffset: 1.5,
      rdOffset: -0.12,
    };

    const savedPath = calibrator.saveProfileToVault(profile);
    expect(savedPath).toContain("calibrated_voice_profile.json");
  });
});
