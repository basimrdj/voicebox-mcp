/**
 * VoiceBox Phase 3 & 4 — Unified Synthesis Orchestrator
 * 
 * Bridges:
 * Text → Linguistic & Prosodic Planning → Time-Varying Vocal Trajectory
 * → Physically Conditioned Synthesis (Physical Waveguide, Native HiFi-Glot DDSP, or PyTorch HiFi-Glot)
 * → Audio + Telemetry.
 */

import { VocalTrajectory } from "./vocal_trajectory.ts";
import { ProsodyPlanner, type UtterancePlanOptions, type CommunicativeIntent } from "./prosody_planner.ts";
import { HiFiGlotNativeSynthesizer } from "./hifi_glot_native.ts";
import { ChimeraEngine } from "../ffi/engine.ts";
import { analyzeAudio, type AudioPerception } from "../analysis/perception.ts";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

export type SynthesisEngineType = "auto" | "ddsp" | "physical" | "neural_hifiglot";

export interface OrchestratedSpeechResult {
  engineUsed: SynthesisEngineType;
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
  sampleCount: number;
  base64Wav: string;
  vaultPath?: string;
  perception: AudioPerception;
  trajectory: VocalTrajectory;
}

export class SynthesisOrchestrator {
  private planner: ProsodyPlanner;
  private nativeSynthesizer: HiFiGlotNativeSynthesizer;
  private chimeraEngine?: ChimeraEngine;

  constructor(chimeraEngine?: ChimeraEngine, sampleRate: number = 48000) {
    this.planner = new ProsodyPlanner();
    this.nativeSynthesizer = new HiFiGlotNativeSynthesizer(sampleRate);
    this.chimeraEngine = chimeraEngine;
  }

  /**
   * Plans prosody and synthesizes speech audio.
   */
  async synthesizeSpeech(
    options: UtterancePlanOptions & {
      engine?: SynthesisEngineType;
      sampleRate?: number;
      saveVault?: boolean;
    }
  ): Promise<OrchestratedSpeechResult> {
    const targetEngine = options.engine || "auto";
    const sampleRate = options.sampleRate || 48000;

    // 1. Generate unified VocalTrajectory from prosodic planning
    const trajectory = this.planner.planUtterance(options);

    let samples: Float32Array;
    let engineUsed: SynthesisEngineType = "ddsp";

    if (targetEngine === "physical" && this.chimeraEngine) {
      // Pure Physical Baseline via CHIMERA transmission waveguide
      samples = this.synthesizeWithChimera(trajectory, this.chimeraEngine);
      engineUsed = "physical";
    } else if (targetEngine === "neural_hifiglot" && this.isPyTorchAvailable()) {
      // Differentiable Resonator PyTorch synthesis
      const pySamples = this.synthesizeWithPyTorchHiFiGlot(trajectory, sampleRate);
      if (pySamples) {
        samples = pySamples;
        engineUsed = "neural_hifiglot";
      } else {
        samples = this.nativeSynthesizer.synthesize(trajectory);
        engineUsed = "ddsp";
      }
    } else {
      // Default / Auto: Native HiFi-Glot DDSP Formant Synthesizer (<15ms latency, zero python lag)
      samples = this.nativeSynthesizer.synthesize(trajectory);
      engineUsed = "ddsp";
    }

    // 2. Encode to 16-bit PCM WAV
    const wavData = this.encodeWav16(samples, sampleRate);
    const durationMs = (samples.length / sampleRate) * 1000.0;

    // 3. Extract auditory perception metrics
    const perception = analyzeAudio(samples, sampleRate);

    // 4. Save to vault if requested
    let vaultPath: string | undefined;
    if (options.saveVault !== false) {
      try {
        const vaultDir = join(homedir(), ".voicebox", "vault");
        mkdirSync(vaultDir, { recursive: true });
        const filename = `voicebox_${options.intent || "neutral"}_${Date.now()}.wav`;
        vaultPath = join(vaultDir, filename);
        writeFileSync(vaultPath, wavData.buffer);
      } catch {
        // Fallback gracefully if vault cannot be written
      }
    }

    return {
      engineUsed,
      samples,
      sampleRate,
      durationMs,
      sampleCount: samples.length,
      base64Wav: wavData.base64,
      vaultPath,
      perception,
      trajectory,
    };
  }

  private synthesizeWithChimera(trajectory: VocalTrajectory, engine: ChimeraEngine): Float32Array {
    const totalFrames = Math.max(1024, Math.ceil((trajectory.durationMs / 1000.0) * engine.sampleRate));
    
    // Schedule planned phonetic articulatory gestures on the physical transmission waveguide
    if (trajectory.gestures && trajectory.gestures.length > 0) {
      engine.scheduleGestures(trajectory.gestures, 0.0, true);
    }

    // Set initial source parameters from first frame
    const f0 = trajectory.frames[0];
    if (f0) {
      engine.setSource({
        f0: f0.glottal.f0,
        pressure: f0.glottal.subglottalPressure,
        breathiness: f0.glottal.breathiness,
        tension: f0.glottal.glottalRd < 0.8 ? 0.8 : 0.4,
        brightness: 0.35,
        roughness: f0.glottal.roughness,
        voiced: f0.glottal.voiced,
      });
    }

    return engine.render(totalFrames);
  }

  private isPyTorchAvailable(): boolean {
    if (process.env.NODE_ENV === "test") return false;
    try {
      const res = spawnSync("python3", ["-c", "import torch; print(1)"], { encoding: "utf-8", timeout: 2000 });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  private synthesizeWithPyTorchHiFiGlot(trajectory: VocalTrajectory, sampleRate: number): Float32Array | null {
    try {
      const scriptPath = join(import.meta.dir, "hifi_glot.py");
      if (!existsSync(scriptPath)) return null;

      const tmpTraj = join(tmpdir(), `traj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.json`);
      const tmpWav = join(tmpdir(), `out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.wav`);

      // Write trajectory JSON
      writeFileSync(tmpTraj, JSON.stringify({ frames: trajectory.frames }));

      const res = spawnSync("python3", [
        scriptPath,
        "--trajectory", tmpTraj,
        "--output", tmpWav,
        "--sample_rate", sampleRate.toString()
      ], { encoding: "utf-8", timeout: 15000 });

      if (existsSync(tmpTraj)) unlinkSync(tmpTraj);

      if (res.status === 0 && existsSync(tmpWav)) {
        const buf = readFileSync(tmpWav);
        unlinkSync(tmpWav);

        const dataOffset = buf.indexOf("data") + 8;
        const numSamples = Math.floor((buf.length - dataOffset) / 2);
        const out = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          const s16 = buf.readInt16LE(dataOffset + i * 2);
          out[i] = s16 / (s16 < 0 ? 32768.0 : 32767.0);
        }
        return out;
      }
    } catch {
      // Fallback
    }
    return null;
  }

  private encodeWav16(samples: Float32Array, sampleRate: number): { buffer: Buffer; base64: string } {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);

    // fmt subchunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // subchunk size
    buffer.writeUInt16LE(1, 20);  // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample

    // data subchunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1.0, Math.min(1.0, samples[i]));
      const val = s < 0 ? Math.floor(s * 32768.0) : Math.floor(s * 32767.0);
      buffer.writeInt16LE(val, 44 + i * 2);
    }

    return {
      buffer,
      base64: buffer.toString("base64"),
    };
  }
}
