/**
 * Domain E: Auditory Biofeedback & Self-Perception Tools ("The Ear")
 */
import { z } from "zod";
import { ChimeraEngine } from "../ffi/engine.ts";
import { analyzeAudio } from "../analysis/perception.ts";
import { callJson } from "../ffi/bindings.ts";

export const listenToSelfSchema = z.object({
  audioBase64: z.string().optional().describe("Base64 encoded WAV/PCM audio to analyze. If omitted, analyzes recent live voice."),
});

export const mapVowelSpaceSchema = z.object({
  gridResolution: z.number().min(3).max(9).default(5).describe("Grid density per dimension (e.g. 5 gives 5x5 = 25 motor exploration points)"),
});

export function registerPerceptionTools(engine: ChimeraEngine) {
  let modelId: number | null = null;
  let cachedFemale: number | null = null;
  let cachedChild: number | null = null;

  function ensureModel(): number {
    const curBody = engine.body;
    if (
      modelId === null ||
      cachedFemale !== curBody.female ||
      cachedChild !== curBody.child
    ) {
      const res = callJson<any>({
        fn: "model",
        body: curBody,
        sampleRate: engine.sampleRate,
      });
      modelId = res.model;
      cachedFemale = curBody.female;
      cachedChild = curBody.child;
    }
    return modelId!;
  }

  return {
    listen_to_self: async (args: z.infer<typeof listenToSelfSchema>) => {
      let samples: Float32Array;

      if (args.audioBase64) {
        // Decode base64 WAV
        const buf = Buffer.from(args.audioBase64, "base64");
        // Skip 44-byte WAV header if present
        const hasHeader = buf.subarray(0, 4).toString("ascii") === "RIFF";
        const offset = hasHeader ? 44 : 0;
        const numSamples = Math.floor((buf.length - offset) / 2);
        samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          const s16 = buf.readInt16LE(offset + i * 2);
          samples[i] = s16 / (s16 < 0 ? 0x8000 : 0x7fff);
        }
      } else {
        // Render 1024 frames of current acoustic state
        samples = engine.render(1024);
      }

      const perception = analyzeAudio(samples, engine.sampleRate);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              pitchHz: perception.f0,
              formantsHz: perception.formants,
              bandwidthsHz: perception.bandwidths,
              harmonicsToNoiseRatioDb: perception.hnrDb,
              loudnessRms: perception.rms,
              spectralCentroidHz: perception.spectralCentroid,
              analyzedDurationMs: perception.durationMs,
              acousticAssessment:
                perception.f0 > 0
                  ? `Voiced sound detected at f0=${perception.f0} Hz with F1=${perception.formants[0]} Hz, F2=${perception.formants[1]} Hz (HNR: ${perception.hnrDb} dB).`
                  : `Unvoiced / whisper acoustic profile with spectral centroid at ${perception.spectralCentroid} Hz.`,
            }),
          },
        ],
      };
    },

    map_vowel_space: async (args: z.infer<typeof mapVowelSpaceSchema>) => {
      const mid = ensureModel();
      const n = args.gridResolution;
      const results: {
        tbX: number;
        tbY: number;
        jaw: number;
        f1: number;
        f2: number;
        f3: number;
        f4: number;
      }[] = [];

      // Sweep tongue body X (front-back: -0.6 to 0.6) and Y (high-low: -0.6 to 0.6)
      const tbXSteps = Array.from({ length: n }, (_, i) => -0.6 + (1.2 * i) / (n - 1));
      const tbYSteps = Array.from({ length: n }, (_, i) => -0.6 + (1.2 * i) / (n - 1));

      for (const x of tbXSteps) {
        for (const y of tbYSteps) {
          // Coordinated jaw depression with lower tongue position
          const jaw = Math.max(0.0, -y * 0.6 + 0.2);
          const t = callJson<any>({
            fn: "transfer",
            model: mid,
            artic: {
              jaw,
              tbX: x,
              tbY: y,
              ttX: 0,
              ttY: 0,
              ttCurl: 0,
              root: 0,
              lipAp: 0.5,
              lipProt: 0,
              lipWidth: 0,
              labiodental: 0,
              velum: 0,
              larynx: 0,
              epilarynx: 0,
              ventricular: 0,
              lateral: 0,
              dorsum: 0,
            },
          });

          const formants = t.formants || [500, 1500, 2500, 3500];
          results.push({
            tbX: Math.round(x * 100) / 100,
            tbY: Math.round(y * 100) / 100,
            jaw: Math.round(jaw * 100) / 100,
            f1: Math.round(formants[0] ?? 500),
            f2: Math.round(formants[1] ?? 1500),
            f3: Math.round(formants[2] ?? 2500),
            f4: Math.round(formants[3] ?? 3500),
          });
        }
      }

      // Find extreme anchors: /i/ (min F1, max F2), /a/ (max F1, low F2), /u/ (min F1, min F2)
      let cornerI = results[0];
      let cornerA = results[0];
      let cornerU = results[0];

      for (const p of results) {
        if (p.f2 > cornerI.f2) cornerI = p;
        if (p.f1 > cornerA.f1) cornerA = p;
        if (p.f2 < cornerU.f2 && p.f1 < 450) cornerU = p;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              exploredMotorCoordinates: results.length,
              vowelQuadrilateralAnchors: {
                highFront_i: {
                  formants: [cornerI.f1, cornerI.f2],
                  articulators: { tbX: cornerI.tbX, tbY: cornerI.tbY, jaw: cornerI.jaw },
                },
                lowBack_a: {
                  formants: [cornerA.f1, cornerA.f2],
                  articulators: { tbX: cornerA.tbX, tbY: cornerA.tbY, jaw: cornerA.jaw },
                },
                highBack_u: {
                  formants: [cornerU.f1, cornerU.f2],
                  articulators: { tbX: cornerU.tbX, tbY: cornerU.tbY, jaw: cornerU.jaw },
                },
              },
              samplesSample: results.slice(0, 5),
              acousticVowelSpace: `F1 span: ${Math.min(...results.map((r) => r.f1))} - ${Math.max(...results.map((r) => r.f1))} Hz, F2 span: ${Math.min(...results.map((r) => r.f2))} - ${Math.max(...results.map((r) => r.f2))} Hz.`,
            }),
          },
        ],
      };
    },
  };
}
