/**
 * Domain D: Non-Verbal Gestures & Airstream Mechanics Tools
 */
import { z } from "zod";
import { ChimeraEngine } from "../ffi/engine.ts";
import { saveToVault, toBase64Wav } from "../vault/audio.ts";
import { analyzeAudio } from "../analysis/perception.ts";
import { callJson } from "../ffi/bindings.ts";

export const performVocalGestureSchema = z.object({
  gesture: z.enum([
    "sigh",
    "gasp",
    "chuckle",
    "laughter",
    "sob",
    "cry",
    "throat_clear",
    "growl",
    "scream",
    "whisper",
    "click",
    "ejective",
  ]).describe("Aerodynamic non-verbal vocal gesture"),
  intensity: z.number().min(0.1).max(1.0).default(0.7).describe("Effort / pressure intensity"),
  durationMs: z.number().min(50).max(5000).optional().describe("Duration in milliseconds"),
});

export const beatboxPatternSchema = z.object({
  pattern: z.string().default("B . t . K . t .").describe("Pattern in Standard Beatbox Notation (e.g. 'B . t . K . t .')"),
  bpm: z.number().min(40).max(220).default(110).describe("Sequencer tempo (beats per minute)"),
  swing: z.number().min(0.0).max(0.75).default(0.0).describe("Swing ratio"),
  bars: z.number().min(1).max(4).default(1).describe("Number of bars to synthesize"),
});

export function registerGestureTools(engine: ChimeraEngine) {
  return {
    perform_vocal_gesture: async (args: z.infer<typeof performVocalGestureSchema>) => {
      const intensity = args.intensity ?? 0.7;
      const chunks: Float32Array[] = [];

      // Open glottal airway gate for acoustic synthesis
      engine.setGate(1.0);

      const renderSlice = (ms: number, src: any, art?: any) => {
        if (art) engine.setArtic(art);
        engine.setSource(src);
        const frames = Math.max(64, Math.round((ms / 1000) * engine.sampleRate));
        chunks.push(engine.render(frames));
      };

      switch (args.gesture) {
        case "sigh": {
          // 3-phase physiological reflex:
          // Phase 1: Inspiratory burst (negative pressure -5 cmH2O, abduction 0.6, 350 ms)
          // Phase 2: Apneic pause (80 ms)
          // Phase 3: Expiratory high-flow relaxation drop (pressure 14 -> 3.5 cmH2O, f0 170 -> 105 Hz glide, breathiness 0.85, 900 ms)
          const totalDur = args.durationMs ?? 1330;
          const scale = totalDur / 1330;
          const p1 = Math.round(350 * scale);
          const p2 = Math.round(80 * scale);
          const p3 = Math.max(50, totalDur - p1 - p2);

          // Phase 1: Inspiratory burst
          renderSlice(
            p1,
            { pressure: -5.0 * intensity, f0: 190, breathiness: 0.80, voiced: false },
            { jaw: 0.4, lipAp: 0.5, velum: -0.2 }
          );

          // Phase 2: Apneic pause
          renderSlice(
            p2,
            { pressure: 0.0, f0: 140, breathiness: 0.0, voiced: false },
            { jaw: 0.1, lipAp: 0.2 }
          );

          // Phase 3: Expiratory high-flow relaxation drop
          const steps = 8;
          const stepMs = p3 / steps;
          for (let s = 0; s < steps; s++) {
            const frac = s / (steps - 1);
            const p = (14.0 * (1 - frac) + 3.5 * frac) * intensity;
            const f0 = 170 * (1 - frac) + 105 * frac;
            renderSlice(
              stepMs,
              { pressure: p, f0, breathiness: 0.85, glide: 0.08, voiced: true, roughness: 0.10 },
              { jaw: 0.35, lipAp: 0.45, velum: -0.2 }
            );
          }
          break;
        }

        case "sob":
        case "cry": {
          // Spasmodic 4 Hz train (inspiratory stridor gasps alternating with expiratory wails collapsing into vocal fry)
          const totalDur = args.durationMs ?? 1000;
          const numCycles = Math.max(1, Math.round(totalDur / 250));
          const cycleMs = totalDur / numCycles;
          const gaspMs = Math.round(cycleMs * 0.36);
          const wailMs = Math.max(40, cycleMs - gaspMs);

          for (let c = 0; c < numCycles; c++) {
            // Inspiratory stridor gasp
            renderSlice(
              gaspMs,
              { pressure: -4.5 * intensity, f0: 240, breathiness: 0.85, voiced: false },
              { larynx: 0.4, epilarynx: 0.3, jaw: 0.5, lipAp: 0.6 }
            );

            // Expiratory wail collapsing into vocal fry
            const subWail = wailMs / 3;
            // Attack wail
            renderSlice(
              subWail,
              { pressure: 12.0 * intensity, f0: 280, fry: 0.15, breathiness: 0.35, tension: 0.70, voiced: true },
              { larynx: 0.1, jaw: 0.4, lipAp: 0.5 }
            );
            // Mid sustain
            renderSlice(
              subWail,
              { pressure: 7.0 * intensity, f0: 190, fry: 0.55, breathiness: 0.55, tension: 0.40, voiced: true },
              { larynx: -0.1, jaw: 0.35, lipAp: 0.45 }
            );
            // Fry collapse
            renderSlice(
              subWail,
              { pressure: 2.8 * intensity, f0: 95, fry: 0.90, breathiness: 0.75, tension: 0.15, roughness: 0.50, voiced: true },
              { larynx: -0.3, jaw: 0.3, lipAp: 0.4 }
            );
          }
          break;
        }

        case "laughter": {
          // Staccato 5 Hz pulse train: 6 successive bursts of 75 ms, Ps = 22 cmH2O, f0 = 320 Hz,
          // /hɑ/ or /hɛ/ formant tracking, separated by 100 ms micro-abductions
          const totalDur = args.durationMs ?? 1050;
          const numBursts = Math.max(2, Math.round(totalDur / 175));
          const cycleMs = totalDur / numBursts;
          const burstMs = Math.round(cycleMs * (75 / 175));
          const pauseMs = Math.max(20, cycleMs - burstMs);

          for (let b = 0; b < numBursts; b++) {
            // Staccato voiced burst (/hɑ/ formant posture)
            const burstF0 = 320 - b * 4;
            renderSlice(
              burstMs,
              {
                pressure: 22.0 * intensity,
                f0: burstF0,
                voiced: true,
                tension: 0.75,
                breathiness: 0.25,
                brightness: 0.65,
              },
              { jaw: 0.6, tbX: -0.3, tbY: -0.2, lipAp: 0.6, epilarynx: 0.2 }
            );

            // Micro-abduction
            renderSlice(
              pauseMs,
              {
                pressure: 2.0 * intensity,
                voiced: false,
                breathiness: 0.90,
                f0: 140,
              },
              { jaw: 0.35, lipAp: 0.45 }
            );
          }
          break;
        }

        case "scream": {
          // High subglottal pressure (> 40 cmH2O), wide open F1, and 30-150 Hz non-linear roughness modulation
          const totalDur = args.durationMs ?? 600;
          const pressure = Math.max(40.0, 42.0 * intensity);
          const steps = Math.max(12, Math.round(totalDur / 12));
          const stepMs = totalDur / steps;

          for (let s = 0; s < steps; s++) {
            const t = (s * stepMs) / 1000;
            // 30-150 Hz non-linear roughness modulation (centered at ~65 Hz neural alarm band)
            const roughMod = 0.70 + 0.28 * Math.sin(2.0 * Math.PI * 65.0 * t);
            renderSlice(
              stepMs,
              {
                pressure,
                f0: 520,
                roughness: roughMod,
                tension: 0.98,
                fry: 0.35,
                brightness: 0.90,
                voiced: true,
              },
              { jaw: 0.9, lipAp: 0.95, larynx: 0.8, epilarynx: 0.75 }
            );
          }
          break;
        }

        case "gasp": {
          // Negative ingressive suction intake
          const totalDur = args.durationMs ?? 350;
          renderSlice(
            totalDur,
            { pressure: -4.0 * intensity, f0: 220, breathiness: 0.9, voiced: false },
            { jaw: 0.6, lipAp: 0.7, larynx: 0.4, epilarynx: 0.3 }
          );
          break;
        }

        case "chuckle": {
          // Staccato rhythmic bursts
          const totalDur = args.durationMs ?? 500;
          renderSlice(
            totalDur,
            { pressure: 10.0 * intensity, f0: 210, vibratoDepth: 0.4, vibratoRate: 5.5, voiced: true, breathiness: 0.4 },
            { jaw: 0.4, tbY: 0.2, lipAp: 0.5 }
          );
          break;
        }

        case "throat_clear": {
          // Ventricular / epilaryngeal constriction with sudden release
          const totalDur = args.durationMs ?? 450;
          renderSlice(
            totalDur * 0.6,
            { pressure: 14.0 * intensity, f0: 110, roughness: 0.8, fry: 0.7, voiced: true },
            { ventricular: 0.9, epilarynx: 0.8, jaw: -0.2 }
          );
          renderSlice(
            totalDur * 0.4,
            { pressure: 6.0 * intensity, f0: 120, roughness: 0.2, voiced: true },
            { ventricular: 0.0, epilarynx: 0.0, jaw: 0.3 }
          );
          break;
        }

        case "growl": {
          // Severe subharmonic fry and vocal fold asymmetry
          const totalDur = args.durationMs ?? 600;
          renderSlice(
            totalDur,
            { pressure: 12.0 * intensity, f0: 85, fry: 0.95, roughness: 0.85, tension: 0.8, voiced: true },
            { larynx: -0.5, epilarynx: 0.6, jaw: 0.4 }
          );
          break;
        }

        case "whisper": {
          // Complete vocal fold abduction, pure oral turbulence
          const totalDur = args.durationMs ?? 400;
          renderSlice(
            totalDur,
            { pressure: 7.0 * intensity, f0: 0, breathiness: 1.0, voiced: false },
            { jaw: 0.2, lipAp: 0.3 }
          );
          break;
        }

        case "click": {
          // Velaric suction pop
          const totalDur = args.durationMs ?? 200;
          engine.beatHit("t!", 60, 1.0);
          const frames = Math.max(64, Math.round((totalDur / 1000) * engine.sampleRate));
          chunks.push(engine.render(frames));
          break;
        }

        case "ejective": {
          // Glottalic compression burst
          const totalDur = args.durationMs ?? 200;
          engine.beatHit("k'", 60, 1.0);
          const frames = Math.max(64, Math.round((totalDur / 1000) * engine.sampleRate));
          chunks.push(engine.render(frames));
          break;
        }
      }

      const reqFrames = args.durationMs ? Math.ceil((args.durationMs / 1000) * engine.sampleRate) : 1024;
      const minFrames = Math.max(1024, reqFrames);
      let totalSamples = chunks.reduce((sum, c) => sum + c.length, 0);
      if (totalSamples < minFrames) {
        chunks.push(engine.render(minFrames - totalSamples));
        totalSamples = minFrames;
      }

      const audio = new Float32Array(totalSamples);
      let offset = 0;
      for (const c of chunks) {
        audio.set(c, offset);
        offset += c.length;
      }

      // Return vocal tract to neutral baseline
      engine.setGate(0.0);
      engine.setSource({
        pressure: 0.0,
        f0: 140,
        voiced: true,
        breathiness: 0.0,
        fry: 0.0,
        roughness: 0.0,
      });
      engine.setArtic({ jaw: 0.0, lipAp: 0.0, larynx: 0.0, epilarynx: 0.0 });

      const vault = saveToVault(audio, engine.sampleRate, `gesture_${args.gesture}`);
      const perception = analyzeAudio(audio, engine.sampleRate);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              gesture: args.gesture,
              intensity,
              durationMs: vault.durationMs,
              audioVaultPath: vault.filePath,
              auditoryFeedback: perception,
              audioBase64: vault.base64Wav,
            }),
          },
        ],
      };
    },

    beatbox_pattern: async (args: z.infer<typeof beatboxPatternSchema>) => {
      const parsedSteps = callJson<any[]>({ fn: "parseBeat", text: args.pattern });
      // Repeat for number of bars
      const fullSteps: any[] = [];
      for (let b = 0; b < args.bars; b++) {
        fullSteps.push(...parsedSteps);
      }

      engine.setBeat(fullSteps, args.bpm, args.swing, true);

      // 4 beats per bar, 16 steps per bar (4 steps per beat)
      const secondsPerBeat = 60.0 / args.bpm;
      const totalSeconds = (fullSteps.length / 4) * secondsPerBeat;
      const totalFrames = Math.max(1024, Math.ceil(totalSeconds * engine.sampleRate));
      const audio = engine.render(totalFrames);

      // Stop sequencer
      engine.setBeat(null, NaN, NaN, false);

      const vault = saveToVault(audio, engine.sampleRate, "beatbox");
      const perception = analyzeAudio(audio, engine.sampleRate);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              pattern: args.pattern,
              bpm: args.bpm,
              bars: args.bars,
              durationMs: vault.durationMs,
              audioVaultPath: vault.filePath,
              auditoryFeedback: perception,
              audioBase64: vault.base64Wav,
            }),
          },
        ],
      };
    },
  };
}
