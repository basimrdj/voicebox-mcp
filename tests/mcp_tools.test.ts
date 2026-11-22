import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "../src/index.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChimeraEngine } from "../src/ffi/engine.ts";

describe("VoiceBox 16-Tool MCP Conformance Test", () => {
  let server: McpServer;
  let engine: ChimeraEngine;
  let registeredTools: Record<string, any>;

  beforeAll(() => {
    const instance = createServer();
    server = instance.server;
    engine = instance.engine;

    // Access registered tools from private server instance
    registeredTools = (server as any)._registeredTools;
  });

  it("verifies exactly 16 tools are registered", () => {
    const toolNames = Object.keys(registeredTools);
    expect(toolNames.length).toBe(16);

    const expectedTools = [
      // Domain A
      "set_voice_identity",
      "get_voice_identity",
      "switch_creature",
      // Domain B
      "babble_articulators",
      "get_articulator_state",
      "set_glottal_source",
      // Domain C
      "speak_text",
      "speak_ipa",
      "sing_notes",
      // Domain D
      "perform_vocal_gesture",
      "beatbox_pattern",
      // Domain E
      "listen_to_self",
      "map_vowel_space",
      // Domain F
      "stream_phonemic_speech",
      "stream_articulatory_gestures",
      "control_voice_stream",
    ];

    for (const name of expectedTools) {
      expect(registeredTools[name]).toBeDefined();
    }
  });

  // --- Domain A Tests ---
  it("executes set_voice_identity and get_voice_identity", async () => {
    const setTool = registeredTools["set_voice_identity"];
    const setRes = await setTool.handler({ bodyMix: { female: 0.6, child: 0.1 } });
    const setJson = JSON.parse(setRes.content[0].text);
    expect(setJson.status).toBe("success");
    expect(setJson.bodyMix.female).toBe(0.6);

    const getTool = registeredTools["get_voice_identity"];
    const getRes = await getTool.handler({});
    const getJson = JSON.parse(getRes.content[0].text);
    expect(getJson.activeSpecies).toBe("human");
    expect(getJson.anatomy.totalLengthCm).toBeGreaterThan(10);
  });

  it("executes switch_creature", async () => {
    const tool = registeredTools["switch_creature"];
    const res = await tool.handler({ creatureId: "songbird", params: {} });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.activeCreature).toBe("songbird");

    // verify get_voice_identity reflects the creature
    const getTool = registeredTools["get_voice_identity"];
    const getRes = await getTool.handler({});
    const getJson = JSON.parse(getRes.content[0].text);
    expect(getJson.activeSpecies).toBe("songbird");

    // switch back to human
    await tool.handler({ creatureId: "human" });
    const backRes = await getTool.handler({});
    expect(JSON.parse(backRes.content[0].text).activeSpecies).toBe("human");
  });

  // --- Domain B Tests ---
  it("executes babble_articulators and get_articulator_state", async () => {
    const babbleTool = registeredTools["babble_articulators"];
    const res = await babbleTool.handler({
      articulators: { jaw: 0.4, tbY: -0.2, lipAp: 0.5 },
      durationMs: 150,
      returnAudio: true,
    });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.durationMs).toBe(150);
    expect(json.audioBase64).toBeDefined();

    // Verify audio sample count matches the requested duration (150ms @ 48kHz = 7200 samples)
    const buf = Buffer.from(json.audioBase64, "base64");
    const numSamples = (buf.length - 44) / 2;
    expect(numSamples).toBeGreaterThanOrEqual(7200);

    const stateTool = registeredTools["get_articulator_state"];
    const stateRes = await stateTool.handler({});
    const stateJson = JSON.parse(stateRes.content[0].text);
    expect(stateJson.articulators).toBeDefined();
    expect(stateJson.articulators.jaw).toBeDefined();
  });

  it("executes set_glottal_source", async () => {
    const tool = registeredTools["set_glottal_source"];
    const res = await tool.handler({ f0: 180, pLung: 9.0, breathiness: 0.2 });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
  });

  // --- Domain C Tests ---
  it("executes speak_text across all 5 supported languages", async () => {
    const tool = registeredTools["speak_text"];
    const languages = [
      { lang: "en", text: "Hello" },
      { lang: "zh", text: "你好" },
      { lang: "ko", text: "안녕" },
      { lang: "ru", text: "привет" },
      { lang: "tr", text: "merhaba" },
    ] as const;

    for (const item of languages) {
      const res = await tool.handler({ text: item.text, language: item.lang, rate: 1.0 });
      const json = JSON.parse(res.content[0].text);
      expect(json.status).toBe("success");
      expect(json.language).toBe(item.lang);
      expect(json.durationMs).toBeGreaterThan(100);
      expect(json.audioBase64).toBeDefined();
      expect(json.audioVaultPath).toBeDefined();
    }
  });

  it("executes speak_ipa", async () => {
    const tool = registeredTools["speak_ipa"];
    const res = await tool.handler({ ipa: "həloʊ", rate: 1.0 });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.durationMs).toBeGreaterThan(200);
    expect(json.audioBase64).toBeDefined();
  });

  it("executes sing_notes with vibrato", async () => {
    const tool = registeredTools["sing_notes"];
    const res = await tool.handler({
      notes: [{ note: 60, lyrics: "la", beats: 1.0 }],
      bpm: 120,
      vibrato: 0.35,
    });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.audioBase64).toBeDefined();
  });

  // --- Domain D Tests ---
  it("executes perform_vocal_gesture with full duration rendering", async () => {
    const tool = registeredTools["perform_vocal_gesture"];
    const res = await tool.handler({ gesture: "sigh", intensity: 0.8, durationMs: 250 });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.gesture).toBe("sigh");
    expect(json.durationMs).toBeGreaterThanOrEqual(250);
    expect(json.audioBase64).toBeDefined();
  });

  it("executes beatbox_pattern", async () => {
    const tool = registeredTools["beatbox_pattern"];
    const res = await tool.handler({ pattern: "B . t . K . t .", bpm: 120, bars: 1 });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.audioBase64).toBeDefined();
  });

  // --- Domain E Tests ---
  it("executes listen_to_self", async () => {
    const tool = registeredTools["listen_to_self"];
    const res = await tool.handler({});
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.formantsHz.length).toBe(4);
    expect(json.loudnessRms).toBeDefined();
  });

  it("executes map_vowel_space", async () => {
    const tool = registeredTools["map_vowel_space"];
    const res = await tool.handler({ gridResolution: 3 });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.exploredMotorCoordinates).toBe(9);
    expect(json.vowelQuadrilateralAnchors).toBeDefined();
  });

  // --- Domain F Tests ---
  it("executes stream_phonemic_speech and control_voice_stream", async () => {
    const streamTool = registeredTools["stream_phonemic_speech"];
    const res1 = await streamTool.handler({
      textChunk: "Hello ",
      isFinal: false,
      streamId: "session_1",
    });
    const json1 = JSON.parse(res1.content[0].text);
    expect(json1.status).toBe("success");

    const controlTool = registeredTools["control_voice_stream"];
    const interruptRes = await controlTool.handler({
      action: "interrupt",
      streamId: "session_1",
    });
    const interruptJson = JSON.parse(interruptRes.content[0].text);
    expect(interruptJson.status).toBe("interrupted");
    expect(interruptJson.bargeInLatencyMs).toBeLessThanOrEqual(30);
  });

  it("executes stream_articulatory_gestures", async () => {
    const tool = registeredTools["stream_articulatory_gestures"];
    const res = await tool.handler({
      gestures: [
        {
          t0: 0.0,
          t1: 0.05,
          rampIn: 0.01,
          rampOut: 0.01,
          strength: 10,
          targets: { jaw: 0.3, lipAp: 0.4 },
        },
      ],
      leadMs: 0,
      replace: false,
      renderMs: 50,
      streamId: "session_1",
    });
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe("success");
    expect(json.audioBase64).toBeDefined();
  });

  afterAll(() => {
    if (engine) engine.destroy();
  });
});
