/**
 * VoiceBox Phase 3 — Articulatory-Acoustic Mapping
 * 
 * Implements acoustic perturbation theory and vocal tract kinematics
 * (Story 2005, Stevens 1998, Fant 1960, Titze 2008).
 * 
 * Maps continuous 12-dimensional articulatory coordinates to formant
 * frequencies (F1-F5) and bandwidths (B1-B5).
 */

import { type ArticulatorPosition } from "./vocal_trajectory.ts";

export interface VocalTractAcoustics {
  formants: [number, number, number, number, number];
  bandwidths: [number, number, number, number, number];
  nasalGain: number;
  epilarynxBoostGain: number;
}

export type ArticulatorKinematics = VocalTractAcoustics;

/**
 * Baseline neutral adult male vocal tract (uniform 17.5 cm tube, Fant 1960).
 * Fn = (2n - 1) * c / (4 * L) with c = 35000 cm/s, L = 17.5 cm:
 * F1 = 500 Hz, F2 = 1500 Hz, F3 = 2500 Hz, F4 = 3500 Hz, F5 = 4500 Hz.
 */
export const NEUTRAL_FORMANTS: [number, number, number, number, number] = [
  500.0, 1500.0, 2500.0, 3500.0, 4500.0,
];

export const NEUTRAL_BANDWIDTHS: [number, number, number, number, number] = [
  60.0, 90.0, 130.0, 200.0, 280.0,
];

/**
 * Computes exact formant frequencies and bandwidths from articulatory kinematics.
 */
export function articulatorsToAcoustics(
  articulators: ArticulatorPosition,
  baseLengthCm: number = 17.5
): VocalTractAcoustics {
  // 1. Vocal tract length perturbation via larynx vertical displacement and lip protrusion
  // Elevating larynx shortens tract (-1.5cm max); lowering lengthens (+1.5cm max).
  // Lip protrusion lengthens tract (+1.0cm max).
  const deltaLength = -articulators.larynx * 1.2 + articulators.lipProtrusion * 1.0;
  const effectiveLengthCm = Math.max(12.0, Math.min(22.0, baseLengthCm + deltaLength));
  // Global length scaling factor: Fn is inversely proportional to length
  const lengthScale = baseLengthCm / effectiveLengthCm;

  // 2. Jaw opening perturbation
  // Opening jaw (positive) widens oral opening, raising F1 by up to +300 Hz and slightly raising F2
  const dJawF1 = articulators.jaw * 240.0;
  const dJawF2 = articulators.jaw * 80.0;

  // 3. Tongue body positioning (Story, 2005)
  // Tongue Body X (front-back):
  // Fronting (+1) raises F2 (up to +900 Hz for /i/) and slightly lowers F1 (-80 Hz).
  // Backing (-1) lowers F2 (down to -650 Hz for /u/, /ɑ/).
  const dTbXF1 = -articulators.tongueBodyX * 80.0;
  const dTbXF2 = articulators.tongueBodyX * 650.0;
  const dTbXF3 = articulators.tongueBodyX * 250.0;

  // Tongue Body Y (high-low):
  // Raising tongue (+1) constricts palatal/velar region: lowers F1 (down to -200 Hz).
  // Lowering tongue (-1) expands pharyngeal region: raises F1 (up to +250 Hz for /a/).
  const dTbYF1 = -articulators.tongueBodyY * 220.0;
  const dTbYF2 = articulators.tongueBodyY * 180.0;

  // 4. Tongue tip elevation
  // Alveolar/retroflex contact: raises F2, sharply depresses F3 (retroflex pinch)
  const dTtYF3 = articulators.tongueTipY > 0 ? -articulators.tongueTipY * 400.0 : 0.0;
  const dTtCurlF3 = -articulators.tongueTipCurl * 700.0; // /r/ coloring lowers F3 into ~1600 Hz

  // 5. Lip aperture and protrusion (lip rounding)
  // Rounding/constricting lips lowers all formants, particularly F2 and F3
  const lipConstriction = (1.0 - Math.max(0.0, Math.min(1.0, articulators.lipAperture))) * 0.5 + articulators.lipProtrusion * 0.5;
  const dLipF1 = -lipConstriction * 120.0;
  const dLipF2 = -lipConstriction * 350.0;
  const dLipF3 = -lipConstriction * 220.0;

  // 6. Epilaryngeal narrowing (Titze 2008)
  // When epilarynx constricts, F4 and F5 cluster towards F3, generating the "speaker's ring" (2.8 - 3.2 kHz)
  const epi = Math.max(0.0, Math.min(1.0, articulators.epilarynx));
  const epilarynxBoostGain = epi * 1.8;

  // Assemble formants with length scaling and perturbation sums
  let f1 = (NEUTRAL_FORMANTS[0] + dJawF1 + dTbXF1 + dTbYF1 + dLipF1) * lengthScale;
  let f2 = (NEUTRAL_FORMANTS[1] + dJawF2 + dTbXF2 + dTbYF2 + dLipF2) * lengthScale;
  let f3 = (NEUTRAL_FORMANTS[2] + dTbXF3 + dTtYF3 + dTtCurlF3 + dLipF3) * lengthScale;
  let f4 = (NEUTRAL_FORMANTS[3] - epi * 250.0) * lengthScale;
  let f5 = (NEUTRAL_FORMANTS[4] - epi * 300.0) * lengthScale;

  // Clamp within physiologically plausible bounds for human vocal tract
  f1 = Math.max(180.0, Math.min(1100.0, f1));
  f2 = Math.max(f1 + 150.0, Math.min(3200.0, f2));
  f3 = Math.max(f2 + 200.0, Math.min(4200.0, f3));
  f4 = Math.max(f3 + 250.0, Math.min(5200.0, f4));
  f5 = Math.max(f4 + 300.0, Math.min(6500.0, f5));

  // 7. Bandwidths: modified by velum (nasal damping) and epilaryngeal constriction
  const velumLowering = Math.max(0.0, articulators.velum); // > 0 means velum lowered
  const nasalGain = velumLowering * 0.8;

  const b1 = NEUTRAL_BANDWIDTHS[0] + velumLowering * 60.0; // Nasal coupling broadens F1
  const b2 = NEUTRAL_BANDWIDTHS[1] + velumLowering * 40.0;
  const b3 = Math.max(70.0, NEUTRAL_BANDWIDTHS[2] - epi * 40.0); // Epilarynx narrows F3 bandwidth
  const b4 = Math.max(90.0, NEUTRAL_BANDWIDTHS[3] - epi * 50.0);
  const b5 = NEUTRAL_BANDWIDTHS[4];

  return {
    formants: [f1, f2, f3, f4, f5],
    bandwidths: [b1, b2, b3, b4, b5],
    nasalGain,
    epilarynxBoostGain,
  };
}
