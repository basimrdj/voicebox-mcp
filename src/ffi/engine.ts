/**
 * High-level TypeScript wrapper around CHIMERA C-ABI audio engine.
 */
import { toArrayBuffer } from "bun:ffi";
import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { symbols, callJson } from "./bindings.ts";
import {
  writeGestures,
  writeSteps,
  GESTURE_RECORD,
  MAX_GESTURES,
  CONTROL_KEYS,
  STEP_RECORD,
  fromUtf8,
} from "./wire.ts";
import type {
  HumanArtic,
  VoiceSource,
  Gesture,
  VoiceTelemetry,
  Segment,
  Plan,
  PlanOptions,
  BeatStepRecord,
} from "./types.ts";

const ARTIC_KEYS = CONTROL_KEYS.slice(0, 17);
const SOURCE_KEYS = [
  "f0",
  "glide",
  "pressure",
  "breathiness",
  "tension",
  "fry",
  "roughness",
  "vibratoDepth",
  "vibratoRate",
  "drift",
  "voiced",
  "brightness",
];

export class ChimeraEngine {
  readonly handle: number;
  readonly sampleRate: number;
  public activeCreature: string = "human";
  private isDestroyed = false;
  private static dictionaryLoaded = false;

  constructor(sampleRate: number = 48000.0) {
    this.sampleRate = sampleRate;
    this.handle = symbols.engine_new(sampleRate) as number;
    ChimeraEngine.ensureDictionary();
  }

  static ensureDictionary(): void {
    if (this.dictionaryLoaded) return;
    try {
      // 1. CMUdict for English
      const cmuCandidates = [
        resolve(process.cwd(), "data/cmudict.txt.gz"),
        resolve(process.cwd(), "public/data/cmudict.txt.gz"),
        resolve(process.cwd(), "reference/chimera-vocal-synth/public/data/cmudict.txt.gz"),
        resolve("/home/user/chimera/public/data/cmudict.txt.gz"),
        resolve("/home/user/voicebox-mcp/data/cmudict.txt.gz"),
        resolve(import.meta.dir, "../../data/cmudict.txt.gz"),
        resolve(import.meta.dir, "../../../reference/chimera-vocal-synth/public/data/cmudict.txt.gz"),
      ];
      for (const p of cmuCandidates) {
        if (existsSync(p)) {
          const gz = readFileSync(p);
          const uncompressed = gunzipSync(gz).toString("utf-8");
          callJson({ fn: "g2pLoad", text: uncompressed });
          break;
        }
      }

      // 2. Mandarin Lexicon for Chinese
      const zhCandidates = [
        resolve(process.cwd(), "data/mandarin.txt.gz"),
        resolve(process.cwd(), "public/data/mandarin.txt.gz"),
        resolve(process.cwd(), "reference/chimera-vocal-synth/public/data/mandarin.txt.gz"),
        resolve("/home/user/chimera/public/data/mandarin.txt.gz"),
        resolve("/home/user/voicebox-mcp/data/mandarin.txt.gz"),
        resolve(import.meta.dir, "../../data/mandarin.txt.gz"),
        resolve(import.meta.dir, "../../../reference/chimera-vocal-synth/public/data/mandarin.txt.gz"),
      ];
      for (const p of zhCandidates) {
        if (existsSync(p)) {
          const gz = readFileSync(p);
          const uncompressed = gunzipSync(gz).toString("utf-8");
          callJson({ fn: "zhLoad", text: uncompressed });
          break;
        }
      }

      this.dictionaryLoaded = true;
    } catch (e) {
      console.warn("Could not load dictionaries:", e);
    }
  }

  destroy(): void {
    if (!this.isDestroyed) {
      symbols.engine_free(this.handle as any);
      this.isDestroyed = true;
    }
  }

  get clock(): number {
    return symbols.engine_clock(this.handle as any);
  }

  get body(): { female: number; child: number } {
    return {
      female: symbols.engine_body_female(this.handle as any),
      child: symbols.engine_body_child(this.handle as any),
    };
  }

  setBody(female: number, child: number): void {
    symbols.engine_set_body(this.handle as any, female, child);
  }

  setGate(level: number): void {
    symbols.engine_set_gate(this.handle as any, level);
  }

  static toPhysicalArtic(values: Partial<HumanArtic>): Partial<HumanArtic> {
    const isPhysical =
      (values.tbY !== undefined && values.tbY > 2.0) ||
      (values.tbX !== undefined && values.tbX > 2.0) ||
      (values.ttX !== undefined && values.ttX > 2.0) ||
      (values.ttY !== undefined && values.ttY > 2.0);

    if (isPhysical) return values;

    const phys: Partial<HumanArtic> = { ...values };
    if (values.jaw !== undefined) phys.jaw = 0.6 + values.jaw * 1.0;
    if (values.tbX !== undefined) phys.tbX = 2.9 + values.tbX * 1.5;
    if (values.tbY !== undefined) phys.tbY = 6.85 + values.tbY * 1.5;
    if (values.ttX !== undefined) phys.ttX = 6.45 + values.ttX * 1.8;
    if (values.ttY !== undefined) phys.ttY = 7.3 + values.ttY * 2.0;
    if (values.lipAp !== undefined) phys.lipAp = 0.7 + values.lipAp * 1.0;
    if (values.lipProt !== undefined) phys.lipProt = 0.2 + values.lipProt * 0.8;
    if (values.velum !== undefined) phys.velum = -0.15 + values.velum * 0.5;
    return phys;
  }

  setArtic(values: Partial<HumanArtic>, tipFree?: boolean): void {
    const physValues = ChimeraEngine.toPhysicalArtic(values);
    const valPtr = symbols.engine_values(this.handle as any);
    const buf = toArrayBuffer(valPtr!, 0, 32 * 8);
    const f64 = new Float64Array(buf);
    f64.fill(NaN);

    for (const [k, val] of Object.entries(physValues)) {
      const i = ARTIC_KEYS.indexOf(k as any);
      if (i >= 0 && typeof val === "number") {
        f64[i] = val;
      }
    }
    const tf = tipFree === undefined ? 2 : tipFree ? 1 : 0;
    symbols.engine_set_artic(this.handle as any, tf);
  }

  setSource(values: Partial<VoiceSource>): void {
    const valPtr = symbols.engine_values(this.handle as any);
    const buf = toArrayBuffer(valPtr!, 0, 32 * 8);
    const f64 = new Float64Array(buf);
    f64.fill(NaN);

    for (const [k, val] of Object.entries(values)) {
      const i = SOURCE_KEYS.indexOf(k);
      if (i >= 0) {
        f64[i] = typeof val === "boolean" ? (val ? 1.0 : 0.0) : (val as number);
      }
    }
    symbols.engine_set_source(this.handle as any);
  }

  scheduleGestures(gestures: readonly Gesture[], lead: number = 0.0, replace: boolean = true): number {
    const n = Math.min(gestures.length, MAX_GESTURES);
    if (n === 0) return this.clock;
    const recPtr = symbols.engine_records(this.handle as any);
    const recBuf = toArrayBuffer(recPtr!, 0, n * GESTURE_RECORD);
    writeGestures(recBuf, 0, gestures, n);
    return symbols.engine_schedule(this.handle as any, n, lead, replace ? 1 : 0);
  }

  stopSpeech(): void {
    symbols.engine_stop_speech(this.handle as any);
  }

  release(tag: number): void {
    symbols.engine_release(this.handle as any, tag);
  }

  setBeat(steps: (BeatStepRecord | null)[] | null, bpm: number = NaN, swing: number = NaN, playing?: boolean): void {
    let count = 0;
    let hasSteps = 0;
    if (steps && steps.length > 0) {
      hasSteps = 1;
      count = steps.length;
      const recPtr = symbols.engine_records(this.handle as any);
      const recBuf = toArrayBuffer(recPtr!, 0, count * STEP_RECORD);
      writeSteps(recBuf, 0, steps);
    }
    const p = playing === undefined ? 2 : playing ? 1 : 0;
    symbols.engine_set_beat(this.handle as any, hasSteps, count, bpm, swing, p);
  }

  beatHit(id: string, note?: number, accent?: number): void {
    const recPtr = symbols.engine_records(this.handle as any);
    const recBuf = toArrayBuffer(recPtr!, 0, STEP_RECORD);
    writeSteps(recBuf, 0, [{ id, note, accent }]);
    symbols.engine_beat_hit(this.handle as any);
  }

  setCreature(id: string, params: Record<string, number> = {}): void {
    if (id === "human") {
      symbols.engine_set_human(this.handle as any);
      this.activeCreature = "human";
      return;
    }
    const enc = new TextEncoder();
    const bytes = enc.encode(JSON.stringify({ id, params }));
    const p = symbols.chimera_alloc(bytes.length);
    if (!p) throw new Error("chimera_alloc failed");
    const buf = new Uint8Array(toArrayBuffer(p, 0, bytes.length));
    buf.set(bytes);
    const status = symbols.engine_set_creature(this.handle as any, p, bytes.length);
    symbols.chimera_free(p, bytes.length);
    if (status !== 0) {
      const resPtr = symbols.chimera_result_ptr();
      const resLen = Number(symbols.chimera_result_len());
      const resBuf = new Uint8Array(toArrayBuffer(resPtr!, 0, resLen));
      const res = JSON.parse(new TextDecoder().decode(resBuf));
      throw new Error(res.error || `Failed to set creature ${id}`);
    }
    this.activeCreature = id;
  }

  render(frames: number): Float32Array {
    if (frames <= 0) return new Float32Array(0);
    const out = new Float32Array(frames);
    let offset = 0;
    while (offset < frames) {
      const chunk = Math.min(frames - offset, 4096);
      const outPtr = symbols.engine_render(this.handle as any, chunk);
      const outBuf = toArrayBuffer(outPtr!, 0, chunk * 4);
      out.set(new Float32Array(outBuf), offset);
      offset += chunk;
    }
    return out;
  }

  getTelemetry(): VoiceTelemetry {
    const p = symbols.engine_telemetry(this.handle as any);
    // Read header (16 doubles)
    const headBuf = toArrayBuffer(p!, 0, 16 * 8);
    const head = new Float64Array(headBuf);
    const [phLen, orLen, velumPort, f0, voicing, pLung, outRms, noiseLevel, noiseNode, gate, clock, nArtic, nPh, nOr, nScope, nActive] = head;
    const totalDoubles = 16 + nArtic + 3 * (nPh + nOr) + 2 * nScope;

    const fullBuf = toArrayBuffer(p!, 0, totalDoubles * 8);
    const block = new Float64Array(fullBuf);

    let o = 16;
    const take = (count: number) => Float32Array.from(block.subarray(o, (o += count)));
    const artic = take(nArtic);
    const phAreas = take(nPh);
    const orAreas = take(nOr);
    const pressureRms = take(nPh + nOr);
    const flow = take(nPh + nOr);
    const glottalArea = take(nScope);
    const glottalFlow = take(nScope);

    const labelsPtr = symbols.engine_tele_labels(this.handle as any);
    const labelsBuf = new Uint8Array(toArrayBuffer(labelsPtr!, 0, 100));
    const active: string[] = [];
    for (let i = 0; i < nActive; i++) {
      const len = labelsBuf[i * 25];
      if (len > 0 && len <= 24) {
        active.push(fromUtf8(labelsBuf.subarray(i * 25 + 1, i * 25 + 1 + len)));
      }
    }

    return {
      artic,
      phAreas,
      orAreas,
      phLen,
      orLen,
      pressureRms,
      flow,
      velumPort,
      glottalArea,
      glottalFlow,
      f0,
      voicing,
      pLung,
      outRms,
      noiseLevel,
      noiseNode,
      gate,
      clock,
      active,
    };
  }

  // --- Static Helpers / Planning ---

  static tokenizeIpa(text: string): Segment[] {
    return callJson({ fn: "tokenizeIpa", text });
  }

  static g2pPhrases(text: string): any[] {
    ChimeraEngine.ensureDictionary();
    return callJson({ fn: "g2pPhrases", text });
  }

  static planPhrases(phrases: any[], options: PlanOptions): Plan {
    return callJson({ fn: "planPhrases", phrases, options });
  }

  static planUtterance(segments: Segment[], options: PlanOptions): Plan {
    return callJson({ fn: "planUtterance", segments, options });
  }

  static catalog(): any {
    return callJson({ fn: "catalog" });
  }
}
