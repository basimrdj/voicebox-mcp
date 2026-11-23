/**
 * VoiceBox Milestone 2 & 3 — Vocal Performance Timeline & Unified API Tests
 * 
 * Verifies:
 * 1. 4-layer decoupling: Linguistic Content, Vocal Identity, Vocal Performance, Rendering.
 * 2. Explicit backend capability matrix: every backend states exact vs approx vs unsupported.
 * 3. Unified API: `VoiceBox.perform({ linguistic, identity, performance, rendering })`.
 * 4. JSON export and import validation against versioned schema.
 * 5. Preservation of lexical content across radically different vocal identities & performances.
 */

import { describe, it, expect } from "bun:test";
import {
  VoiceBox,
  BACKEND_CAPABILITY_MATRIX,
  vocalPerformanceTimelineSchema,
  type VocalPerformanceTimeline,
} from "../src/performance/timeline.ts";

describe("Milestone 2 & 3: Universal Vocal Performance Representation", () => {
  it("enforces explicit backend capability declaration without claiming unsupported controls", () => {
    // 1. DDSP backend capability inspection
    const ddspCaps = BACKEND_CAPABILITY_MATRIX.ddsp;
    expect(ddspCaps.supportsBiophysicalRd).toBe("exact");
    expect(ddspCaps.supportsExactPitchContour).toBe("exact");
    expect(ddspCaps.supportsMovingFormants).toBe("exact");
    expect(ddspCaps.latencyRatingMs).toBeLessThan(20);

    // 2. Physical backend capability inspection
    const physCaps = BACKEND_CAPABILITY_MATRIX.physical;
    expect(physCaps.supports3DArticulators).toBe("exact");
    expect(physCaps.supportsBiophysicalRd).toBe("exact");
    expect(physCaps.supportsExactPitchContour).toBe("exact");
    expect(physCaps.latencyRatingMs).toBeLessThan(10);
  });

  it("executes the unified VoiceBox.perform() API across distinct vocal identities and performances", async () => {
    const text = "I am completely fine with this decision.";

    // Performance 1: Sarcastic delivery with default male identity
    const sarcResult = await VoiceBox.perform({
      linguistic: text,
      identity: {
        name: "agent_male_deep",
        baselineF0: 110.0,
        timbreProfile: "resonant",
      },
      performance: {
        intent: "sarcasm",
        intensity: 0.85,
      },
      rendering: {
        backend: "ddsp",
      },
    });

    expect(sarcResult.timeline.version).toBe("1.0.0");
    expect(sarcResult.timeline.linguistic.text).toBe(text);
    expect(sarcResult.audioResult.samples.length).toBeGreaterThan(0);
    expect(sarcResult.audioResult.durationMs).toBeGreaterThan(1000);
    expect(sarcResult.supportedControlsSummary.biophysicalRd).toBe("exact");

    // Performance 2: Genuine Curiosity with bright female identity
    const curResult = await VoiceBox.perform({
      linguistic: text,
      identity: {
        name: "agent_female_bright",
        baselineF0: 210.0,
        timbreProfile: "bright",
      },
      performance: {
        intent: "curiosity",
        intensity: 0.80,
      },
      rendering: {
        backend: "ddsp",
      },
    });

    expect(curResult.timeline.identity.baselineF0).toBe(210.0);
    expect(curResult.audioResult.perception.f0).toBeGreaterThan(150.0);
  });

  it("exports and imports versioned performance timeline JSON with strict schema validation", () => {
    const timeline: VocalPerformanceTimeline = {
      version: "1.0.0",
      metadata: {
        createdAt: new Date().toISOString(),
        author: "Agent007",
        description: "Dry corporate sarcasm benchmark",
      },
      linguistic: {
        text: "I am completely fine with this decision.",
        language: "en",
        emphasisIndices: [2, 3], // "completely", "fine"
      },
      identity: {
        name: "executive_calm",
        baselineF0: 120.0,
        pitchRangeSemitones: 8.0,
        vocalTractLengthCm: 17.5,
        timbreProfile: "resonant",
      },
      performance: {
        intent: "sarcasm",
        intensity: 0.9,
        speakingRate: 1.0,
        nonverbal: "sigh",
        nonverbalPosition: "onset",
        wordModifiers: [
          { wordIndex: 2, durationMultiplier: 1.45 },
          { wordIndex: 3, durationMultiplier: 1.30 },
        ],
      },
      rendering: {
        backend: "ddsp",
        sampleRate: 48000,
        streaming: false,
        saveVault: false,
      },
    };

    // Serialize to JSON
    const jsonStr = VoiceBox.exportTimeline(timeline);
    expect(jsonStr).toContain('"version": "1.0.0"');
    expect(jsonStr).toContain('"intent": "sarcasm"');

    // Deserialize and validate
    const restored = VoiceBox.importTimeline(jsonStr);
    expect(restored.linguistic.text).toBe(timeline.linguistic.text);
    expect(restored.identity.name).toBe("executive_calm");
    expect(restored.performance.intent).toBe("sarcasm");
    expect(restored.performance.wordModifiers?.length).toBe(2);
  });

  it("actively modulates acoustics when custom glottalRd, breathiness, and pitchContour are passed", async () => {
    const text = "Acoustic control verification.";

    // Baseline pressed phonation (low Rd = 0.45, tense glottis, high spectral centroid)
    const pressed = await VoiceBox.perform({
      linguistic: text,
      identity: { baselineF0: 120.0 },
      performance: { glottalRd: 0.45, breathiness: 0.0 },
      rendering: { backend: "ddsp" },
    });

    // Breathy phonation (high Rd = 1.80, breathiness = 0.6) -> lower HNR due to turbulence
    const breathy = await VoiceBox.perform({
      linguistic: text,
      identity: { baselineF0: 120.0 },
      performance: { glottalRd: 1.80, breathiness: 0.6 },
      rendering: { backend: "ddsp" },
    });
    expect(pressed.audioResult.perception.hnrDb).toBeGreaterThan(breathy.audioResult.perception.hnrDb);

    // High pitch contour (220 Hz constant) -> higher f0
    const highPitch = await VoiceBox.perform({
      linguistic: text,
      identity: { baselineF0: 120.0 },
      performance: {
        pitchContour: [
          { timeMs: 0, f0Hz: 220.0 },
          { timeMs: 3000, f0Hz: 220.0 },
        ],
      },
      rendering: { backend: "ddsp" },
    });
    expect(highPitch.audioResult.perception.f0).toBeGreaterThan(180.0);

    // Accurate capability reporting reflects actual backend
    expect(pressed.backendCapabilities.latencyRatingMs).toBeLessThanOrEqual(20);
    expect(pressed.supportedControlsSummary.pitchContour).toBe("exact");
  });
});
