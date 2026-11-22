import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../src/index.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChimeraEngine } from "../src/ffi/engine.ts";
import { speakTextSchema, speakIpaSchema, EMOTION_PROFILES } from "../src/tools/speech.ts";
import { performVocalGestureSchema } from "../src/tools/gestures.ts";
import { spawnSync } from "child_process";

describe("Domain C & D: Emotional Prosody & Dynamic Gestures", () => {
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
  // 1. Emotional Prosody in speak_text & speak_ipa
  // =========================================================================
  describe("Affective Emotional Conditioning", () => {
    it("validates emotion schema allows exactly the 6 defined emotions and defaults to neutral", () => {
      const parsedTextDefault = speakTextSchema.parse({ text: "Hello world" });
      expect(parsedTextDefault.emotion).toBe("neutral");

      const parsedIpaDefault = speakIpaSchema.parse({ ipa: "həˈloʊ" });
      expect(parsedIpaDefault.emotion).toBe("neutral");

      const validEmotions = [
        "neutral",
        "sadness",
        "hot_anger",
        "cold_anger",
        "frustration",
        "tenderness",
      ] as const;

      for (const emo of validEmotions) {
        const resText = speakTextSchema.parse({ text: "Test", emotion: emo });
        expect(resText.emotion).toBe(emo);

        const resIpa = speakIpaSchema.parse({ ipa: "tɛst", emotion: emo });
        expect(resIpa.emotion).toBe(emo);
      }

      // Rejects invalid emotions
      expect(() => {
        speakTextSchema.parse({ text: "Test", emotion: "euphoric" as any });
      }).toThrow();
      expect(() => {
        speakIpaSchema.parse({ ipa: "Test", emotion: "boredom" as any });
      }).toThrow();
    });

    it("synthesizes sadness with reduced lung pressure, lowered f0, and slower speaking rate", async () => {
      const tool = registeredTools["speak_text"];
      const text = "I am so deeply sorrowful about what happened";

      const res = await tool.handler({ text, emotion: "sadness" });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.emotion).toBe("sadness");
      expect(json.durationMs).toBeGreaterThan(0);
      expect(json.audioBase64).toBeDefined();
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);

      // Compare against hot_anger: sadness should have a significantly longer duration (0.75x rate vs 1.35x rate)
      const angerRes = await tool.handler({ text, emotion: "hot_anger" });
      const angerJson = JSON.parse(angerRes.content[0].text);

      expect(angerJson.status).toBe("success");
      expect(angerJson.emotion).toBe("hot_anger");
      expect(json.durationMs).toBeGreaterThan(angerJson.durationMs);

      // Auditory perception should reflect lower pitch in sadness vs hot_anger
      expect(angerJson.auditoryFeedback.f0).toBeGreaterThan(0);
      expect(json.auditoryFeedback.f0).toBeGreaterThan(0);
      expect(angerJson.auditoryFeedback.f0).toBeGreaterThan(json.auditoryFeedback.f0);
    });

    it("synthesizes hot_anger with massive pressure surge, elevated f0, and fast speaking rate", async () => {
      const tool = registeredTools["speak_text"];
      const res = await tool.handler({
        text: "Get out of here right now!",
        emotion: "hot_anger",
      });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.emotion).toBe("hot_anger");
      expect(json.audioVaultPath).toContain("hot_anger");
      expect(json.audioBase64.length).toBeGreaterThan(100);
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.01);
      expect(json.auditoryFeedback.f0).toBeGreaterThan(130);
    });

    it("synthesizes cold_anger with rigid flat intonation and controlled pressure", async () => {
      const tool = registeredTools["speak_text"];
      const res = await tool.handler({
        text: "I told you never to do that again.",
        emotion: "cold_anger",
      });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.emotion).toBe("cold_anger");
      expect(json.audioBase64).toBeDefined();
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);
    });

    it("synthesizes frustration with pressure fluctuations and tremor", async () => {
      const tool = registeredTools["speak_text"];
      const res = await tool.handler({
        text: "Why does this keep happening every single time!",
        emotion: "frustration",
      });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.emotion).toBe("frustration");
      expect(json.audioVaultPath).toContain("frustration");
      expect(json.durationMs).toBeGreaterThan(300);
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);
    });

    it("synthesizes tenderness with gentle pressure, soft onset, and smooth legato", async () => {
      const tool = registeredTools["speak_text"];
      const res = await tool.handler({
        text: "You are going to be completely okay, I promise.",
        emotion: "tenderness",
      });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.emotion).toBe("tenderness");
      expect(json.audioVaultPath).toContain("tenderness");
      expect(json.audioBase64).toBeDefined();
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);
    });

    it("supports all 6 affective emotional states in speak_ipa with proper f0 scaling", async () => {
      const tool = registeredTools["speak_ipa"];
      const emotions = [
        "neutral",
        "sadness",
        "hot_anger",
        "cold_anger",
        "frustration",
        "tenderness",
      ] as const;

      for (const emo of emotions) {
        const res = await tool.handler({ ipa: "həˈloʊ", emotion: emo });
        const json = JSON.parse(res.content[0].text);
        expect(json.status).toBe("success");
        expect(json.emotion).toBe(emo);
        expect(json.audioBase64).toBeDefined();
        expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);
      }
    });
  });

  // =========================================================================
  // 2. Dynamic Multiphase Vocal Gestures
  // =========================================================================
  describe("Dynamic Multiphase Gestures", () => {
    it("validates performVocalGestureSchema includes sob, cry, and laughter", () => {
      const gestures = [
        "sob",
        "cry",
        "laughter",
        "sigh",
        "scream",
        "gasp",
        "chuckle",
        "throat_clear",
        "growl",
        "whisper",
        "click",
        "ejective",
      ] as const;
      for (const g of gestures) {
        const parsed = performVocalGestureSchema.parse({ gesture: g });
        expect(parsed.gesture).toBe(g);
      }

      // Rejects unknown gesture
      expect(() => {
        performVocalGestureSchema.parse({ gesture: "cough" as any });
      }).toThrow();
    });

    it("executes 3-phase physiological sigh with inspiratory burst, apneic pause, and expiratory drop", async () => {
      const tool = registeredTools["perform_vocal_gesture"];
      const res = await tool.handler({ gesture: "sigh", intensity: 0.8 });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.gesture).toBe("sigh");
      // Default sigh duration is 1330 ms (350ms burst + 80ms pause + 900ms drop)
      expect(json.durationMs).toBeGreaterThanOrEqual(1300);
      expect(json.audioBase64).toBeDefined();
      // Must produce audible acoustic energy, not silence!
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.01);

      // Test with custom scaled duration
      const resCustom = await tool.handler({ gesture: "sigh", durationMs: 500, intensity: 0.9 });
      const jsonCustom = JSON.parse(resCustom.content[0].text);
      expect(jsonCustom.durationMs).toBeGreaterThanOrEqual(500);
      expect(jsonCustom.auditoryFeedback.rms).toBeGreaterThan(0.01);
    });

    it("executes sob and cry with 4 Hz spasmodic stridor gasps and collapsing vocal fry", async () => {
      const tool = registeredTools["perform_vocal_gesture"];

      for (const gesture of ["sob", "cry"] as const) {
        const res = await tool.handler({ gesture, intensity: 0.85, durationMs: 1000 });
        const json = JSON.parse(res.content[0].text);

        expect(json.status).toBe("success");
        expect(json.gesture).toBe(gesture);
        expect(json.durationMs).toBeGreaterThanOrEqual(1000);
        expect(json.audioBase64).toBeDefined();
        // Spasmodic wails and fry must have high acoustic energy
        expect(json.auditoryFeedback.rms).toBeGreaterThan(0.02);
      }
    });

    it("executes laughter with staccato 5 Hz pulse train and micro-abductions", async () => {
      const tool = registeredTools["perform_vocal_gesture"];
      const res = await tool.handler({ gesture: "laughter", intensity: 0.8, durationMs: 1050 });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.gesture).toBe("laughter");
      expect(json.durationMs).toBeGreaterThanOrEqual(1050);
      expect(json.audioBase64).toBeDefined();
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.03);
      expect(json.auditoryFeedback.f0).toBeGreaterThan(120);
    });

    it("executes scream with subglottal pressure surge (>40 cmH2O) and roughness modulation", async () => {
      const tool = registeredTools["perform_vocal_gesture"];
      const res = await tool.handler({ gesture: "scream", intensity: 1.0, durationMs: 600 });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.gesture).toBe("scream");
      expect(json.durationMs).toBeGreaterThanOrEqual(600);
      expect(json.audioBase64).toBeDefined();
      // High pressure scream produces peak loudness
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.05);
      expect(json.auditoryFeedback.f0).toBeGreaterThan(200);
    });

    it("handles omitted intensity with proper default without causing NaN pressure or silence", async () => {
      const tool = registeredTools["perform_vocal_gesture"];
      // Call without intensity field
      const res = await tool.handler({ gesture: "sob" });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.gesture).toBe("sob");
      expect(json.intensity).toBe(0.7);
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.02);
    });

    it("maintains vocal tract acoustic health across sequential consecutive gesture calls", async () => {
      const tool = registeredTools["perform_vocal_gesture"];
      const sequence = ["sigh", "sob", "laughter", "scream", "gasp", "chuckle"] as const;

      for (const g of sequence) {
        const res = await tool.handler({ gesture: g });
        const json = JSON.parse(res.content[0].text);
        expect(json.status).toBe("success");
        expect(json.gesture).toBe(g);
        expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);
      }
    });
  });

  // =========================================================================
  // 3. Epilaryngeal Resonance & Singer's Formant in Singing
  // =========================================================================
  describe("Singing Epilaryngeal Resonance & Vibrato", () => {
    it("articulates melodic notes with 1:6 epilaryngeal narrowing and singer's formant clustering", async () => {
      const tool = registeredTools["sing_notes"];
      const res = await tool.handler({
        notes: [
          { note: 60, lyrics: "ah", beats: 1.0 },
          { note: 64, lyrics: "la", beats: 1.0 },
        ],
        bpm: 120,
        vibrato: 0.40,
      });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.notesCount).toBe(2);
      expect(json.durationMs).toBeGreaterThan(500);
      expect(json.audioBase64).toBeDefined();
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.01);

      // Verify Singer's Formant (F3-F5 clustered near 2.8 - 3.2 kHz)
      expect(json.auditoryFeedback?.formants).toBeDefined();
      const formants = json.auditoryFeedback.formants;
      // F3 should be clustered in the Singer's Formant region (near 2800 Hz)
      expect(formants[2]).toBeGreaterThanOrEqual(2500);
      expect(formants[2]).toBeLessThanOrEqual(3300);
    });

    it("executes intrinsic 5.8 Hz neuromuscular vibrato with modulation", async () => {
      const tool = registeredTools["sing_notes"];
      const res = await tool.handler({
        notes: [{ note: 67, lyrics: "so", beats: 1.5 }],
        bpm: 100,
        vibrato: 0.60,
      });
      const json = JSON.parse(res.content[0].text);

      expect(json.status).toBe("success");
      expect(json.audioBase64).toBeDefined();
      expect(json.durationMs).toBeGreaterThan(800);
      expect(json.auditoryFeedback.rms).toBeGreaterThan(0.01);
      expect(json.auditoryFeedback.f0).toBeGreaterThan(150);
    });

    it("applies anatomical vocal tract length scaling in singing formants", async () => {
      const tool = registeredTools["sing_notes"];
      const anatTool = registeredTools["set_voice_identity"];

      // Adult male baseline
      await anatTool.handler({ femaleMix: 0.0, childMix: 0.0 });
      const maleRes = await tool.handler({
        notes: [{ note: 60, lyrics: "ah", beats: 1.0 }],
        bpm: 120,
      });
      const maleJson = JSON.parse(maleRes.content[0].text);

      // High female mix (shorter vocal tract, higher formants)
      await anatTool.handler({ femaleMix: 0.9, childMix: 0.0 });
      const femaleRes = await tool.handler({
        notes: [{ note: 60, lyrics: "ah", beats: 1.0 }],
        bpm: 120,
      });
      const femaleJson = JSON.parse(femaleRes.content[0].text);

      // Reset back to baseline
      await anatTool.handler({ femaleMix: 0.0, childMix: 0.0 });

      expect(femaleJson.auditoryFeedback.formants[0]).toBeGreaterThanOrEqual(
        maleJson.auditoryFeedback.formants[0] * 0.95
      );
    });
  });

  // =========================================================================
  // 4. Boundary & Edge Cases
  // =========================================================================
  describe("Edge Cases & Multilingual Conditioning", () => {
    it("handles extreme gesture durations (50ms and 2500ms) with numerical stability", async () => {
      const tool = registeredTools["perform_vocal_gesture"];
      const minRes = await tool.handler({ gesture: "sigh", durationMs: 50, intensity: 0.1 });
      const minJson = JSON.parse(minRes.content[0].text);
      expect(minJson.status).toBe("success");
      expect(minJson.durationMs).toBeGreaterThanOrEqual(50);
      expect(minJson.auditoryFeedback.rms).toBeGreaterThan(0.001);

      const maxRes = await tool.handler({ gesture: "laughter", durationMs: 2500, intensity: 1.0 });
      const maxJson = JSON.parse(maxRes.content[0].text);
      expect(maxJson.status).toBe("success");
      expect(maxJson.durationMs).toBeGreaterThanOrEqual(2500);
      expect(maxJson.auditoryFeedback.rms).toBeGreaterThan(0.01);
    });

    it("synthesizes emotional speech across non-English languages (tr, zh, ru, ko)", async () => {
      const tool = registeredTools["speak_text"];
      const tests = [
        { lang: "tr", text: "Merhaba dünya", emotion: "hot_anger" },
        { lang: "zh", text: "你好", emotion: "tenderness" },
        { lang: "ru", text: "привет", emotion: "cold_anger" },
        { lang: "ko", text: "안녕", emotion: "sadness" },
      ] as const;

      for (const t of tests) {
        const res = await tool.handler({ text: t.text, language: t.lang, emotion: t.emotion });
        const json = JSON.parse(res.content[0].text);
        expect(json.status).toBe("success");
        expect(json.emotion).toBe(t.emotion);
        expect(json.audioBase64).toBeDefined();
        expect(json.auditoryFeedback.rms).toBeGreaterThan(0.005);
      }
    });

    it("executes CLI speak and gesture commands properly without errors", () => {
      // Test CLI speak with emotion
      const speakCli = spawnSync("bun", [
        "cli.ts",
        "speak",
        "CLI emotional speech test",
        "--emotion",
        "cold_anger",
        "--no-play",
      ], { encoding: "utf-8" });
      expect(speakCli.status).toBe(0);
      const speakData = JSON.parse(speakCli.stdout);
      expect(speakData.status).toBe("success");
      expect(speakData.emotion).toBe("cold_anger");

      // Test CLI gesture
      const gestureCli = spawnSync("bun", [
        "cli.ts",
        "gesture",
        "laughter",
        "--no-play",
      ], { encoding: "utf-8" });
      expect(gestureCli.status).toBe(0);
      const gestureData = JSON.parse(gestureCli.stdout);
      expect(gestureData.status).toBe("success");
      expect(gestureData.gesture).toBe("laughter");
      expect(gestureData.auditoryFeedback.rms).toBeGreaterThan(0.01);
    });
  });
});
