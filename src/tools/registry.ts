/**
 * VoiceBox MCP Server Tool Registry
 * Exposes all 16 core biophysical tools across 6 domains,
 * plus 2 closed-loop DIVA sensorimotor learning tools (Bio-NAVB v2).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChimeraEngine } from "../ffi/engine.ts";
import {
  registerAnatomyTools,
  setVoiceIdentitySchema,
  switchCreatureSchema,
} from "./anatomy.ts";
import {
  registerBabblingTools,
  babbleArticulatorsSchema,
  setGlottalSourceSchema,
  learnArticulatoryTargetSchema,
  curiosityBabbleSchema,
} from "./babbling.ts";
import {
  registerSpeechTools,
  speakTextSchema,
  speakIpaSchema,
  singNotesSchema,
} from "./speech.ts";
import {
  registerGestureTools,
  performVocalGestureSchema,
  beatboxPatternSchema,
} from "./gestures.ts";
import {
  registerPerceptionTools,
  listenToSelfSchema,
  mapVowelSpaceSchema,
} from "./perception.ts";
import {
  registerStreamingTools,
  streamPhonemicSpeechSchema,
  streamArticulatoryGesturesSchema,
  controlVoiceStreamSchema,
} from "./streaming.ts";

export interface RegistryOptions {
  enableLearning?: boolean;
}

export function registerAllTools(
  server: McpServer,
  engine: ChimeraEngine,
  options: RegistryOptions = {}
): void {
  const anatomy = registerAnatomyTools(engine);
  const babbling = registerBabblingTools(engine);
  const speech = registerSpeechTools(engine);
  const gestures = registerGestureTools(engine);
  const perception = registerPerceptionTools(engine);
  const streaming = registerStreamingTools(engine);

  // --- Domain A: Anatomy & Morphometry ---
  server.tool(
    "set_voice_identity",
    "Sculpt physical vocal tract morphology: continuous adult male/female/child mix, tract scale, and larynx vertical offset.",
    setVoiceIdentitySchema.shape,
    anatomy.set_voice_identity
  );

  server.tool(
    "get_voice_identity",
    "Inspect current vocal tract anatomical geometry, pharynx and oral cavity lengths, and baseline neutral tube formants.",
    {},
    anatomy.get_voice_identity
  );

  server.tool(
    "switch_creature",
    "Transform vocal anatomy into non-human animal species biophysics (human, songbird syrinx, elephant trunk, seal, alligator).",
    switchCreatureSchema.shape,
    anatomy.switch_creature
  );

  // --- Domain B: Motor Babbling & Muscle Actuation ---
  server.tool(
    "babble_articulators",
    "Actuate the 17 neuromuscular articulators (jaw, tongue body X/Y, tongue tip X/Y/curl, lips, velum, larynx) with critically damped Task-Dynamic ODE tracking.",
    babbleArticulatorsSchema.shape,
    babbling.babble_articulators
  );

  server.tool(
    "get_articulator_state",
    "Read instantaneous 17-articulator physical positions, subglottal pressure, and mechanical contacts.",
    {},
    babbling.get_articulator_state
  );

  server.tool(
    "set_glottal_source",
    "Regulate vocal fold glottal oscillator: lung pressure (cmH2O), fundamental pitch f0 (Hz), breathiness, tension, fry, and chaos.",
    setGlottalSourceSchema.shape,
    babbling.set_glottal_source
  );

  // --- Domain C: Gestural Speech & Prosody ---
  server.tool(
    "speak_text",
    "Synthesize natural language speech across 5 language families (en, zh, ko, ru, tr) with intonation contours, rate control, and Öhman coarticulation.",
    speakTextSchema.shape,
    speech.speak_text
  );

  server.tool(
    "speak_ipa",
    "Articulate phonetic IPA with articulatory diacritics, stop burst closures, and continuous gestural scoring.",
    speakIpaSchema.shape,
    speech.speak_ipa
  );

  server.tool(
    "sing_notes",
    "Sing melodic lines with exact MIDI pitch numbers, lyric syllables, legato transitions, and vocal fold vibrato.",
    singNotesSchema.shape,
    speech.sing_notes
  );

  // --- Domain D: Non-Verbal Gestures & Airstream Mechanics ---
  server.tool(
    "perform_vocal_gesture",
    "Execute aerodynamic non-verbal vocalizations: sigh, gasp (negative ingressive lung pressure), chuckle, throat clear, growl, scream, whisper, click, ejective.",
    performVocalGestureSchema.shape,
    gestures.perform_vocal_gesture
  );

  server.tool(
    "beatbox_pattern",
    "Sequence articulatory vocal percussion patterns in Standard Beatbox Notation (SBN) using pulmonic, ejective, and click airstreams.",
    beatboxPatternSchema.shape,
    gestures.beatbox_pattern
  );

  // --- Domain E: Auditory Biofeedback & Self-Perception ---
  server.tool(
    "listen_to_self",
    "Auditory biofeedback sensory analysis: extract LPC formants F1-F4, pitch track f0, Harmonics-to-Noise Ratio (HNR in dB), and RMS loudness.",
    listenToSelfSchema.shape,
    perception.listen_to_self
  );

  server.tool(
    "map_vowel_space",
    "Perform developmental motor babbling calibration: sweep tongue body (X, Y) and jaw opening to map the agent's personalized empirical 2D vowel quadrilateral (F1 x F2).",
    mapVowelSpaceSchema.shape,
    perception.map_vowel_space
  );

  // --- Domain F: Real-Time Conversational Streaming ---
  server.tool(
    "stream_phonemic_speech",
    "Feed streaming tokens from LLM into the voice box. Employs 1-word lookahead buffer, Öhman substrate anticipation, and yields immediate audio chunks (<130ms TTFA).",
    streamPhonemicSpeechSchema.shape,
    streaming.stream_phonemic_speech
  );

  server.tool(
    "stream_articulatory_gestures",
    "Directly stream raw neuromuscular gestural records into the active GestureScore continuous timeline without interruption.",
    streamArticulatoryGesturesSchema.shape,
    streaming.stream_articulatory_gestures
  );

  server.tool(
    "control_voice_stream",
    "Control streaming voice lifecycle and trigger instant conversational barge-in (<25ms) via exponential lung pressure decay.",
    controlVoiceStreamSchema.shape,
    streaming.control_voice_stream
  );

  // --- Domain G: Sensorimotor Learning & Auditory Feedback (Bio-NAVB v2) ---
  const shouldEnableLearning = options.enableLearning || process.env.VOICEBOX_ENABLE_LEARNING === "1";
  if (shouldEnableLearning) {
    server.tool(
      "learn_articulatory_target",
      "Closed-loop DIVA sensorimotor inverse motor error correction (delta x = alpha * J^dagger * e_auditory). Iteratively adapts 17 articulators to hit acoustic target.",
      learnArticulatoryTargetSchema.shape,
      babbling.learn_articulatory_target
    );

    server.tool(
      "curiosity_babble",
      "Curiosity-driven developmental babbling: autonomous exploration of the articulatory manifold maximizing competence progress.",
      curiosityBabbleSchema.shape,
      babbling.curiosity_babble
    );
  }
}
