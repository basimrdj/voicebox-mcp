/**
 * VoiceBox MCP - Core Biophysical Types
 * Based on Gunnar Fant's Source-Filter, Browman & Goldstein's Articulatory Phonology,
 * and the CHIMERA physical vocal tract modeling engine.
 */

export type ArticKey =
  | "jaw"
  | "tbX"
  | "tbY"
  | "ttX"
  | "ttY"
  | "ttCurl"
  | "root"
  | "lipAp"
  | "lipProt"
  | "lipWidth"
  | "labiodental"
  | "velum"
  | "larynx"
  | "epilarynx"
  | "ventricular"
  | "lateral"
  | "dorsum";

export type SourceKey = "abduction" | "closure" | "breath" | "f0" | "vibrato";
export type ControlKey = ArticKey | SourceKey;

export interface HumanArtic {
  jaw: number;
  tbX: number;
  tbY: number;
  ttX: number;
  ttY: number;
  ttCurl: number;
  root: number;
  lipAp: number;
  lipProt: number;
  lipWidth: number;
  labiodental: number;
  velum: number;
  larynx: number;
  epilarynx: number;
  ventricular: number;
  lateral: number;
  dorsum: number;
}

export interface ArticSpec {
  min: number;
  max: number;
  hz: number;
}

export interface BodyMix {
  female: number;
  child: number;
}

export interface HumanBody {
  name: string;
  scale: number;
  pharynx: number;
  tongueRadius: number;
  lipWidth: number;
  foldLength: number;
  openPhase: number;
}

export interface VoiceSource {
  f0: number;
  glide: number;
  pressure: number;
  breathiness: number;
  tension: number;
  fry: number;
  roughness: number;
  vibratoDepth: number;
  vibratoRate: number;
  drift: number;
  voiced: boolean;
  brightness: number;
}

export interface Gesture {
  t0: number;
  t1: number;
  rampIn: number;
  rampOut: number;
  strength: number;
  targets: Partial<Record<ControlKey, number>>;
  speed?: number;
  releaseHold?: number;
  label?: string;
  tag?: number;
}

export interface BeatStepRecord {
  id: string;
  note?: number;
  accent?: number;
}

export interface VoiceTelemetry {
  artic: Float32Array;
  phAreas: Float32Array;
  orAreas: Float32Array;
  phLen: number;
  orLen: number;
  pressureRms: Float32Array;
  flow: Float32Array;
  velumPort: number;
  glottalArea: Float32Array;
  glottalFlow: Float32Array;
  f0: number;
  voicing: number;
  pLung: number;
  outRms: number;
  noiseLevel: number;
  noiseNode: number;
  gate: number;
  clock: number;
  active: string[];
}

export interface Segment {
  ipa: string;
  stress?: number;
  wordEnd?: boolean;
}

export interface PlannedSegment {
  ipa: string;
  t0: number;
  t1: number;
  stress: number;
  kind?: string;
}

export interface PlanOptions {
  body: BodyMix;
  t0: number;
  rate?: number;
  f0?: number;
  intonation?: "statement" | "question" | "flat";
  accent?: number;
  open_end?: boolean;
  sung?: boolean;
}

export interface Plan {
  t0: number;
  end: number;
  gestures: Gesture[];
  segments: PlannedSegment[];
}

export interface CreatureDef {
  id: string;
  name: string;
  desc: string;
  params: { id: string; name: string; min: number; max: number; def: number }[];
  calls: { id: string; name: string }[];
}

export interface AuditoryPerception {
  f0: number;
  formants: [number, number, number, number];
  bandwidths: [number, number, number, number];
  hnrDb: number;
  rms: number;
  spectralCentroid: number;
  durationMs: number;
}
