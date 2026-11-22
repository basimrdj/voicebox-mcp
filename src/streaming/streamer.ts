/**
 * Live Voice Streamer for Continuous Real-Time Token-to-Speech
 * Manages timeline synchronization, lookahead queue, and instant barge-in interruption (<25ms).
 * Powered by Bio-NAVB v2 (Biophysical Neural-Acoustic Voice Box).
 */
import { ChimeraEngine } from "../ffi/engine.ts";
import { LookaheadQueue } from "./lookahead_queue.ts";
import { encodeWav, toBase64Wav } from "../vault/audio.ts";
import type { Gesture, PlanOptions, VoiceTelemetry } from "../ffi/types.ts";
import { BioNavbSynthesizer, DEFAULT_LARYNGEAL, type EmotionType } from "../synthesis/neural_engine.ts";
import type { SubtextState } from "../synthesis/subtext_engine.ts";

export interface StreamChunkResult {
  streamId: string;
  chunkIndex: number;
  audioBase64: string;
  durationMs: number;
  sampleCount: number;
  voiceClock: number;
  telemetry: Partial<VoiceTelemetry>;
  isFinal: boolean;
}

export interface StreamerOptions extends Partial<PlanOptions> {
  emotion?: EmotionType;
  subtext?: SubtextState;
  subtextIntensity?: number;
}

export class VoiceStreamer {
  readonly streamId: string;
  readonly engine: ChimeraEngine;
  private queue = new LookaheadQueue();
  private chunkIndex = 0;
  private timelineClock = 0;
  private isActive = true;
  private synth: BioNavbSynthesizer;
  private currentEmotion?: EmotionType;
  private currentSubtext?: SubtextState;
  private currentSubtextIntensity: number = 0.7;

  constructor(streamId: string = "default", engine?: ChimeraEngine) {
    this.streamId = streamId;
    this.engine = engine || new ChimeraEngine(48000);
    this.synth = new BioNavbSynthesizer(this.engine.sampleRate);
  }

  public setEmotion(emotion?: EmotionType): void {
    this.currentEmotion = emotion;
  }

  public setSubtext(subtext?: SubtextState, intensity: number = 0.7): void {
    this.currentSubtext = subtext;
    this.currentSubtextIntensity = intensity;
  }

  /**
   * Feed incoming token or text fragment.
   */
  feedText(
    textChunk: string,
    isFinal: boolean = false,
    options: StreamerOptions = {}
  ): StreamChunkResult[] {
    if (!this.isActive) {
      this.isActive = true;
    }

    if (options.subtext !== undefined) {
      this.currentSubtext = options.subtext;
      if (options.subtextIntensity !== undefined) {
        this.currentSubtextIntensity = options.subtextIntensity;
      }
    }
    if (options.emotion !== undefined) {
      this.currentEmotion = options.emotion;
    }

    this.queue.pushToken(textChunk);
    const chunks = this.queue.drain(isFinal, options);
    const results: StreamChunkResult[] = [];

    for (const c of chunks) {
      this.engine.scheduleGestures(c.gestures, 0.0, false);
      const renderFrames = Math.max(128, Math.ceil(c.duration * this.engine.sampleRate));
      // Advance C-ABI engine state
      this.engine.render(renderFrames);

      // Render smooth human-grade acoustic audio with continuous emotional prosody and subtext
      const audio = this.synth.synthesizePlan(
        c.gestures,
        c.duration,
        this.engine.body,
        DEFAULT_LARYNGEAL,
        {
          emotion: options.emotion ?? this.currentEmotion,
          subtext: options.subtext ?? this.currentSubtext,
          subtextIntensity: options.subtextIntensity ?? this.currentSubtextIntensity,
          continuous: true,
        }
      );

      const tele = this.engine.getTelemetry();
      this.timelineClock = this.engine.clock;

      results.push({
        streamId: this.streamId,
        chunkIndex: this.chunkIndex++,
        audioBase64: toBase64Wav(audio, this.engine.sampleRate),
        durationMs: (audio.length / this.engine.sampleRate) * 1000,
        sampleCount: audio.length,
        voiceClock: this.timelineClock,
        telemetry: {
          f0: tele.f0,
          pLung: tele.pLung,
          outRms: tele.outRms,
          active: tele.active,
        },
        isFinal: c.isFinal,
      });
    }

    return results;
  }

  /**
   * Directly schedule raw articulatory gestures onto the continuous timeline.
   */
  feedGestures(
    gestures: Gesture[],
    lead: number = 0.0,
    replace: boolean = false,
    renderMs: number = 100,
    options: {
      emotion?: EmotionType;
      subtext?: SubtextState;
      subtextIntensity?: number;
    } = {}
  ): StreamChunkResult {
    this.engine.scheduleGestures(gestures, lead, replace);
    const renderFrames = Math.ceil((renderMs / 1000) * this.engine.sampleRate);
    this.engine.render(renderFrames);

    const audio = this.synth.synthesizePlan(
      gestures,
      renderMs / 1000,
      this.engine.body,
      DEFAULT_LARYNGEAL,
      {
        emotion: options.emotion ?? this.currentEmotion,
        subtext: options.subtext ?? this.currentSubtext,
        subtextIntensity: options.subtextIntensity ?? this.currentSubtextIntensity,
        continuous: true,
      }
    );
    const tele = this.engine.getTelemetry();
    this.timelineClock = this.engine.clock;

    return {
      streamId: this.streamId,
      chunkIndex: this.chunkIndex++,
      audioBase64: toBase64Wav(audio, this.engine.sampleRate),
      durationMs: (audio.length / this.engine.sampleRate) * 1000,
      sampleCount: audio.length,
      voiceClock: this.timelineClock,
      telemetry: {
        f0: tele.f0,
        pLung: tele.pLung,
        outRms: tele.outRms,
        active: tele.active,
      },
      isFinal: false,
    };
  }

  /**
   * Instant Barge-In Interruption (<25ms):
   * Cancels future score gestures, performs 20ms exponential lung decay, and flushes audio.
   */
  interrupt(): {
    interruptedAt: number;
    decayDurationMs: number;
    decayAudioBase64: string;
  } {
    // 1. Drop future scheduled gestures immediately
    this.engine.stopSpeech();
    this.queue.reset();
    this.synth.reset();

    // 2. Extinguish lung pressure & gate
    this.engine.setGate(0.0);
    this.engine.setSource({ pressure: 0.0 });

    // 3. Render 25ms decay
    const decayFrames = Math.ceil(0.025 * this.engine.sampleRate);
    const decayAudio = this.engine.render(decayFrames);

    this.isActive = false;

    return {
      interruptedAt: this.engine.clock,
      decayDurationMs: (decayFrames / this.engine.sampleRate) * 1000,
      decayAudioBase64: toBase64Wav(decayAudio, this.engine.sampleRate),
    };
  }

  flush(): Float32Array {
    return this.engine.render(512);
  }

  destroy(): void {
    this.engine.destroy();
  }
}
