import { describe, it, expect } from "bun:test";
import { SynthesisOrchestrator } from "../src/synthesis/synthesis_orchestrator.ts";

describe("Phase 3 & 4: Physically Controlled Synthesis & Contextual Prosody", () => {
  const orchestrator = new SynthesisOrchestrator();

  it("synthesizes the benchmark sentence across distinct communicative intents with identical words", async () => {
    const text = "I am completely fine with this decision.";

    // 1. Neutral baseline
    const neutral = await orchestrator.synthesizeSpeech({
      text,
      intent: "neutral",
      engine: "ddsp",
    });

    // 2. Sarcasm (tonic elongation, rise-fall pitch accent)
    const sarcasm = await orchestrator.synthesizeSpeech({
      text,
      intent: "sarcasm",
      intensity: 0.85,
      engine: "ddsp",
    });

    // 3. Curiosity (interrogative terminal glide L-H%)
    const curiosity = await orchestrator.synthesizeSpeech({
      text,
      intent: "curiosity",
      intensity: 0.8,
      engine: "ddsp",
    });

    // 4. Annoyance (tight vocal folds, accelerated rate, high Ps)
    const annoyance = await orchestrator.synthesizeSpeech({
      text,
      intent: "annoyance",
      intensity: 0.8,
      engine: "ddsp",
    });

    // 5. Sadness / Dejection (low Ps, high Rd breathiness, slower rate)
    const sadness = await orchestrator.synthesizeSpeech({
      text,
      intent: "sadness",
      intensity: 0.8,
      engine: "ddsp",
    });

    // Assert that audio waveforms are generated with non-zero samples
    expect(neutral.samples.length).toBeGreaterThan(0);
    expect(sarcasm.samples.length).toBeGreaterThan(0);
    expect(curiosity.samples.length).toBeGreaterThan(0);
    expect(annoyance.samples.length).toBeGreaterThan(0);
    expect(sadness.samples.length).toBeGreaterThan(0);

    // Assert duration differences reflecting communicative intent:
    // Sarcasm prolongs tonic syllable, so sarcasm duration should be longer than neutral
    expect(sarcasm.durationMs).toBeGreaterThan(neutral.durationMs);

    // Sadness slow lethargic rate makes it longer than annoyance
    expect(sadness.durationMs).toBeGreaterThan(annoyance.durationMs);

    // Curiosity terminal pitch should be elevated above neutral
    const curEndF0 = curiosity.trajectory.interpolateAt(curiosity.durationMs - 50).glottal.f0;
    const neutEndF0 = neutral.trajectory.interpolateAt(neutral.durationMs - 50).glottal.f0;
    expect(curEndF0).toBeGreaterThan(neutEndF0 * 1.2);
    expect(curiosity.perception.f0).toBeGreaterThan(0);
  });

  it("executes smooth intra-utterance emotion transitions mid-sentence", async () => {
    const text = "I am completely fine with this decision.";

    // Utterance begins with polite/neutral agreement and transitions to bitter dejection on the last 3 words
    const res = await orchestrator.synthesizeSpeech({
      text,
      intent: "neutral",
      transitions: [
        {
          fromWordIndex: 3, // "fine"
          toWordIndex: 6,   // "decision"
          targetVAD: { valence: -0.8, arousal: 0.1, dominance: -0.6 }, // Quiet dejection
        },
      ],
      engine: "ddsp",
    });

    expect(res.durationMs).toBeGreaterThan(1000);
    expect(res.base64Wav.length).toBeGreaterThan(100);

    // Inspect trajectory: early frames should have near-neutral Rd, late frames should have high Rd
    const earlyFrame = res.trajectory.interpolateAt(200);
    const lateFrame = res.trajectory.interpolateAt(res.durationMs - 200);

    expect(earlyFrame.glottal.glottalRd).toBeLessThan(lateFrame.glottal.glottalRd);
  });

  it("inserts contextually aligned nonverbal vocalizations seamlessly", async () => {
    const text = "I am completely fine with this decision.";

    const resWithSigh = await orchestrator.synthesizeSpeech({
      text,
      intent: "relief",
      nonverbal: "sigh",
      nonverbalPosition: "onset",
      engine: "ddsp",
    });

    const resStandard = await orchestrator.synthesizeSpeech({
      text,
      intent: "relief",
      engine: "ddsp",
    });

    // Utterance with onset sigh should be longer by roughly the sigh duration
    expect(resWithSigh.durationMs).toBeGreaterThan(resStandard.durationMs + 250);
  });
});
