#!/usr/bin/env bun
/**
 * VoiceBox CLI - Interface for Embodied Agents & Humans
 * Interacts with the VoiceBox MCP Server and biophysical vocal tract engine.
 * Powered by Bio-NAVB v2 (Biophysical Neural-Acoustic Voice Box).
 */

import { ChimeraEngine } from "./src/ffi/engine.ts";
import { registerAllTools } from "./src/tools/registry.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawnSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { loadProfile, applyProfileToEngine } from "./src/vault/profile.ts";

const engine = new ChimeraEngine();
const initialProfile = loadProfile();
applyProfileToEngine(engine, initialProfile);

const server = new McpServer({ name: "voicebox-cli", version: "1.0.0" });
registerAllTools(server, engine, { enableLearning: true });

// Direct tool callers
import { registerAnatomyTools } from "./src/tools/anatomy.ts";
import { registerBabblingTools } from "./src/tools/babbling.ts";
import { registerSpeechTools } from "./src/tools/speech.ts";
import { registerGestureTools } from "./src/tools/gestures.ts";
import { registerPerceptionTools } from "./src/tools/perception.ts";
import { registerStreamingTools } from "./src/tools/streaming.ts";

const anatomy = registerAnatomyTools(engine);
const babbling = registerBabblingTools(engine);
const speech = registerSpeechTools(engine);
const gestures = registerGestureTools(engine);
const perception = registerPerceptionTools(engine);
const streaming = registerStreamingTools(engine);

const allToolHandlers: Record<string, Function> = {
  set_voice_identity: anatomy.set_voice_identity,
  get_voice_identity: anatomy.get_voice_identity,
  switch_creature: anatomy.switch_creature,
  babble_articulators: babbling.babble_articulators,
  get_articulator_state: babbling.get_articulator_state,
  set_glottal_source: babbling.set_glottal_source,
  speak_text: speech.speak_text,
  speak_ipa: speech.speak_ipa,
  sing_notes: speech.sing_notes,
  perform_vocal_gesture: gestures.perform_vocal_gesture,
  beatbox_pattern: gestures.beatbox_pattern,
  listen_to_self: perception.listen_to_self,
  map_vowel_space: perception.map_vowel_space,
  stream_phonemic_speech: streaming.stream_phonemic_speech,
  stream_articulatory_gestures: streaming.stream_articulatory_gestures,
  control_voice_stream: streaming.control_voice_stream,
  learn_articulatory_target: babbling.learn_articulatory_target,
  curiosity_babble: babbling.curiosity_babble,
};

function playAudio(path: string) {
  if (path && existsSync(path)) {
    try {
      spawnSync("afplay", [path], { stdio: "inherit" });
    } catch {}
  }
}

function playBase64Wav(base64: string) {
  try {
    const tmpPath = `/tmp/voicebox_play_${Date.now()}.wav`;
    writeFileSync(tmpPath, Buffer.from(base64, "base64"));
    playAudio(tmpPath);
  } catch {}
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(`
VoiceBox Digital Voice Box - Agent & User Interface (Bio-NAVB v2)
Usage:
  voicebox list                                                               Lists all MCP tools & schemas
  voicebox call <tool> '<json_args>' [--play]                                 Calls an MCP tool directly
  voicebox speak <text> [--subtext <subtext>] [--emotion <emotion>] [--play]  Quick natural speech synthesis with affective prosody
  voicebox gesture <type> [--play]                                            Perform vocal gesture (sigh, sob, cry, laughter, scream, gasp...)
  voicebox learn <phoneme> [--play]                                           DIVA closed-loop motor error learning
  voicebox babble [--play]                                                    Curiosity-driven autonomous babbling
  voicebox identity                                                           Show current vocal anatomy
  voicebox play <wav_path>                                                    Play any audio file via speakers
    `);
    process.exit(0);
  }

  if (command === "list") {
    console.log(JSON.stringify(Object.keys(allToolHandlers), null, 2));
    process.exit(0);
  }

  if (command === "play") {
    const file = args[1];
    if (!file) {
      console.error("Usage: voicebox play <file.wav>");
      process.exit(1);
    }
    playAudio(file);
    process.exit(0);
  }

  if (command === "identity") {
    const res = await anatomy.get_voice_identity();
    const data = JSON.parse(res.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  if (command === "gesture") {
    const type = args.slice(1).find((a) => !a.startsWith("-")) || "sigh";
    const autoPlay = args.includes("--play");
    const res = await gestures.perform_vocal_gesture({ gesture: type as any });
    const data = JSON.parse(res.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    if (autoPlay && data.audioVaultPath) {
      playAudio(data.audioVaultPath);
    }
    process.exit(0);
  }

  if (command === "learn") {
    const target = args[1] || "i";
    const autoPlay = args.includes("--play") || !args.includes("--no-play");
    const res = await babbling.learn_articulatory_target({
      target,
      initialArticulators: { jaw: 0.5, tbX: -0.5, tbY: -0.5 },
      maxEpisodes: 8,
      learningRate: 0.45,
      returnAudio: true,
    });
    const data = JSON.parse(res.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    if (autoPlay && data.finalAudioBase64) {
      playBase64Wav(data.finalAudioBase64);
    }
    process.exit(0);
  }

  if (command === "babble") {
    const autoPlay = args.includes("--play") || !args.includes("--no-play");
    const res = await babbling.curiosity_babble({
      numSteps: 12,
      strategy: "vowel_triangle",
      returnAudio: true,
    });
    const data = JSON.parse(res.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    if (autoPlay && data.audioBase64) {
      playBase64Wav(data.audioBase64);
    }
    process.exit(0);
  }

  if (command === "speak") {
    const nonFlagArgs = args.slice(1).filter((a, idx, arr) => {
      if (a.startsWith("-")) return false;
      const prev = arr[idx - 1];
      if (prev === "--lang" || prev === "--emotion" || prev === "--subtext" || prev === "--subtext-intensity") return false;
      return true;
    });
    const text = nonFlagArgs.join(" ");
    if (!text) {
      console.error("Usage: voicebox speak \"<text>\" [--subtext <subtext>] [--emotion <emotion>] [--play] [--lang en]");
      process.exit(1);
    }
    const autoPlay = args.includes("--play");
    const langIdx = args.indexOf("--lang");
    const lang = (langIdx !== -1 ? args[langIdx + 1] : "en") as any;
    const emotionIdx = args.indexOf("--emotion");
    const emotion = (emotionIdx !== -1 ? args[emotionIdx + 1] : "neutral") as any;
    const subtextIdx = args.indexOf("--subtext");
    const subtext = subtextIdx !== -1 ? (args[subtextIdx + 1] as any) : undefined;
    const intensityIdx = args.indexOf("--subtext-intensity");
    const subtextIntensity = intensityIdx !== -1 ? parseFloat(args[intensityIdx + 1]) : 0.7;

    const res = await speech.speak_text({
      text,
      language: lang,
      intonation: "statement",
      rate: 1.0,
      accent: 0.15,
      emotion,
      subtext,
      subtextIntensity,
    });
    const data = JSON.parse(res.content[0].text);
    console.log(JSON.stringify(data, null, 2));
    if (autoPlay && data.audioVaultPath) {
      playAudio(data.audioVaultPath);
    }
    process.exit(0);
  }

  if (command === "call") {
    const toolName = args[1];
    const rawArgs = args[2] || "{}";
    const autoPlay = args.includes("--play") || !args.includes("--no-play");

    if (!toolName || !allToolHandlers[toolName]) {
      console.error(`Unknown tool: ${toolName}. Run 'voicebox list' to see available tools.`);
      process.exit(1);
    }

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch (e: any) {
      console.error(`Invalid JSON arguments: ${e.message}`);
      process.exit(1);
    }

    try {
      const res = await allToolHandlers[toolName](parsedArgs);
      const data = JSON.parse(res.content[0].text);
      console.log(JSON.stringify(data, null, 2));
      if (autoPlay && data.audioVaultPath) {
        playAudio(data.audioVaultPath);
      } else if (autoPlay && (data.audioBase64 || data.finalAudioBase64)) {
        playBase64Wav(data.audioBase64 || data.finalAudioBase64);
      }
    } catch (e: any) {
      console.error(`Tool execution failed: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  console.error(`Unknown command: ${command}. Run 'voicebox help' for usage.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
