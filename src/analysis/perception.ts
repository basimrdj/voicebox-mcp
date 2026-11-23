/**
 * Auditory Biofeedback & Self-Perception Engine
 * Implements LPC Formant Analysis, YIN Pitch Tracking, HNR, and Spectral Centroid.
 */
import type { AuditoryPerception } from "../ffi/types.ts";

/**
 * Autocorrelation / YIN-style fundamental frequency (f0) estimation with correlation score.
 */
export function estimatePitchWithCorr(samples: Float32Array, sampleRate: number = 48000): { f0: number; corr: number } {
  if (samples.length < 512) return { f0: 0, corr: 0 };

  const frameLen = Math.floor(sampleRate * 0.04); // 40ms
  const hop = Math.floor(sampleRate * 0.02); // 20ms
  const minLag = Math.floor(sampleRate / 600);
  const maxLag = Math.floor(sampleRate / 60);

  let globalBestCorr = 0;
  let globalBestLag = 0;
  let bestS = 0;

  for (let s = 0; s <= samples.length - frameLen - maxLag; s += hop) {
    let corrAtPeak = 0;
    let lagAtPeak = 0;
    let e = 0;
    for (let i = 0; i < frameLen; i++) e += samples[s + i] * samples[s + i];
    if (e / frameLen < 1e-4) continue;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      let n1 = 0;
      let n2 = 0;
      for (let i = 0; i < frameLen; i += 2) {
        const v1 = samples[s + i];
        const v2 = samples[s + i + lag];
        corr += v1 * v2;
        n1 += v1 * v1;
        n2 += v2 * v2;
      }
      const norm = Math.sqrt(n1 * n2);
      if (norm > 0) {
        const r = corr / norm;
        if (r > corrAtPeak) {
          corrAtPeak = r;
          lagAtPeak = lag;
        }
      }
    }
    if (corrAtPeak > globalBestCorr) {
      globalBestCorr = corrAtPeak;
      globalBestLag = lagAtPeak;
      bestS = s;
    }
  }

  // Octave-halving guard (Boersma 1993 / YIN): prefer smallest lag (fundamental period) if ratio >= 0.85
  if (globalBestLag > 0 && globalBestCorr > 0.40) {
    for (const divisor of [2, 3]) {
      const subLag = Math.round(globalBestLag / divisor);
      if (subLag >= minLag) {
        let cSub = 0, n1Sub = 0, n2Sub = 0;
        for (let i = 0; i < frameLen; i += 2) {
          const v1 = samples[bestS + i];
          const v2 = samples[bestS + i + subLag];
          cSub += v1 * v2;
          n1Sub += v1 * v1;
          n2Sub += v2 * v2;
        }
        const normSub = Math.sqrt(n1Sub * n2Sub);
        if (normSub > 0) {
          const rSub = cSub / normSub;
          if (rSub >= 0.85 * globalBestCorr) {
            globalBestLag = subLag;
            globalBestCorr = rSub;
            break;
          }
        }
      }
    }
  }

  const f0 = globalBestLag > 0 && globalBestCorr > 0.40 ? sampleRate / globalBestLag : 0;
  return { f0, corr: globalBestCorr };
}

export function estimatePitch(samples: Float32Array, sampleRate: number = 48000): number {
  return estimatePitchWithCorr(samples, sampleRate).f0;
}

/**
 * Levinson-Durbin algorithm for LPC coefficients.
 */
export function levinsonDurbin(samples: Float32Array, order: number = 14): Float64Array {
  // Autocorrelation of windowed samples
  const r = new Float64Array(order + 1);
  const n = samples.length;

  for (let lag = 0; lag <= order; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += samples[i] * samples[i + lag];
    }
    r[lag] = sum;
  }

  if (r[0] === 0) return new Float64Array(order + 1);

  const a = new Float64Array(order + 1);
  a[0] = 1.0;

  let e = r[0];

  for (let i = 1; i <= order; i++) {
    let acc = 0;
    for (let j = 1; j < i; j++) {
      acc += a[j] * r[i - j];
    }
    const k = -(r[i] + acc) / e;

    const prevA = a.slice();
    a[i] = k;
    for (let j = 1; j < i; j++) {
      a[j] = prevA[j] + k * prevA[i - j];
    }

    e *= 1.0 - k * k;
    if (e <= 0) break;
  }

  return a;
}

/**
 * Extract Formants (F1-F4) by evaluating LPC polynomial on unit circle.
 */
export function extractFormants(
  lpcCoeffs: Float64Array,
  sampleRate: number = 48000
): { formants: [number, number, number, number]; bandwidths: [number, number, number, number] } {
  // Evaluate frequency response from 100 Hz to 4500 Hz
  const numSteps = 500;
  const minFreq = 100;
  const maxFreq = 4500;
  const spectrum: { freq: number; mag: number }[] = [];

  for (let s = 0; s < numSteps; s++) {
    const f = minFreq + (s / (numSteps - 1)) * (maxFreq - minFreq);
    const omega = (2 * Math.PI * f) / sampleRate;

    // Denominator A(z) = 1 + sum a_k e^(-j k omega)
    let re = 1.0;
    let im = 0.0;
    for (let k = 1; k < lpcCoeffs.length; k++) {
      re += lpcCoeffs[k] * Math.cos(-k * omega);
      im += lpcCoeffs[k] * Math.sin(-k * omega);
    }
    const denom = re * re + im * im;
    const mag = 1.0 / (denom + 1e-12);
    spectrum.push({ freq: f, mag });
  }

  // Find local peaks in LPC spectrum
  const peaks: { freq: number; mag: number }[] = [];
  for (let i = 1; i < spectrum.length - 1; i++) {
    if (spectrum[i].mag > spectrum[i - 1].mag && spectrum[i].mag > spectrum[i + 1].mag) {
      peaks.push(spectrum[i]);
    }
  }

  peaks.sort((p1, p2) => p1.freq - p2.freq);

  // Defaults based on standard 17.5cm neutral tube (500, 1500, 2500, 3500)
  const defaultF: [number, number, number, number] = [500, 1500, 2500, 3500];
  const formants: [number, number, number, number] = [...defaultF];
  const bandwidths: [number, number, number, number] = [80, 100, 120, 150];

  for (let i = 0; i < Math.min(4, peaks.length); i++) {
    formants[i] = Math.round(peaks[i].freq);
  }

  return { formants, bandwidths };
}

/**
 * Calculate Harmonics-to-Noise Ratio (HNR in dB) using Boersma's autocorrelation method.
 */
export function calculateHNR(samples: Float32Array, pitch: number, sampleRate: number = 48000, maxCorr?: number): number {
  if (pitch <= 0 || samples.length < 512) return 0.0;
  const r = maxCorr !== undefined ? maxCorr : estimatePitchWithCorr(samples, sampleRate).corr;
  const clampedR = Math.min(0.999, Math.max(0.0, r));
  if (clampedR > 0.5) {
    const ratio = clampedR / (1.0 - clampedR);
    return Math.min(40.0, Math.max(0.0, 10 * Math.log10(ratio)));
  }
  return 0.0;
}

/**
 * Calculate Spectral Centroid (Hz).
 */
export function calculateSpectralCentroid(samples: Float32Array, sampleRate: number = 48000): number {
  const n = Math.min(1024, samples.length);
  let num = 0;
  let denom = 0;

  // Simple DFT magnitude approximation
  const numBins = 64;
  for (let k = 0; k < numBins; k++) {
    const freq = (k * sampleRate) / (2 * numBins);
    const omega = (Math.PI * k) / numBins;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += samples[i] * Math.cos(omega * i);
      im -= samples[i] * Math.sin(omega * i);
    }
    const mag = Math.sqrt(re * re + im * im);
    num += freq * mag;
    denom += mag;
  }

  return denom > 0 ? num / denom : 0;
}

/**
 * Full sensory auditory analysis of audio samples.
 */
export function analyzeAudio(samples: Float32Array, sampleRate: number = 48000): AuditoryPerception {
  let energy = 0;
  for (let i = 0; i < samples.length; i++) {
    energy += samples[i] * samples[i];
  }
  const rms = Math.sqrt(energy / Math.max(1, samples.length));

  const { f0, corr } = estimatePitchWithCorr(samples, sampleRate);

  // Decimated LPC for high-fidelity formant extraction according to Markel & Gray
  let formants: [number, number, number, number] = [500, 1500, 2500, 3500];
  let bandwidths: [number, number, number, number] = [80, 100, 120, 150];

  if (samples.length >= 512) {
    if (sampleRate >= 32000) {
      // Downsample by 3 to 16 kHz where formants F1-F4 reside
      const dsLen = Math.floor(samples.length / 3);
      const ds = new Float32Array(dsLen);
      for (let i = 0; i < dsLen; i++) {
        ds[i] = (samples[i * 3] + samples[i * 3 + 1] + samples[i * 3 + 2]) / 3;
      }
      const mid = Math.max(0, Math.floor(dsLen / 2) - 512);
      const windowed = ds.slice(mid, mid + Math.min(1024, dsLen - mid));
      for (let i = windowed.length - 1; i > 0; i--) windowed[i] -= 0.95 * windowed[i - 1];
      const lpc = levinsonDurbin(windowed, 16);
      const extracted = extractFormants(lpc, 16000);
      formants = extracted.formants;
      bandwidths = extracted.bandwidths;
    } else {
      const lpc = levinsonDurbin(samples, 14);
      const extracted = extractFormants(lpc, sampleRate);
      formants = extracted.formants;
      bandwidths = extracted.bandwidths;
    }
  }

  const hnrDb = calculateHNR(samples, f0, sampleRate, corr);
  const spectralCentroid = calculateSpectralCentroid(samples, sampleRate);
  const durationMs = (samples.length / sampleRate) * 1000;

  return {
    f0: Math.round(f0 * 10) / 10,
    formants,
    bandwidths,
    hnrDb: Math.round(hnrDb * 10) / 10,
    rms: Math.round(rms * 10000) / 10000,
    spectralCentroid: Math.round(spectralCentroid),
    durationMs: Math.round(durationMs * 10) / 10,
  };
}
