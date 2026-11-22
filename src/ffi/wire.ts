/**
 * Binary wire format serialization for CHIMERA C-ABI.
 * GestureRecord: 272 bytes little-endian.
 * StepRecord: 48 bytes little-endian.
 */
import type { Gesture, BeatStepRecord } from "./types.ts";

export const LAYOUT_VERSION = 1;
export const GESTURE_RECORD = 272;
export const STEP_RECORD = 48;
export const MAX_GESTURES = 4000;
export const MAX_BEAT_STEPS = 256;
export const LABEL_CAP = 24;

export const CONTROL_KEYS = [
  "jaw", "tbX", "tbY", "ttX", "ttY", "ttCurl", "root", "lipAp", "lipProt", "lipWidth", "labiodental", "velum", "larynx", "epilarynx", "ventricular", "lateral", "dorsum",
  "abduction", "closure", "breath", "f0", "vibrato",
] as const;

export const KEY_INDEX: Record<string, number> = Object.fromEntries(
  CONTROL_KEYS.map((k, i) => [k, i])
);

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function fromUtf8(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

/**
 * Write gestures into ArrayBuffer at offset `at`.
 */
export function writeGestures(
  buf: ArrayBuffer,
  at: number,
  gestures: readonly Gesture[],
  max: number = MAX_GESTURES
): number {
  const n = Math.min(gestures.length, max);
  const dv = new DataView(buf, at, n * GESTURE_RECORD);
  const bytes = new Uint8Array(buf, at, n * GESTURE_RECORD);
  const enc = new TextEncoder();

  for (let i = 0; i < n; i++) {
    const g = gestures[i];
    const o = i * GESTURE_RECORD;
    const head = [
      g.t0,
      g.t1,
      g.rampIn,
      g.rampOut,
      g.strength,
      g.speed ?? NaN,
      g.releaseHold ?? NaN,
      g.tag ?? NaN,
    ];
    for (let j = 0; j < 8; j++) dv.setFloat64(o + j * 8, head[j], true);
    for (let k = 0; k < CONTROL_KEYS.length; k++) {
      dv.setFloat64(o + 64 + k * 8, NaN, true);
    }
    for (const [key, value] of Object.entries(g.targets)) {
      const k = KEY_INDEX[key];
      if (k !== undefined && typeof value === "number") {
        dv.setFloat64(o + 64 + k * 8, value, true);
      }
    }
    if (g.label === undefined) {
      bytes[o + 240] = 255;
    } else {
      let b = enc.encode(g.label);
      if (b.length > LABEL_CAP) {
        let len = LABEL_CAP;
        while (len > 0 && (b[len] & 0xc0) === 0x80) len--;
        b = b.slice(0, len);
      }
      bytes[o + 240] = b.length;
      bytes.set(b, o + 241);
    }
  }
  return n;
}

/**
 * Write beatbox steps into ArrayBuffer at offset `at`.
 */
export function writeSteps(
  buf: ArrayBuffer,
  at: number,
  steps: readonly (BeatStepRecord | null)[],
  max: number = MAX_BEAT_STEPS
): number {
  const n = Math.min(steps.length, max);
  const dv = new DataView(buf, at, n * STEP_RECORD);
  const bytes = new Uint8Array(buf, at, n * STEP_RECORD);
  const enc = new TextEncoder();

  for (let i = 0; i < n; i++) {
    const s = steps[i];
    const o = i * STEP_RECORD;
    if (!s) {
      bytes[o] = 255;
      continue;
    }
    const b = enc.encode(s.id).slice(0, LABEL_CAP);
    bytes[o] = b.length;
    bytes.set(b, o + 1);
    dv.setFloat64(o + 32, s.note ?? NaN, true);
    dv.setFloat64(o + 40, s.accent ?? NaN, true);
  }
  return n;
}
