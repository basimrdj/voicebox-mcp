/**
 * VoiceBox Milestone 2 — Universal Vocal Performance Representation
 * 
 * Versioned, serializable Vocal Performance Timeline adhering to the 4-layer separation:
 * Layer 1: Linguistic Content (text, phonemes, syllables, word boundaries, stress)
 * Layer 2: Vocal Identity (baseline pitch distribution, vocal tract dimensions, timbre)
 * Layer 3: Vocal Performance (pitch contour, intensity, rhythm, phonation type Rd/Ps, articulators, nonverbals)
 * Layer 4: Rendering Backend & Hardware (backend type, sample rate, streaming, capability matrix)
 * 
 * Provides:
 * - Unified `VoiceBox.perform({ linguistic, identity, performance, rendering })` API.
 * - Explicit backend capability declaration: every backend declares which controls it supports
 *   "exact", "approximate", or "unsupported".
 */

import { z } from "zod";
import { SynthesisOrchestrator, type SynthesisEngineType, type OrchestratedSpeechResult } from "../synthesis/synthesis_orchestrator.ts";
import { ChimeraEngine } from "../ffi/engine.ts";
import { PhonemePlanner } from "../synthesis/phoneme_planner.ts";

export type ControlSupportLevel = "exact" | "approximate" | "unsupported";

export interface BackendCapabilities {
  backend: SynthesisEngineType;
  description: string;
  supportsExactPitchContour: ControlSupportLevel;
  supportsBiophysicalRd: ControlSupportLevel;
  supportsSubglottalPressure: ControlSupportLevel;
  supports3DArticulators: ControlSupportLevel;
  supportsMovingFormants: ControlSupportLevel;
  supportsNonverbalReflexes: ControlSupportLevel;
  supportsStreaming: ControlSupportLevel;
  latencyRatingMs: number;
}

export const BACKEND_CAPABILITY_MATRIX: Record<SynthesisEngineType, BackendCapabilities> = {
  ddsp: {
    backend: "ddsp",
    description: "Biophysical DDSP all-pole formant resonator bank (<15ms latency, local Bun/TS)",
    supportsExactPitchContour: "exact",
    supportsBiophysicalRd: "exact",
    supportsSubglottalPressure: "exact",
    supports3DArticulators: "approximate", // projected through perturbation theory
    supportsMovingFormants: "exact",
    supportsNonverbalReflexes: "exact",
    supportsStreaming: "exact",
    latencyRatingMs: 12,
  },
  physical: {
    backend: "physical",
    description: "CHIMERA 1D transmission-line vocal tract waveguide (C-ABI libchimera_wasm)",
    supportsExactPitchContour: "exact",
    supportsBiophysicalRd: "exact",
    supportsSubglottalPressure: "exact",
    supports3DArticulators: "exact",
    supportsMovingFormants: "exact",
    supportsNonverbalReflexes: "exact",
    supportsStreaming: "exact",
    latencyRatingMs: 5,
  },
  neural_hifiglot: {
    backend: "neural_hifiglot",
    description: "Differentiable Resonator PyTorch baseline",
    supportsExactPitchContour: "exact",
    supportsBiophysicalRd: "exact",
    supportsSubglottalPressure: "exact",
    supports3DArticulators: "approximate",
    supportsMovingFormants: "exact",
    supportsNonverbalReflexes: "approximate",
    supportsStreaming: "unsupported",
    latencyRatingMs: 120,
  },
  auto: {
    backend: "auto",
    description: "Auto-selected optimal backend based on platform and request",
    supportsExactPitchContour: "exact",
    supportsBiophysicalRd: "exact",
    supportsSubglottalPressure: "exact",
    supports3DArticulators: "exact",
    supportsMovingFormants: "exact",
    supportsNonverbalReflexes: "exact",
    supportsStreaming: "exact",
    latencyRatingMs: 12,
  },
};

// --- Schema Definitions for the 4 Layers ---

export const linguisticLayerSchema = z.object({
  text: z.string().min(1),
  language: z.string().default("en"),
  phonemes: z.array(z.string()).optional(),
  words: z.array(z.string()).optional(),
  emphasisIndices: z.array(z.number()).optional(),
});

export const identityLayerSchema = z.object({
  name: z.string().default("default_speaker"),
  baselineF0: z.number().min(50).max(600).default(125.0),
  pitchRangeSemitones: z.number().min(1).max(36).default(12.0),
  vocalTractLengthCm: z.number().min(10).max(24).default(17.5),
  speakerEmbedding: z.array(z.number()).optional(),
  timbreProfile: z.enum(["neutral", "bright", "dark", "resonant", "breathy"]).default("neutral"),
});

export const performanceLayerSchema = z.object({
  intent: z.enum([
    "neutral",
    "sarcasm",
    "annoyance",
    "sadness",
    "curiosity",
    "happiness",
    "amusement",
    "relief",
    "concern",
    "fear",
    "uncertainty",
    "passive_hostility",
  ]).default("neutral"),
  intensity: z.number().min(0.0).max(1.0).default(0.7),
  speakingRate: z.number().min(0.4).max(2.5).default(1.0),
  pitchContour: z.array(z.object({ timeMs: z.number(), f0Hz: z.number() })).optional(),
  subglottalPressureCmH2O: z.number().min(3.0).max(45.0).optional(),
  glottalRd: z.number().min(0.3).max(3.0).optional(),
  breathiness: z.number().min(0.0).max(1.0).optional(),
  nonverbal: z.enum(["sigh", "gasp", "laughter", "chuckle", "sob", "fry", "breath_catch"]).optional(),
  nonverbalPosition: z.enum(["onset", "mid", "coda"]).default("onset"),
  wordModifiers: z.array(
    z.object({
      wordIndex: z.number(),
      stressMultiplier: z.number().optional(),
      durationMultiplier: z.number().optional(),
      pitchOffsetHz: z.number().optional(),
    })
  ).optional(),
});

export const renderingLayerSchema = z.object({
  backend: z.enum(["auto", "ddsp", "physical", "neural_hifiglot"]).default("auto"),
  sampleRate: z.number().default(48000),
  streaming: z.boolean().default(false),
  saveVault: z.boolean().default(false),
});

export const vocalPerformanceTimelineSchema = z.object({
  version: z.literal("1.0.0").default("1.0.0"),
  metadata: z.object({
    createdAt: z.string().default(() => new Date().toISOString()),
    author: z.string().default("VoiceBox"),
    description: z.string().optional(),
  }),
  linguistic: linguisticLayerSchema,
  identity: identityLayerSchema.default(() => identityLayerSchema.parse({})),
  performance: performanceLayerSchema.default(() => performanceLayerSchema.parse({})),
  rendering: renderingLayerSchema.default(() => renderingLayerSchema.parse({})),
});

export type LinguisticLayer = z.infer<typeof linguisticLayerSchema>;
export type IdentityLayer = z.infer<typeof identityLayerSchema>;
export type PerformanceLayer = z.infer<typeof performanceLayerSchema>;
export type RenderingLayer = z.infer<typeof renderingLayerSchema>;
export type VocalPerformanceTimeline = z.infer<typeof vocalPerformanceTimelineSchema>;

export interface VocalPerformanceOutput {
  timeline: VocalPerformanceTimeline;
  audioResult: OrchestratedSpeechResult;
  backendCapabilities: BackendCapabilities;
  supportedControlsSummary: Record<string, ControlSupportLevel>;
}

/**
 * Universal VoiceBox Client Interface.
 * Executes the 4-layer decoupled speech performance.
 */
export class VoiceBox {
  private static orchestrator = new SynthesisOrchestrator();
  private static chimeraEngine: ChimeraEngine | null = null;

  /**
   * Universal `VoiceBox.perform(...)` API.
   */
  static async perform(input: {
    linguistic: LinguisticLayer | string;
    identity?: Partial<IdentityLayer>;
    performance?: Partial<PerformanceLayer>;
    rendering?: Partial<RenderingLayer>;
  }): Promise<VocalPerformanceOutput> {
    // 1. Normalize input into valid timeline
    const linguistic: LinguisticLayer = typeof input.linguistic === "string"
      ? { text: input.linguistic, language: "en" }
      : input.linguistic;

    const timeline: VocalPerformanceTimeline = vocalPerformanceTimelineSchema.parse({
      version: "1.0.0",
      metadata: { createdAt: new Date().toISOString(), author: "VoiceBox" },
      linguistic,
      identity: input.identity || {},
      performance: input.performance || {},
      rendering: input.rendering || {},
    });

    const targetBackend = timeline.rendering.backend;

    // 2. Prepare orchestrator
    if (targetBackend === "physical" && !VoiceBox.chimeraEngine) {
      VoiceBox.chimeraEngine = new ChimeraEngine(timeline.rendering.sampleRate);
    }
    const orch = targetBackend === "physical" && VoiceBox.chimeraEngine
      ? new SynthesisOrchestrator(VoiceBox.chimeraEngine, timeline.rendering.sampleRate)
      : VoiceBox.orchestrator;

    // 3. Render performance
    const audioResult = await orch.synthesizeSpeech({
      text: timeline.linguistic.text,
      intent: timeline.performance.intent as any,
      intensity: timeline.performance.intensity,
      baselineF0: timeline.identity.baselineF0,
      pitchRangeSemitones: timeline.identity.pitchRangeSemitones,
      pitchContour: timeline.performance.pitchContour,
      speakingRate: timeline.performance.speakingRate,
      glottalRd: timeline.performance.glottalRd,
      subglottalPressureCmH2O: timeline.performance.subglottalPressureCmH2O,
      breathiness: timeline.performance.breathiness,
      vocalTractLengthCm: timeline.identity.vocalTractLengthCm,
      timbreProfile: timeline.identity.timbreProfile,
      speakerEmbedding: timeline.identity.speakerEmbedding,
      nonverbal: timeline.performance.nonverbal as any,
      nonverbalPosition: timeline.performance.nonverbalPosition,
      engine: targetBackend,
      sampleRate: timeline.rendering.sampleRate,
      saveVault: timeline.rendering.saveVault,
      wordConfigs: timeline.performance.wordModifiers?.map((wm) => ({
        wordIndex: wm.wordIndex,
        durationMultiplier: wm.durationMultiplier,
        stressMultiplier: wm.stressMultiplier,
        f0Multiplier: wm.pitchOffsetHz ? (1.0 + wm.pitchOffsetHz / timeline.identity.baselineF0) : undefined,
      })),
    });

    const actualBackend = (audioResult.engineUsed as SynthesisEngineType) || "ddsp";
    const caps = BACKEND_CAPABILITY_MATRIX[actualBackend] || BACKEND_CAPABILITY_MATRIX.ddsp;

    const supportedControlsSummary: Record<string, ControlSupportLevel> = {
      pitchContour: caps.supportsExactPitchContour,
      biophysicalRd: caps.supportsBiophysicalRd,
      subglottalPressure: caps.supportsSubglottalPressure,
      articulators3D: caps.supports3DArticulators,
      movingFormants: caps.supportsMovingFormants,
      nonverbals: caps.supportsNonverbalReflexes,
      streaming: caps.supportsStreaming,
    };

    return {
      timeline,
      audioResult,
      backendCapabilities: caps,
      supportedControlsSummary,
    };
  }

  /**
   * Export timeline to versioned JSON.
   */
  static exportTimeline(timeline: VocalPerformanceTimeline): string {
    return JSON.stringify(timeline, null, 2);
  }

  /**
   * Import timeline from versioned JSON.
   */
  static importTimeline(jsonStr: string): VocalPerformanceTimeline {
    const parsed = JSON.parse(jsonStr);
    return vocalPerformanceTimelineSchema.parse(parsed);
  }
}
