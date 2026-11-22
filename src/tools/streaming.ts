/**
 * Domain F: Real-Time Conversational Streaming Tools
 */
import { z } from "zod";
import { ChimeraEngine } from "../ffi/engine.ts";
import { VoiceStreamer } from "../streaming/streamer.ts";
import { subtextStateEnum } from "./speech.ts";

export const streamPhonemicSpeechSchema = z.object({
  textChunk: z.string().describe("Streaming token or text fragment from LLM (e.g. 'Hello', ' world')"),
  isFinal: z.boolean().default(false).describe("True if this is the final token of the agent's turn"),
  streamId: z.string().default("default").describe("Active voice stream session identifier"),
  returnAudio: z.boolean().default(true).describe("Whether to return synthesized base64 WAV chunks in response"),
  subtext: subtextStateEnum.optional().describe("Involuntary limbic-PAG subtext psychological state"),
  subtextIntensity: z.number().min(0.0).max(1.0).default(0.7).describe("Intensity of subtext conditioning (0.0 - 1.0)"),
});

export const streamArticulatoryGesturesSchema = z.object({
  gestures: z
    .array(
      z.object({
        t0: z.number().describe("Gesture start time relative to chunk onset (s)"),
        t1: z.number().describe("Gesture target reach time (s)"),
        rampIn: z.number().default(0.02).describe("Raised-cosine entry ramp duration (s)"),
        rampOut: z.number().default(0.02).describe("Raised-cosine exit ramp duration (s)"),
        strength: z.number().default(10.0).describe("Strength weighting in multi-tier gestural blend"),
        targets: z.record(z.string(), z.number()).describe("Target values for articulators or source"),
        label: z.string().optional().describe("Phoneme / gesture label"),
      })
    )
    .min(1)
    .describe("Array of gestural records to schedule into continuous score"),
  leadMs: z.number().default(0).describe("Time lead relative to voice clock (ms)"),
  replace: z.boolean().default(false).describe("False = append to timeline; True = replace active gestures"),
  renderMs: z.number().min(20).max(1000).default(100).describe("Audio frames duration to render (ms)"),
  streamId: z.string().default("default"),
});

export const controlVoiceStreamSchema = z.object({
  action: z
    .enum(["start", "flush", "interrupt", "pause", "close"])
    .describe("Stream lifecycle action. 'interrupt' triggers instant barge-in (<25ms)"),
  streamId: z.string().default("default"),
});

export function registerStreamingTools(engine: ChimeraEngine) {
  const streamers = new Map<string, VoiceStreamer>();

  function getStreamer(id: string): VoiceStreamer {
    let s = streamers.get(id);
    if (!s) {
      s = new VoiceStreamer(id, engine);
      streamers.set(id, s);
    }
    return s;
  }

  return {
    stream_phonemic_speech: async (args: z.infer<typeof streamPhonemicSpeechSchema>) => {
      const streamer = getStreamer(args.streamId);
      const chunks = streamer.feedText(args.textChunk, args.isFinal, {
        body: engine.body,
        subtext: args.subtext,
        subtextIntensity: args.subtextIntensity,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              streamId: args.streamId,
              receivedToken: args.textChunk,
              isFinal: args.isFinal,
              chunksRendered: chunks.length,
              chunks: chunks.map((c) => ({
                chunkIndex: c.chunkIndex,
                durationMs: c.durationMs,
                sampleCount: c.sampleCount,
                voiceClock: c.voiceClock,
                telemetry: c.telemetry,
                audioBase64: args.returnAudio ? c.audioBase64 : undefined,
                isFinal: c.isFinal,
              })),
            }),
          },
        ],
      };
    },

    stream_articulatory_gestures: async (args: z.infer<typeof streamArticulatoryGesturesSchema>) => {
      const streamer = getStreamer(args.streamId);
      const res = streamer.feedGestures(
        args.gestures as any,
        args.leadMs / 1000,
        args.replace,
        args.renderMs
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              streamId: args.streamId,
              chunkIndex: res.chunkIndex,
              durationMs: res.durationMs,
              sampleCount: res.sampleCount,
              voiceClock: res.voiceClock,
              telemetry: res.telemetry,
              audioBase64: res.audioBase64,
            }),
          },
        ],
      };
    },

    control_voice_stream: async (args: z.infer<typeof controlVoiceStreamSchema>) => {
      const streamer = getStreamer(args.streamId);

      switch (args.action) {
        case "interrupt": {
          // Instant barge-in: stop score, 20ms lung decay, flush audio
          const interruptRes = streamer.interrupt();
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "interrupted",
                  action: "interrupt",
                  bargeInLatencyMs: interruptRes.decayDurationMs,
                  interruptedAtVoiceClock: interruptRes.interruptedAt,
                  decayAudioBase64: interruptRes.decayAudioBase64,
                  description: "Stream halted instantly (<25ms) via exponential lung pressure decay.",
                }),
              },
            ],
          };
        }
        case "flush": {
          streamer.flush();
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "flushed",
                  voiceClock: engine.clock,
                }),
              },
            ],
          };
        }
        case "close": {
          streamers.delete(args.streamId);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "closed",
                  streamId: args.streamId,
                }),
              },
            ],
          };
        }
        default: {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "ok",
                  action: args.action,
                  streamId: args.streamId,
                  voiceClock: engine.clock,
                }),
              },
            ],
          };
        }
      }
    },
  };
}
