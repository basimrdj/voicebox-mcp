import { describe, it, expect } from "bun:test";
import { VoiceBoxBenchmarkSuite, BENCHMARK_SENTENCE } from "../src/evaluation/benchmark_suite.ts";
import { BlindStudyFramework, type BlindStudyTrial } from "../src/evaluation/blind_study_framework.ts";

describe("Phase 6: Scientific Evaluation Suite & Blind Study Framework", () => {
  it("runs the full objective benchmark on the 7-word benchmark sentence", async () => {
    const suite = new VoiceBoxBenchmarkSuite();

    // Run a focused matrix across 2 speakers, 3 intents, 2 intensities = 12 trials
    const res = await suite.runFullBenchmark(
      ["neutral", "sarcasm", "annoyance"],
      [
        { name: "Male", baselineF0: 125.0, larynxOffset: 0.0 },
        { name: "Female", baselineF0: 215.0, larynxOffset: 0.35 },
      ],
      [0.4, 0.9]
    );

    expect(res.sentence).toBe("I am completely fine with this decision.");
    expect(res.wordCount).toBe(7);
    expect(res.totalTrials).toBe(12);
    expect(res.meanSynthesisLatencyMs).toBeLessThan(250.0); // Real-time sub-second latency
    expect(res.discontinuityFreeRate).toBeGreaterThan(90.0);
    expect(res.clippingFreeRate).toBe(100.0);

    // Verify female baseline F0 is higher than male
    expect(res.speakerAverages["Female"].meanF0).toBeGreaterThan(res.speakerAverages["Male"].meanF0 * 1.4);
  });

  it("calculates Wilson 95% confidence intervals and confusion matrix in the blind study framework", () => {
    const framework = new BlindStudyFramework();

    // Simulate 20 randomized trials across 2 conditions
    const mockTrials: BlindStudyTrial[] = [
      {
        trialId: "t-1",
        participantId: "p-01",
        audioStimulusId: "stim-1",
        condition: "voicebox_ddsp",
        groundTruthIntent: "sarcasm",
        perceivedIntent: "sarcasm",
        confidenceScore: 4,
        naturalnessScore: 4.5,
        reactionTimeMs: 1450,
        timestamp: Date.now(),
      },
      {
        trialId: "t-2",
        participantId: "p-01",
        audioStimulusId: "stim-2",
        condition: "voicebox_ddsp",
        groundTruthIntent: "annoyance",
        perceivedIntent: "annoyance",
        confidenceScore: 5,
        naturalnessScore: 4.0,
        reactionTimeMs: 1120,
        timestamp: Date.now(),
      },
      {
        trialId: "t-3",
        participantId: "p-02",
        audioStimulusId: "stim-3",
        condition: "baseline_cloud_tts",
        groundTruthIntent: "sarcasm",
        perceivedIntent: "neutral", // Cloud TTS misclassified as polite neutral
        confidenceScore: 2,
        naturalnessScore: 3.5,
        reactionTimeMs: 2300,
        timestamp: Date.now(),
      },
      {
        trialId: "t-4",
        participantId: "p-02",
        audioStimulusId: "stim-4",
        condition: "baseline_cloud_tts",
        groundTruthIntent: "annoyance",
        perceivedIntent: "neutral",
        confidenceScore: 2,
        naturalnessScore: 3.5,
        reactionTimeMs: 2100,
        timestamp: Date.now(),
      },
    ];

    framework.addBatchTrials(mockTrials);
    const analysis = framework.analyze("Unit Test Evaluation", true);

    expect(analysis.participantCount).toBe(2);
    expect(analysis.totalTrialsCount).toBe(4);

    // VoiceBox accuracy should be 100% in this mock subset
    expect(analysis.conditions["voicebox_ddsp"].accuracy).toBe(1.0);
    expect(analysis.conditions["voicebox_ddsp"].ciLower95).toBeGreaterThan(0.3);

    // Baseline cloud accuracy should be 0% in this mock subset
    expect(analysis.conditions["baseline_cloud_tts"].accuracy).toBe(0.0);

    // Confusion matrix should log the misclassifications
    expect(analysis.confusionMatrix["sarcasm"]["sarcasm"]).toBe(1);
    expect(analysis.confusionMatrix["sarcasm"]["neutral"]).toBe(1);
  });
});
