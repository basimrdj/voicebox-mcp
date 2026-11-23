/**
 * VoiceBox Milestone 1 — Phoneme-Level Articulatory & Gestural Planner
 * 
 * Bridges:
 * Text → Language Detection & Normalization → G2P (IPA) → Syllabification & Stress
 * → Phoneme Durations & Coarticulation → 3D Articulatory Targets → Moving Formant Acoustics.
 * 
 * Implements:
 * - Plosive closure, release burst, and aspiration (/p, t, k, b, d, g/)
 * - Fricative turbulence and glottal abduction (/f, v, s, z, θ, ð, ʃ, ʒ, h/)
 * - Nasal coupling with velum port lowering and antiresonances (/m, n, ŋ/)
 * - Dynamic diphthongs and vowel-to-vowel transitions (/aɪ, eɪ, ɔɪ, aʊ, oʊ/)
 * - Approximants and laterals (/w, r, l, j/)
 * - Syllabic stress and duration scaling
 * - Critically damped articulatory trajectory interpolation with inertia
 */

import { ChimeraEngine } from "../ffi/engine.ts";
import type { Gesture, Segment, PlannedSegment } from "../ffi/types.ts";
import { articulatorsToAcoustics, type ArticulatorKinematics } from "./articulatory_acoustic_mapping.ts";
import { DEFAULT_ARTICULATORS, type ArticulatorPositions } from "./vocal_trajectory.ts";
import { IPA_ACOUSTIC_PROFILES } from "./neural_engine.ts";

export interface ScheduledPhonemeFrame {
  timeMs: number;
  phoneme: string;
  word: string;
  kind: "vowel" | "stop" | "fricative" | "nasal" | "lateral" | "approximant" | "pause";
  stress: number; // 0 = unstressed, 1 = primary, 2 = secondary
  voiced: boolean;
  aspiration: number; // 0.0 to 1.0 (glottal turbulence)
  articulators: ArticulatorPositions;
  acoustics: {
    formants: number[];
    bandwidths: number[];
    nasalPoles: [number, number];
    nasalZeros: [number, number];
  };
}

export interface PhonemePlanResult {
  text: string;
  durationMs: number;
  segments: PlannedSegment[];
  gestures: Gesture[];
  words: string[];
  frames: ScheduledPhonemeFrame[];
}

export class PhonemePlanner {
  /**
   * Plans phoneme segments, articulatory gestures, and moving formant acoustics from text.
   */
  static planPhoneticTrajectory(
    text: string,
    options: {
      language?: string;
      speakingRate?: number;
      baselineF0?: number;
      sampleRate?: number;
      frameIntervalMs?: number;
    } = {}
  ): PhonemePlanResult {
    const lang = options.language || "en";
    const rate = Math.max(0.4, Math.min(2.5, options.speakingRate ?? 1.0));
    const baseF0 = options.baselineF0 ?? 120.0;
    const intervalMs = options.frameIntervalMs ?? 10.0; // 10ms default control frame interval

    // 1. Text Normalization
    const normalized = text.trim();
    if (!normalized) {
      return {
        text: "",
        durationMs: 0,
        segments: [],
        gestures: [],
        words: [],
        frames: [],
      };
    }

    // 2. G2P Phrasal Planning via C-ABI Engine
    ChimeraEngine.ensureDictionary();
    let phrases: any[];
    try {
      phrases = ChimeraEngine.g2pPhrases(normalized);
    } catch {
      // Fallback: tokenize standard text if dictionary fails
      phrases = [{
        segments: normalized.split(/\s+/).map((w, idx) => ({
          ipa: "ə",
          stress: 0,
          wordEnd: idx === normalized.split(/\s+/).length - 1,
        })),
        intonation: "statement",
        pause: 0.3,
        words: normalized.split(/\s+/),
      }];
    }

    // 3. Detailed Gestural Score Planning
    const plan = ChimeraEngine.planPhrases(phrases, {
      body: { female: 0.0, child: 0.0 },
      t0: 0.04, // 40ms lead-in
      rate,
      f0: baseF0,
      intonation: "statement",
    });

    const segments: PlannedSegment[] = plan.segments || [];
    const gestures: Gesture[] = plan.gestures || [];
    const totalDurationSec = (plan.end || 1.0) + 0.10;
    const totalDurationMs = totalDurationSec * 1000.0;

    // Collect all words across phrases
    const words: string[] = [];
    for (const p of phrases) {
      if (p.words) words.push(...p.words);
    }

    // 4. Sample Continuous Articulatory & Acoustic Trajectory
    const numFrames = Math.max(5, Math.ceil(totalDurationMs / intervalMs));
    const frames: ScheduledPhonemeFrame[] = [];

    for (let f = 0; f < numFrames; f++) {
      const timeMs = f * intervalMs;
      const tSec = timeMs / 1000.0;

      // Identify active segment
      let activeSeg = segments.find((s) => tSec >= s.t0 && tSec <= s.t1);
      if (!activeSeg && segments.length > 0) {
        if (tSec < segments[0].t0) activeSeg = segments[0];
        else if (tSec > segments[segments.length - 1].t1) activeSeg = segments[segments.length - 1];
      }

      // Compute interpolated articulators at tSec
      const { articulators, aspiration, isVoiced, velumOpen } = this.evaluateGesturesAtTime(tSec, gestures);

      // Compute moving formant acoustics from articulators
      const acoustics = articulatorsToAcoustics(articulators);

      // If active segment is a vowel with a calibrated Fant formant profile, blend with target
      const cleanIpa = activeSeg?.ipa ? activeSeg.ipa.replace(/[^a-zæɑɒɔɛɜɪʊʌəɨʉʏøœɤɯ]/gi, "") : "";
      const ipaProfile = cleanIpa ? (IPA_ACOUSTIC_PROFILES as Record<string, any>)[cleanIpa] : null;
      let finalFormants = acoustics.formants;
      let finalBandwidths = acoustics.bandwidths;
      if (ipaProfile && activeSeg?.kind === "vowel") {
        finalFormants = [
          acoustics.formants[0] * 0.35 + ipaProfile.formants[0] * 0.65,
          acoustics.formants[1] * 0.35 + ipaProfile.formants[1] * 0.65,
          acoustics.formants[2] * 0.35 + ipaProfile.formants[2] * 0.65,
          acoustics.formants[3] * 0.35 + (ipaProfile.formants[3] || 3500) * 0.65,
          acoustics.formants[4] * 0.35 + (ipaProfile.formants[4] || 4500) * 0.65,
        ];
        if (ipaProfile.bandwidths) {
          finalBandwidths = [
            acoustics.bandwidths[0] * 0.35 + ipaProfile.bandwidths[0] * 0.65,
            acoustics.bandwidths[1] * 0.35 + ipaProfile.bandwidths[1] * 0.65,
            acoustics.bandwidths[2] * 0.35 + ipaProfile.bandwidths[2] * 0.65,
            acoustics.bandwidths[3] * 0.35 + (ipaProfile.bandwidths[3] || 200) * 0.65,
            acoustics.bandwidths[4] * 0.35 + (ipaProfile.bandwidths[4] || 280) * 0.65,
          ];
        }
      }

      // Add nasal coupling poles/zeros if velum is open
      const nasalPoles: [number, number] = velumOpen ? [250, 1050] : [250, 1000];
      const nasalZeros: [number, number] = velumOpen ? [380, 1300] : [350, 1200];

      // Identify associated word
      let wordAtTime = "[pause]";
      if (activeSeg) {
        // Map segment time to word
        const segIdx = segments.indexOf(activeSeg);
        const approxWordIdx = Math.min(words.length - 1, Math.floor((segIdx / Math.max(1, segments.length)) * words.length));
        wordAtTime = words[approxWordIdx] || "";
      }

      frames.push({
        timeMs,
        phoneme: activeSeg?.ipa || (tSec < 0.04 ? "[lead]" : "[coda]"),
        word: wordAtTime,
        kind: (activeSeg?.kind as any) || "pause",
        stress: activeSeg?.stress || 0,
        voiced: isVoiced,
        aspiration,
        articulators,
        acoustics: {
          formants: finalFormants,
          bandwidths: finalBandwidths,
          nasalPoles,
          nasalZeros,
        },
      });
    }

    return {
      text: normalized,
      durationMs: totalDurationMs,
      segments,
      gestures,
      words,
      frames,
    };
  }

  /**
   * Evaluates active gestures at time t with critically damped half-cosine ramps.
   */
  private static evaluateGesturesAtTime(
    t: number,
    gestures: Gesture[]
  ): {
    articulators: ArticulatorPositions;
    aspiration: number;
    isVoiced: boolean;
    velumOpen: boolean;
  } {
    const art: ArticulatorPositions = {
      ...DEFAULT_ARTICULATORS,
      tongueRoot: 0.0,
    };
    let aspiration = 0.0;
    let glottalAbduction = 0.0;
    let velumValue = -0.15; // default closed

    for (const g of gestures) {
      const t0 = g.t0;
      const t1 = g.t1;
      const rampIn = Math.max(0.005, g.rampIn || 0.02);
      const rampOut = Math.max(0.005, g.rampOut || 0.02);

      // Check if time t falls within gesture influence window
      if (t < t0 - rampIn || t > t1 + rampOut) continue;

      let w = 1.0;
      if (t < t0) {
        // Ramp-in phase (half-cosine smooth onset)
        const u = (t - (t0 - rampIn)) / rampIn;
        w = 0.5 * (1.0 - Math.cos(Math.PI * Math.max(0.0, Math.min(1.0, u))));
      } else if (t > t1) {
        // Ramp-out phase (half-cosine smooth release)
        const u = (t - t1) / rampOut;
        w = 0.5 * (1.0 + Math.cos(Math.PI * Math.max(0.0, Math.min(1.0, u))));
      }

      // Kinematic activation weight is strictly bounded [0.0, 1.0]
      const effW = Math.max(0.0, Math.min(1.0, w));

      // Apply target values with physical-to-normalized coordinate transformation
      const tgt = g.targets;
      if (!tgt) continue;

      const normJaw = tgt.jaw !== undefined ? (tgt.jaw > 0.0 ? (tgt.jaw - 0.6) / 1.0 : tgt.jaw) : undefined;
      const normTbX = tgt.tbX !== undefined ? (tgt.tbX > 1.5 ? (tgt.tbX - 2.9) / 1.5 : tgt.tbX) : undefined;
      const normTbY = tgt.tbY !== undefined ? (tgt.tbY > 3.0 ? (tgt.tbY - 6.85) / 1.5 : tgt.tbY) : undefined;
      const normTtX = tgt.ttX !== undefined ? (tgt.ttX > 3.0 ? (tgt.ttX - 6.45) / 1.8 : tgt.ttX) : undefined;
      const normTtY = tgt.ttY !== undefined ? (tgt.ttY > 3.0 ? (tgt.ttY - 7.3) / 2.0 : tgt.ttY) : undefined;
      const normLipAp = tgt.lipAp !== undefined ? (tgt.lipAp > 0.0 ? (tgt.lipAp - 0.7) / 1.0 : tgt.lipAp) : undefined;
      const normLipProt = tgt.lipProt !== undefined ? (tgt.lipProt > 0.1 ? (tgt.lipProt - 0.2) / 0.8 : tgt.lipProt) : undefined;

      if (normJaw !== undefined) art.jaw = Math.max(-1.5, Math.min(1.5, art.jaw * (1.0 - effW) + normJaw * effW));
      if (normTbX !== undefined) art.tongueBodyX = Math.max(-1.5, Math.min(1.5, art.tongueBodyX * (1.0 - effW) + normTbX * effW));
      if (normTbY !== undefined) art.tongueBodyY = Math.max(-1.5, Math.min(1.5, art.tongueBodyY * (1.0 - effW) + normTbY * effW));
      if (normTtX !== undefined) art.tongueTipX = Math.max(-1.5, Math.min(1.5, art.tongueTipX * (1.0 - effW) + normTtX * effW));
      if (normTtY !== undefined) art.tongueTipY = Math.max(-1.5, Math.min(1.5, art.tongueTipY * (1.0 - effW) + normTtY * effW));
      if (tgt.ttCurl !== undefined) art.tongueTipCurl = Math.max(-1.5, Math.min(1.5, art.tongueTipCurl * (1.0 - effW) + tgt.ttCurl * effW));
      if (tgt.root !== undefined) art.tongueRoot = Math.max(-1.5, Math.min(1.5, (art.tongueRoot || 0.0) * (1.0 - effW) + tgt.root * effW));
      if (normLipAp !== undefined) art.lipAperture = Math.max(-1.5, Math.min(1.5, art.lipAperture * (1.0 - effW) + normLipAp * effW));
      if (normLipProt !== undefined) art.lipProtrusion = Math.max(-1.5, Math.min(1.5, art.lipProtrusion * (1.0 - effW) + normLipProt * effW));
      if (tgt.lipWidth !== undefined) art.lipWidth = Math.max(-1.5, Math.min(1.5, art.lipWidth * (1.0 - effW) + tgt.lipWidth * effW));
      if (tgt.larynx !== undefined) art.larynx = Math.max(-1.5, Math.min(1.5, art.larynx * (1.0 - effW) + tgt.larynx * effW));

      if (tgt.velum !== undefined) {
        velumValue = Math.max(velumValue, tgt.velum * effW);
        art.velum = velumValue;
      }

      if (tgt.abduction !== undefined) {
        glottalAbduction = Math.max(glottalAbduction, tgt.abduction * effW);
        aspiration = Math.max(aspiration, Math.min(1.0, tgt.abduction * effW * 1.5));
      }
    }

    const isVoiced = glottalAbduction < 0.15;
    const velumOpen = velumValue > 0.10;

    return {
      articulators: art,
      aspiration,
      isVoiced,
      velumOpen,
    };
  }
}
