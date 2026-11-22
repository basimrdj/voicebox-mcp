/**
 * 1-Word Lookahead Buffer for Conversational Speech Streaming
 * Manages token accumulation, word boundary detection, and Öhman substrate blending.
 */
import { ChimeraEngine } from "../ffi/engine.ts";
import type { Gesture, PlanOptions } from "../ffi/types.ts";

export interface LookaheadChunk {
  textToRender: string;
  isFinal: boolean;
  gestures: Gesture[];
  duration: number;
}

export class LookaheadQueue {
  private buffer: string = "";
  private pendingWords: string[] = [];

  constructor() {}

  pushToken(token: string): void {
    this.buffer += token;
    this.extractWords();
  }

  private extractWords(): void {
    // Split by whitespace or punctuation boundaries, retaining remainder
    const tokens = this.buffer.split(/(\s+|[.,!?;:])/g);
    // If we have multiple components, we can harvest completed words
    if (tokens.length > 2) {
      const completedText = tokens.slice(0, -1).join("");
      this.buffer = tokens[tokens.length - 1];
      const words = completedText.match(/\S+/g);
      if (words) {
        for (const w of words) {
          this.pendingWords.push(w);
        }
      }
    }
  }

  /**
   * Process pending buffer. If `isFinal` is true, flush everything remaining.
   */
  drain(isFinal: boolean, options: Partial<PlanOptions> = {}): LookaheadChunk[] {
    if (isFinal && this.buffer.trim().length > 0) {
      this.pendingWords.push(this.buffer.trim());
      this.buffer = "";
    }

    const chunks: LookaheadChunk[] = [];
    const baseOptions: PlanOptions = {
      body: options.body || { female: 0.5, child: 0.0 },
      t0: options.t0 || 0.0,
      rate: options.rate || 1.0,
      f0: options.f0 || 160.0,
      intonation: options.intonation || "statement",
      open_end: !isFinal,
    };

    while (this.pendingWords.length > 0) {
      // If not final and only 1 word is pending, hold it as lookahead unless buffer is empty
      if (!isFinal && this.pendingWords.length === 1 && this.buffer.trim().length === 0) {
        break;
      }

      const word = this.pendingWords.shift()!;
      const isWordFinal = isFinal && this.pendingWords.length === 0 && this.buffer.trim().length === 0;

      const phrases = ChimeraEngine.g2pPhrases(word);
      const planOpts: PlanOptions = {
        ...baseOptions,
        open_end: !isWordFinal,
      };

      const plan = ChimeraEngine.planPhrases(phrases, planOpts);

      chunks.push({
        textToRender: word,
        isFinal: isWordFinal,
        gestures: plan.gestures,
        duration: plan.end - (baseOptions.t0 || 0),
      });
    }

    return chunks;
  }

  reset(): void {
    this.buffer = "";
    this.pendingWords = [];
  }
}
