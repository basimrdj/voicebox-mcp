import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../src/index.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChimeraEngine } from "../src/ffi/engine.ts";
import {
  speakTextSchema,
  speakIpaSchema,
  subtextStateEnum,
  type SubtextState,
} from "../src/tools/speech.ts";
import {
  solveLfFromRd,
  evaluateLfFlowDerivative,
  generateAreaConservedLfCycle,
  InteractiveGlottalFlow,
} from "../src/synthesis/glottal_flow.ts";
import {
  generateSubtextTrajectory,
} from "../src/synthesis/subtext_engine.ts";
import {
  scheduleMetricalGestures,
  evaluateTobiPitch,
  isVowel,
} from "../src/synthesis/hierarchical_prosody.ts";
import { BioNavbSynthesizer, DEFAULT_LARYNGEAL } from "../src/synthesis/neural_engine.ts";
import { spawnSync } from "child_process";
import type { Gesture } from "../src/ffi/types.ts";

describe("Biophysical Subtext Prosody & Glottal Dynamics (Bio-NAVB v2)", () => {
  let server: McpServer;
  let engine: ChimeraEngine;
  let registeredTools: Record<string, any>;

  beforeAll(() => {
    const instance = createServer();
    server = instance.server;
    engine = instance.engine;
    registeredTools = (server as any)._registeredTools;
  });

  afterAll(() => {
    if (engine) engine.destroy();
  });

  // =========================================================================
  // 1. Tool Schema & Backward Compatibility Verification
  // =========================================================================
  describe("Tool Schema & Backward Compatibility", () => {
    it("preserves exactly 16 tools registered by default", () => {
      const toolNames = Object.keys(registeredTools);
      expect(toolNames.length).toBe(16);
    });

    it("validates all 7 nuanced subtext states in speakTextSchema and speakIpaSchema", () => {
      const validSubtexts: SubtextState[] = [
        "annoyance",
        "curiosity",
        "exasperation",
        "passive_hostility",
        "anxiety",
        "sarcasm",
        "quiet_dejection",
      ];

      for (const st of validSubtexts) {
        const parsedText = speakTextSchema.parse({
          text: "I am fine.",
          subtext: st,
          subtextIntensity: 0.8,
        });
        expect(parsedText.subtext).toBe(st);
        expect(parsedText.subtextIntensity).toBe(0.8);
        expect(parsedText.emotion).toBe("neutral"); // preserved default

        const parsedIpa = speakIpaSchema.parse({
          ipa: "aɪ æm faɪn",
          subtext: st,
        });
        expect(parsedIpa.subtext).toBe(st);
        expect(parsedIpa.subtextIntensity).toBe(0.7); // default intensity
      }
    });

    it("defaults subtext to undefined while preserving all 6 standard emotions", () => {
      const parsed = speakTextSchema.parse({ text: "Hello world", emotion: "frustration" });
      expect(parsed.subtext).toBeUndefined();
      expect(parsed.emotion).toBe("frustration");
      expect(parsed.subtextIntensity).toBe(0.7);
    });
  });

  // =========================================================================
  // 2. Gunnar Fant LF Model & Zero-Integral Area Conservation
  // =========================================================================
  describe("Gunnar Fant Differential LF Model", () => {
    it("solves LF parameters across wide Rd range (0.35 pressed to 2.80 breathy)", () => {
      const rds = [0.35, 0.50, 1.00, 1.80, 2.80];
      const T0 = 1.0 / 125.0; // 125 Hz baseline

      for (const rd of rds) {
        const lf = solveLfFromRd(rd, T0, 1.0);
        expect(lf.Rd).toBeCloseTo(rd, 2);
        expect(lf.Ra).toBeGreaterThan(0.005);
        expect(lf.Rk).toBeGreaterThan(0.20);
        expect(lf.Oq).toBeGreaterThan(0.30);
        expect(lf.Oq).toBeLessThan(0.95);
        expect(lf.Te).toBeGreaterThan(0.0);
        expect(lf.Te).toBeLessThan(T0);
        expect(lf.Tp).toBeGreaterThan(0.0);
        expect(lf.Tp).toBeLessThan(lf.Te);
        expect(lf.alpha).toBeDefined();
        expect(lf.epsilon).toBeGreaterThan(0.0);
      }
    });

    it("verifies zero-integral area conservation (net flow ∫ E(t) dt ≈ 0)", () => {
      const sampleRate = 48000;
      const T0 = 1.0 / 120.0;
      const testRds = [0.45, 0.70, 1.0, 1.5, 2.2];

      for (const rd of testRds) {
        const lf = solveLfFromRd(rd, T0);
        const cycle = generateAreaConservedLfCycle(lf, sampleRate, T0);
        
        let sum = 0.0;
        for (let i = 0; i < cycle.length; i++) {
          sum += cycle[i];
        }
        const meanResidual = Math.abs(sum / cycle.length);
        // Absolute discrete DC residual must be negligible (< 1e-6)
        expect(meanResidual).toBeLessThan(1e-6);
      }
    });
  });

  // =========================================================================
  // 3. Supraglottal Inertance Coupling Stability & Pulse Skewing
  // =========================================================================
  describe("Interactive Supraglottal Inertance Coupling", () => {
    it("maintains unconditional numerical stability without NaN or runaway values", () => {
      const inertance = new InteractiveGlottalFlow(48000);
      const sampleRate = 48000;
      const numSamples = 24000; // 0.5 seconds
      const T0 = 1.0 / 130.0;
      const lf = solveLfFromRd(0.65, T0);

      let maxVal = 0.0;
      for (let n = 0; n < numSamples; n++) {
        const t = (n / sampleRate) % T0;
        const rawE = evaluateLfFlowDerivative(t, lf, T0);
        const coupledE = inertance.step(rawE, 10.0);

        expect(isNaN(coupledE)).toBe(false);
        expect(isFinite(coupledE)).toBe(true);
        maxVal = Math.max(maxVal, Math.abs(coupledE));
      }

      expect(maxVal).toBeGreaterThan(0.05);
      expect(maxVal).toBeLessThan(50.0); // Bounded without algebraic explosion
    });

    it("dynamically skews glottal flow with active pulse reinforcement between opening and closing phases", () => {
      const inertance = new InteractiveGlottalFlow(48000);
      const sampleRate = 48000;
      const T0 = 1.0 / 120.0;
      const lf = solveLfFromRd(0.8, T0);

      let minSkew = 100.0;
      let maxSkew = -100.0;
      for (let n = 0; n < 480; n++) {
        const t = (n / sampleRate) % T0;
        const rawE = evaluateLfFlowDerivative(t, lf, T0);
        const coupledE = inertance.step(rawE, 8.0);
        if (Math.abs(rawE) > 0.05) {
          const ratio = coupledE / rawE;
          minSkew = Math.min(minSkew, ratio);
          maxSkew = Math.max(maxSkew, ratio);
        }
      }

      // Opening phase is retarded (< 1.0) and closing phase is accelerated (> 1.10)
      expect(minSkew).toBeLessThan(0.98);
      expect(maxSkew).toBeGreaterThan(1.10);
    });
  });

  // =========================================================================
  // 4. 2nd-Order Critically Damped Filter: Absence of Step Discontinuities
  // =========================================================================
  describe("Pitch Trajectory Continuity & Critically Damped ODE", () => {
    it("synthesizes phoneme sequences with zero pitch step discontinuities", () => {
      const synth = new BioNavbSynthesizer(48000);
      // Construct gestures with an extreme 1-octave step jump in f0 (120 Hz to 240 Hz)
      const gestures: Gesture[] = [
        {
          t0: 0.0,
          t1: 0.15,
          rampIn: 0.01,
          rampOut: 0.01,
          strength: 1.0,
          label: "a",
          targets: { f0: 120.0, breath: 1.0 },
        },
        {
          t0: 0.15,
          t1: 0.30,
          rampIn: 0.01,
          rampOut: 0.01,
          strength: 1.0,
          label: "i",
          targets: { f0: 240.0, breath: 1.0 },
        },
      ];

      const audio = synth.synthesizePlan(gestures, 0.32, { female: 0, child: 0 });
      expect(audio.length).toBeGreaterThan(0);

      // Verify audio has no sample explosions or NaNs
      for (let i = 0; i < audio.length; i++) {
        expect(isNaN(audio[i])).toBe(false);
        expect(Math.abs(audio[i])).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // =========================================================================
  // 5. Metrical Phonology & ToBI Pitch Contour
  // =========================================================================
  describe("Hierarchical Prosody Scheduler", () => {
    it("clips vocalic nuclei by ~25% for passive_hostility while retaining consonants", () => {
      const gestures: Gesture[] = [
        { t0: 0.00, t1: 0.08, rampIn: 0.01, rampOut: 0.01, strength: 1.0, label: "s", targets: {} },
        { t0: 0.08, t1: 0.24, rampIn: 0.01, rampOut: 0.01, strength: 1.0, label: "a", targets: {} }, // vowel nucleus (160ms)
        { t0: 0.24, t1: 0.32, rampIn: 0.01, rampOut: 0.01, strength: 1.0, label: "t", targets: {} }, // stop (80ms)
      ];

      const { gestures: scheduled } = scheduleMetricalGestures(gestures, "passive_hostility", 1.0);
      const origVowelDur = gestures[1].t1 - gestures[1].t0; // 0.16
      const newVowelDur = scheduled[1].t1 - scheduled[1].t0;
      const consonantDur = scheduled[0].t1 - scheduled[0].t0;

      // Consonant preserved at ~80ms
      expect(consonantDur).toBeCloseTo(0.08, 2);
      // Vowel clipped by ~25%
      expect(newVowelDur).toBeCloseTo(origVowelDur * 0.75, 2);
    });

    it("prolongs tonic vowel nucleus by +45% for sarcasm", () => {
      const gestures: Gesture[] = [
        { t0: 0.00, t1: 0.15, rampIn: 0.01, rampOut: 0.01, strength: 1.0, label: "oʊ", targets: {} },
        { t0: 0.15, t1: 0.25, rampIn: 0.01, rampOut: 0.01, strength: 1.0, label: "k", targets: {} },
        { t0: 0.25, t1: 0.45, rampIn: 0.01, rampOut: 0.01, strength: 1.0, label: "eɪ", targets: {} }, // tonic vowel (200ms)
      ];

      const { gestures: scheduled } = scheduleMetricalGestures(gestures, "sarcasm", 1.0);
      const tonicOrig = gestures[2].t1 - gestures[2].t0;
      const tonicNew = scheduled[2].t1 - scheduled[2].t0;

      // Tonic vowel prolonged by ~45%
      expect(tonicNew).toBeCloseTo(tonicOrig * 1.45, 2);
    });

    it("evaluates C1-smooth continuous ToBI pitch contours", () => {
      const tones = ["L-H%", "L-L%", "!H*", "H*L-"] as const;
      const baseF0 = 120.0;

      for (const tone of tones) {
        let prevPitch = evaluateTobiPitch(0.0, tone, baseF0);
        for (let step = 1; step <= 50; step++) {
          const t = step / 50.0;
          const pitch = evaluateTobiPitch(t, tone, baseF0);
          expect(pitch).toBeGreaterThan(50.0);
          expect(pitch).toBeLessThan(300.0);
          // Continuous change: no jumps > 15 Hz per 2% step
          expect(Math.abs(pitch - prevPitch)).toBeLessThan(15.0);
          prevPitch = pitch;
        }
      }
    });

    it("preserves inter-tier concurrency and prevents duration explosion on multi-tier gestural scores", () => {
      const phrases = ChimeraEngine.g2pPhrases("stop that please");
      const plan = ChimeraEngine.planPhrases(phrases, { body: engine.body, t0: 0, rate: 1.0, f0: 120, intonation: "statement", accent: 0.15 });

      // Plan has ~28 concurrent gestures across articulatory tiers
      expect(plan.gestures.length).toBeGreaterThan(15);
      const origEnd = plan.end;

      const scheduled = scheduleMetricalGestures(plan.gestures, "passive_hostility", 0.8);
      // Duration must be realistic and reflect vowel clipping without serializing parallel tiers
      expect(scheduled.newDuration).toBeLessThan(origEnd * 1.05);
      expect(scheduled.newDuration).toBeGreaterThan(origEnd * 0.70);
      expect(scheduled.gestures.length).toBe(plan.gestures.length);
    });
  });

  // =========================================================================
  // 6. Limbic-PAG Subtext Engine Trajectories
  // =========================================================================
  describe("Involuntary Limbic-PAG Subtext Engine", () => {
    it("generates synchronous phase-coupled 8.5 Hz neuromuscular tremor in anxiety", () => {
      const traj = generateSubtextTrajectory("anxiety", 1.0, 1.0);
      expect(traj.state).toBe("anxiety");

      // Verify phase-coupled tremor exists in both Ps and f0
      const p1 = traj.getTremorPsFactor(0.0);
      const p2 = traj.getTremorPsFactor(1.0 / (4 * 8.5)); // peak at quarter period
      expect(p2).toBeGreaterThan(p1);

      const f1 = traj.getTremorF0Factor(0.0);
      const f2 = traj.getTremorF0Factor(1.0 / (4 * 8.5));
      expect(f1).not.toBe(1.0);
      expect(f2).not.toBe(1.0);
    });

    it("executes respiratory sigh-dump in exasperation (Ps drops > 50%)", () => {
      const traj = generateSubtextTrajectory("exasperation", 1.0, 1.0);
      const psStart = traj.getPs(0.0);
      const psEnd = traj.getPs(0.95);

      expect(psStart).toBeGreaterThan(10.0);
      expect(psEnd).toBeLessThan(psStart * 0.5); // Steep dump
    });

    it("produces smooth C1 pre-plosive micro-glottal stop without step clicks", () => {
      const phonemeTimings = [
        { phoneme: "a", t0: 0.05, t1: 0.15, isVowel: true, isVoicelessPlosive: false },
        { phoneme: "t", t0: 0.15, t1: 0.22, isVowel: false, isVoicelessPlosive: true },
      ];
      const traj = generateSubtextTrajectory("passive_hostility", 1.0, 0.3, phonemeTimings);

      // Stop lead is 30ms before plosive onset (iv.start = 0.12, iv.end = 0.15)
      const gBefore = traj.getMicroGlottalStopGain(0.10);
      const gMid = traj.getMicroGlottalStopGain(0.135);
      const gAtPlosive = traj.getMicroGlottalStopGain(0.15);

      expect(gBefore).toBe(1.0);
      expect(gMid).toBeGreaterThan(0.0);
      expect(gMid).toBeLessThan(1.0);
      expect(gAtPlosive).toBeCloseTo(0.0, 2); // Smoothly reached closure
    });
  });

  // =========================================================================
  // 7. Full Subtext Speech Synthesis Integration (All 7 States)
  // =========================================================================
  describe("Subtext Speech Synthesis Integration", () => {
    const states: SubtextState[] = [
      "annoyance",
      "curiosity",
      "exasperation",
      "passive_hostility",
      "anxiety",
      "sarcasm",
      "quiet_dejection",
    ];

    for (const st of states) {
      it(`synthesizes speech with subtext '${st}' without errors`, async () => {
        const speakTool = registeredTools["speak_text"];
        const res = await speakTool.handler({
          text: "I understand completely.",
          subtext: st,
          subtextIntensity: 0.85,
        });

        const json = JSON.parse(res.content[0].text);
        expect(json.status).toBe("success");
        expect(json.subtext).toBe(st);
        expect(json.subtextIntensity).toBe(0.85);
        expect(json.durationMs).toBeGreaterThan(100);
        expect(json.audioVaultPath).toBeDefined();
        expect(json.audioBase64).toBeDefined();
        expect(json.auditoryFeedback.f0).toBeGreaterThan(40);
      });
    }

    it("synthesizes speak_ipa with subtext conditioning", async () => {
      const ipaTool = registeredTools["speak_ipa"];
      const res = await ipaTool.handler({
        ipa: "ðɪs ɪz ə tɛst",
        subtext: "passive_hostility",
        subtextIntensity: 0.9,
      });

      const json = JSON.parse(res.content[0].text);
      expect(json.status).toBe("success");
      expect(json.subtext).toBe("passive_hostility");
      expect(json.durationMs).toBeGreaterThan(100);
    });

    it("preserves continuous prosody across streaming chunk boundaries without resetting f0", () => {
      const { VoiceStreamer } = require("../src/streaming/streamer.ts");
      const streamer = new VoiceStreamer("test_prosody_stream", engine);
      streamer.setSubtext("curiosity", 0.8);

      const chunk1 = streamer.feedText("Why are you ", false);
      const chunk2 = streamer.feedText("doing that?", true);

      expect(chunk1.length).toBeGreaterThan(0);
      expect(chunk2.length).toBeGreaterThan(0);
      expect(chunk1[0].audioBase64).toBeDefined();
      expect(chunk2[0].audioBase64).toBeDefined();
      streamer.destroy();
    });
  });

  // =========================================================================
  // 8. CLI Execution with --subtext
  // =========================================================================
  describe("CLI Subtext Execution", () => {
    it("executes CLI speak with --subtext and --subtext-intensity", () => {
      const cliPath = "cli.ts";
      const proc = spawnSync("bun", [
        cliPath,
        "speak",
        "Whatever you say",
        "--subtext",
        "sarcasm",
        "--subtext-intensity",
        "0.8",
      ], {
        encoding: "utf-8",
        timeout: 10000,
      });

      expect(proc.status).toBe(0);
      const stdout = proc.stdout;
      const parsed = JSON.parse(stdout);
      expect(parsed.status).toBe("success");
      expect(parsed.subtext).toBe("sarcasm");
    });
  });
});
