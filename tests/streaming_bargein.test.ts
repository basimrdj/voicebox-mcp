import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { VoiceStreamer } from "../src/streaming/streamer.ts";
import { ChimeraEngine } from "../src/ffi/engine.ts";

describe("Real-Time Conversational Streaming & Barge-In", () => {
  let streamer: VoiceStreamer;
  let engine: ChimeraEngine;

  beforeAll(() => {
    engine = new ChimeraEngine(48000);
    streamer = new VoiceStreamer("test_stream", engine);
  });

  it("buffers tokens until word boundary and yields audio chunks", () => {
    // Feed partial word
    const res1 = streamer.feedText("Hel", false);
    // Partial word held in buffer: chunksRendered should be 0
    expect(res1.length).toBe(0);

    // Feed completion of word with space delimiter
    const t0 = performance.now();
    const res2 = streamer.feedText("lo ", false);
    // When next token boundary completes, lookahead queue yields word
    // (either immediately or upon next token)
    const res3 = streamer.feedText("world ", false);
    const elapsedMs = performance.now() - t0;

    // Verify Time-To-First-Audio compute latency is well under conversational target (<500ms on virtualized 2-vCPU VM)
    expect(elapsedMs).toBeLessThan(500);
    expect(res2.length + res3.length).toBeGreaterThan(0);

    const firstChunk = (res2.length > 0 ? res2 : res3)[0];
    expect(firstChunk.audioBase64.length).toBeGreaterThan(100);
    expect(firstChunk.durationMs).toBeGreaterThan(50);
  });

  it("handles multi-word tokens and maintains 1-word lookahead buffer", () => {
    const multiStreamer = new VoiceStreamer("multi_word_stream", engine);
    // Push multi-word string
    const res = multiStreamer.feedText("The quick brown fox ", false);
    // Should yield 3 words immediately ("The", "quick", "brown"), holding 1 word ("fox") as lookahead
    expect(res.length).toBe(3);
    for (const chunk of res) {
      expect(chunk.isFinal).toBe(false);
      expect(chunk.audioBase64).toBeDefined();
    }

    // Now final turn completion flushes the held lookahead ("fox")
    const finalRes = multiStreamer.feedText("", true);
    expect(finalRes.length).toBe(1);
    expect(finalRes[0].isFinal).toBe(true);
  });

  it("flushes remaining buffer on isFinal turn completion", () => {
    streamer.feedText("VoiceBox", false);
    const finalChunks = streamer.feedText("", true);
    expect(finalChunks.length).toBeGreaterThan(0);
    expect(finalChunks[finalChunks.length - 1].isFinal).toBe(true);
  });

  it("executes conversational barge-in interruption within 25ms", () => {
    // Schedule ongoing speech
    streamer.feedText("This is a long sentence that will be interrupted while speaking.", false);

    // Trigger instant interruption (barge-in)
    const tStart = performance.now();
    const interruptResult = streamer.interrupt();
    const interruptComputeMs = performance.now() - tStart;

    // Verify interrupt computation is ultra-fast (<15ms)
    expect(interruptComputeMs).toBeLessThan(15);

    // Verify decay duration is within physiological cutoff target (<=25ms)
    expect(interruptResult.decayDurationMs).toBeLessThanOrEqual(25.5);
    expect(interruptResult.decayAudioBase64).toBeDefined();

    // Verify subsequent rendered audio is silent (decayed to zero, < -35 dB)
    const postSilence = engine.render(256);
    let maxAmp = 0;
    for (let i = 0; i < postSilence.length; i++) {
      if (Math.abs(postSilence[i]) > maxAmp) maxAmp = Math.abs(postSilence[i]);
    }
    expect(maxAmp).toBeLessThan(0.02);
  });

  afterAll(() => {
    if (streamer) streamer.destroy();
  });
});
