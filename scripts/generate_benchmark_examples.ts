/**
 * Generates verified physically controlled audio examples for VoiceBox Phase 6 & 7.
 * Sentence: "I am completely fine with this decision." (7 words)
 */

import { SynthesisOrchestrator } from "../src/synthesis/synthesis_orchestrator.ts";
import { ChimeraEngine } from "../src/ffi/engine.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BENCHMARK_SENTENCE = "I am completely fine with this decision.";

async function main() {
  const engine = new ChimeraEngine(48000);
  const orchestrator = new SynthesisOrchestrator(engine, 48000);

  const outDir = join(import.meta.dir, "..", "demo", "audio");
  const artifactDir = "/Users/basimhussain/.gemini/antigravity/brain/ea44e489-c088-43e1-9b18-9486ddb88873";
  mkdirSync(outDir, { recursive: true });

  const states = [
    { id: "neutral", intent: "neutral", intensity: 0.5 },
    { id: "passive_hostility", intent: "passive_hostility", intensity: 0.8 },
    { id: "curiosity", intent: "curiosity", intensity: 0.8 },
    { id: "sarcasm", intent: "sarcasm", intensity: 0.85 },
    { id: "exasperation", intent: "relief", intensity: 0.8, nonverbal: "sigh" as const, pos: "coda" as const },
    { id: "annoyance", intent: "annoyance", intensity: 0.8 },
    { id: "anxiety", intent: "fear", intensity: 0.8 },
    { id: "quiet_dejection", intent: "sadness", intensity: 0.85 },
  ];

  console.log("Generating physically conditioned benchmark clips...");

  const results: any[] = [];

  for (const st of states) {
    const res = await orchestrator.synthesizeSpeech({
      text: BENCHMARK_SENTENCE,
      intent: st.intent as any,
      intensity: st.intensity,
      nonverbal: st.nonverbal,
      nonverbalPosition: st.pos,
      engine: "ddsp",
      saveVault: false,
    });

    const outPath1 = join(outDir, `${st.id}.wav`);
    const outPath2 = join(artifactDir, `bench_${st.id}.wav`);

    const buf = Buffer.from(res.base64Wav, "base64");
    writeFileSync(outPath1, buf);
    writeFileSync(outPath2, buf);

    results.push({
      id: st.id,
      durationMs: res.durationMs,
      meanF0: res.perception.f0,
      rms: res.perception.rms,
      hnrDb: res.perception.hnrDb,
      centroid: res.perception.spectralCentroid,
      engine: res.engineUsed,
    });

    console.log(`✓ ${st.id}: ${res.durationMs.toFixed(1)}ms | f0=${res.perception.f0}Hz | hnr=${res.perception.hnrDb}dB`);
  }

  // Also synthesize smooth intra-utterance transition (polite -> sarcastic dejection)
  const transRes = await orchestrator.synthesizeSpeech({
    text: BENCHMARK_SENTENCE,
    intent: "neutral",
    transitions: [
      {
        fromWordIndex: 3,
        toWordIndex: 6,
        targetVAD: { valence: -0.8, arousal: 0.2, dominance: -0.6 },
      },
    ],
    engine: "ddsp",
    saveVault: false,
  });

  const transPath1 = join(outDir, "transition_polite_to_dejection.wav");
  const transPath2 = join(artifactDir, "bench_transition_polite_to_dejection.wav");
  const transBuf = Buffer.from(transRes.base64Wav, "base64");
  writeFileSync(transPath1, transBuf);
  writeFileSync(transPath2, transBuf);
  console.log(`✓ transition_polite_to_dejection: ${transRes.durationMs.toFixed(1)}ms`);

  // Write summary manifest
  writeFileSync(
    join(artifactDir, "benchmark_audio_manifest.json"),
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log("Benchmark audio generation complete.");
}

main().catch(console.error);
