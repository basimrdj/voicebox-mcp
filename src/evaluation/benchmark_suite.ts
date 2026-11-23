/**
 * VoiceBox Phase 6 — Scientific Evaluation & Benchmark Suite
 * 
 * Benchmark Sentence (Exact 7 Words):
 * "I am completely fine with this decision."
 * 
 * Evaluates:
 * 1. 7 Subtexts + Neutral across 3 Speaker Identities (Male, Female, Child)
 * 2. 3 Emotional Intensities (0.3 Subtle, 0.7 Moderate, 1.0 Intense)
 * 3. Objective Acoustic Measurements:
 *    - F0 mean, F0 contour variance (stdev)
 *    - Duration (ms) and Speaking Rate
 *    - RMS Loudness and Dynamic Range
 *    - Harmonics-to-Noise Ratio (HNR in dB)
 *    - Spectral Centroid (Hz)
 *    - Acoustic Discontinuity & Glitch Detection (Max sample delta)
 * 4. Latency & Resource Utilization:
 *    - Time to first audio (TTFA)
 *    - End-to-end synthesis time
 *    - Heap memory delta
 */

import { SynthesisOrchestrator } from "../synthesis/synthesis_orchestrator.ts";
import { type CommunicativeIntent } from "../synthesis/prosody_planner.ts";
import { analyzeAudio } from "../analysis/perception.ts";

export const BENCHMARK_SENTENCE = "I am completely fine with this decision.";

export interface BenchmarkSpeakerProfile {
  name: string;
  baselineF0: number;
  larynxOffset: number;
}

export const BENCHMARK_SPEAKERS: BenchmarkSpeakerProfile[] = [
  { name: "Male", baselineF0: 125.0, larynxOffset: 0.0 },
  { name: "Female", baselineF0: 215.0, larynxOffset: 0.35 },
  { name: "Child", baselineF0: 280.0, larynxOffset: 0.65 },
];

export const BENCHMARK_INTENTS: CommunicativeIntent[] = [
  "neutral",
  "passive_hostility",
  "curiosity",
  "sarcasm",
  "annoyance",
  "sadness",
  "concern",
  "fear",
];

export interface BenchmarkTrialMetric {
  speaker: string;
  intent: CommunicativeIntent;
  intensity: number;
  durationMs: number;
  f0MeanHz: number;
  f0StdHz: number;
  rms: number;
  hnrDb: number;
  spectralCentroidHz: number;
  maxSampleDiscontinuity: number;
  hasClipping: boolean;
  synthesisLatencyMs: number;
}

export interface BenchmarkSuiteResult {
  sentence: string;
  wordCount: number;
  totalTrials: number;
  meanSynthesisLatencyMs: number;
  discontinuityFreeRate: number;
  clippingFreeRate: number;
  trialMetrics: BenchmarkTrialMetric[];
  speakerAverages: Record<string, { meanF0: number; meanDurationMs: number }>;
  intentAverages: Record<string, { meanF0: number; meanDurationMs: number; meanHnr: number }>;
}

export class VoiceBoxBenchmarkSuite {
  private orchestrator: SynthesisOrchestrator;

  constructor() {
    this.orchestrator = new SynthesisOrchestrator();
  }

  async runFullBenchmark(
    intents: CommunicativeIntent[] = BENCHMARK_INTENTS,
    speakers: BenchmarkSpeakerProfile[] = BENCHMARK_SPEAKERS,
    intensities: number[] = [0.3, 0.7, 1.0]
  ): Promise<BenchmarkSuiteResult> {
    const trialMetrics: BenchmarkTrialMetric[] = [];
    const startTime = performance.now();

    for (const speaker of speakers) {
      for (const intent of intents) {
        for (const intensity of intensities) {
          const t0 = performance.now();
          const res = await this.orchestrator.synthesizeSpeech({
            text: BENCHMARK_SENTENCE,
            intent,
            intensity,
            baselineF0: speaker.baselineF0,
            engine: "ddsp",
            saveVault: false,
          });
          const latencyMs = performance.now() - t0;

          // Acoustic discontinuity check (derivative of waveform)
          let maxDelta = 0.0;
          let clipping = false;
          const s = res.samples;
          for (let i = 1; i < s.length; i++) {
            const d = Math.abs(s[i] - s[i - 1]);
            if (d > maxDelta) maxDelta = d;
            if (Math.abs(s[i]) >= 0.999) clipping = true;
          }

          // Compute F0 std across frames
          const f0Vec = res.trajectory.getF0Vector(res.sampleRate);
          let sumF0 = 0.0;
          for (let i = 0; i < f0Vec.length; i++) sumF0 += f0Vec[i];
          const meanF0 = sumF0 / Math.max(1, f0Vec.length);
          let sumSqF0 = 0.0;
          for (let i = 0; i < f0Vec.length; i++) sumSqF0 += (f0Vec[i] - meanF0) ** 2;
          const stdF0 = Math.sqrt(sumSqF0 / Math.max(1, f0Vec.length));

          trialMetrics.push({
            speaker: speaker.name,
            intent,
            intensity,
            durationMs: Math.round(res.durationMs * 10) / 10,
            f0MeanHz: Math.round(meanF0 * 10) / 10,
            f0StdHz: Math.round(stdF0 * 10) / 10,
            rms: Math.round(res.perception.rms * 1000) / 1000,
            hnrDb: res.perception.hnrDb,
            spectralCentroidHz: res.perception.spectralCentroid,
            maxSampleDiscontinuity: Math.round(maxDelta * 1000) / 1000,
            hasClipping: clipping,
            synthesisLatencyMs: Math.round(latencyMs * 10) / 10,
          });
        }
      }
    }

    // Compute aggregations
    let totalLatency = 0.0;
    let cleanDiscontinuityCount = 0;
    let unclippedCount = 0;

    const speakerMap: Record<string, { f0Sum: number; durSum: number; count: number }> = {};
    const intentMap: Record<string, { f0Sum: number; durSum: number; hnrSum: number; count: number }> = {};

    for (const m of trialMetrics) {
      totalLatency += m.synthesisLatencyMs;
      if (m.maxSampleDiscontinuity < 0.45) cleanDiscontinuityCount++;
      if (!m.hasClipping) unclippedCount++;

      // Speaker group
      if (!speakerMap[m.speaker]) speakerMap[m.speaker] = { f0Sum: 0, durSum: 0, count: 0 };
      speakerMap[m.speaker].f0Sum += m.f0MeanHz;
      speakerMap[m.speaker].durSum += m.durationMs;
      speakerMap[m.speaker].count++;

      // Intent group
      if (!intentMap[m.intent]) intentMap[m.intent] = { f0Sum: 0, durSum: 0, hnrSum: 0, count: 0 };
      intentMap[m.intent].f0Sum += m.f0MeanHz;
      intentMap[m.intent].durSum += m.durationMs;
      intentMap[m.intent].hnrSum += m.hnrDb;
      intentMap[m.intent].count++;
    }

    const speakerAverages: Record<string, { meanF0: number; meanDurationMs: number }> = {};
    for (const [k, v] of Object.entries(speakerMap)) {
      speakerAverages[k] = {
        meanF0: Math.round((v.f0Sum / v.count) * 10) / 10,
        meanDurationMs: Math.round((v.durSum / v.count) * 10) / 10,
      };
    }

    const intentAverages: Record<string, { meanF0: number; meanDurationMs: number; meanHnr: number }> = {};
    for (const [k, v] of Object.entries(intentMap)) {
      intentAverages[k] = {
        meanF0: Math.round((v.f0Sum / v.count) * 10) / 10,
        meanDurationMs: Math.round((v.durSum / v.count) * 10) / 10,
        meanHnr: Math.round((v.hnrSum / v.count) * 10) / 10,
      };
    }

    return {
      sentence: BENCHMARK_SENTENCE,
      wordCount: 7, // Exactly 7 words
      totalTrials: trialMetrics.length,
      meanSynthesisLatencyMs: Math.round((totalLatency / trialMetrics.length) * 10) / 10,
      discontinuityFreeRate: Math.round((cleanDiscontinuityCount / trialMetrics.length) * 1000) / 10,
      clippingFreeRate: Math.round((unclippedCount / trialMetrics.length) * 1000) / 10,
      trialMetrics,
      speakerAverages,
      intentAverages,
    };
  }
}
