/**
 * Domain B: Motor Babbling & Neuromuscular Actuation Tools
 * Features DIVA closed-loop sensorimotor learning and curiosity babbling.
 */
import { z } from "zod";
import { ChimeraEngine } from "../ffi/engine.ts";
import { toBase64Wav } from "../vault/audio.ts";
import { analyzeAudio } from "../analysis/perception.ts";
import { CONTROL_KEYS } from "../ffi/wire.ts";
import { saveActiveState } from "../vault/profile.ts";
import { DivaMotorLearner } from "../learning/diva.ts";
import { BioNavbSynthesizer } from "../synthesis/neural_engine.ts";

const ARTIC_KEYS = CONTROL_KEYS.slice(0, 17);

export const babbleArticulatorsSchema = z.object({
  articulators: z
    .object({
      jaw: z.number().min(-1).max(1).optional(),
      tbX: z.number().min(-1).max(1).optional(),
      tbY: z.number().min(-1).max(1).optional(),
      ttX: z.number().min(-1).max(1).optional(),
      ttY: z.number().min(-1).max(1).optional(),
      ttCurl: z.number().min(-1).max(1).optional(),
      root: z.number().min(-1).max(1).optional(),
      lipAp: z.number().min(-1).max(1).optional(),
      lipProt: z.number().min(-1).max(1).optional(),
      lipWidth: z.number().min(-1).max(1).optional(),
      labiodental: z.number().min(-1).max(1).optional(),
      velum: z.number().min(-1).max(1).optional(),
      larynx: z.number().min(-1).max(1).optional(),
      epilarynx: z.number().min(-1).max(1).optional(),
      ventricular: z.number().min(-1).max(1).optional(),
      lateral: z.number().min(-1).max(1).optional(),
      dorsum: z.number().min(-1).max(1).optional(),
    })
    .describe("17 neuromuscular articulator target positions [-1.0, 1.0]"),
  durationMs: z.number().min(50).max(2000).default(200).describe("Duration to sustain the posture (ms)"),
  tipFree: z.boolean().optional().describe("Allow tongue tip to float freely with tongue body"),
  returnAudio: z.boolean().default(true).describe("Whether to return synthesized audio and auditory biofeedback"),
});

export const setGlottalSourceSchema = z.object({
  pLung: z.number().min(0).max(25).optional().describe("Subglottal lung pressure in cmH2O (default ~8.0)"),
  lungPressure: z.number().min(0).max(25).optional().describe("Subglottal lung pressure in cmH2O (alias)"),
  f0: z.number().min(40).max(800).optional().describe("Fundamental vocal fold vibration pitch (Hz)"),
  voiced: z.boolean().optional().describe("Whether vocal folds are active or whispered/unvoiced"),
  breathiness: z.number().min(0).max(1).optional().describe("Posterior glottal chink opening [0..1]"),
  tension: z.number().min(0).max(1).optional().describe("Vocal fold muscular tension / stiffness"),
  fry: z.number().min(0).max(1).optional().describe("Creaky voice / vocal fry subharmonics"),
  roughness: z.number().min(0).max(1).optional().describe("Vocal fold asymmetry / harshness"),
  chaos: z.number().min(0).max(1).optional().describe("Vocal rasp/grit (alias for roughness)"),
  vibratoDepth: z.number().min(0).max(1).optional().describe("Pitch modulation depth"),
  vibratoRate: z.number().min(1).max(12).optional().describe("Pitch modulation rate in Hz"),
  drift: z.number().min(0).max(1).optional().describe("Natural organic pitch drift/jitter"),
  brightness: z.number().min(0).max(1).optional().describe("Glottal flow derivative sharpness"),
});

export const learnArticulatoryTargetSchema = z.object({
  target: z.union([
    z.string().describe("Target IPA phoneme (e.g. 'i', 'a', 'u', 'e', 'o')"),
    z.object({
      f1: z.number().describe("Target first formant frequency (Hz)"),
      f2: z.number().describe("Target second formant frequency (Hz)"),
      f3: z.number().optional().describe("Target third formant frequency (Hz)"),
      f0: z.number().optional().describe("Target fundamental pitch (Hz)"),
    }).describe("Target formant coordinates"),
  ]).describe("Acoustic target: either phonetic symbol or explicit formant goals"),
  initialArticulators: z.object({
    jaw: z.number().min(-1).max(1).optional(),
    tbX: z.number().min(-1).max(1).optional(),
    tbY: z.number().min(-1).max(1).optional(),
    ttX: z.number().min(-1).max(1).optional(),
    ttY: z.number().min(-1).max(1).optional(),
    ttCurl: z.number().min(-1).max(1).optional(),
    root: z.number().min(-1).max(1).optional(),
    lipAp: z.number().min(-1).max(1).optional(),
    lipProt: z.number().min(-1).max(1).optional(),
    lipWidth: z.number().min(-1).max(1).optional(),
    labiodental: z.number().min(-1).max(1).optional(),
    velum: z.number().min(-1).max(1).optional(),
    larynx: z.number().min(-1).max(1).optional(),
    epilarynx: z.number().min(-1).max(1).optional(),
    ventricular: z.number().min(-1).max(1).optional(),
    lateral: z.number().min(-1).max(1).optional(),
    dorsum: z.number().min(-1).max(1).optional(),
  }).optional().describe("Initial articulatory motor posture"),
  maxEpisodes: z.number().min(1).max(25).default(8).describe("Maximum closed-loop learning iterations"),
  learningRate: z.number().min(0.05).max(1.0).default(0.45).describe("DIVA motor correction gradient step size"),
  returnAudio: z.boolean().default(true).describe("Whether to return initial and final synthesized audio"),
});

export const curiosityBabbleSchema = z.object({
  numSteps: z.number().min(3).max(64).default(16).describe("Number of autonomous babbling exploration steps"),
  strategy: z.enum(["vowel_triangle", "random_walk", "boundary_exploration", "competence_progress"]).default("vowel_triangle").describe("Developmental curiosity exploration strategy"),
  returnAudio: z.boolean().default(true).describe("Whether to return concatenated audio of the babbling session"),
});

export function registerBabblingTools(engine: ChimeraEngine) {
  const synth = new BioNavbSynthesizer(engine.sampleRate);
  const learner = new DivaMotorLearner(engine.sampleRate);

  return {
    babble_articulators: async (args: z.infer<typeof babbleArticulatorsSchema>) => {
      engine.setArtic(args.articulators, args.tipFree);

      const renderFrames = Math.ceil((args.durationMs / 1000) * engine.sampleRate);
      // Advance C-ABI engine state
      engine.render(renderFrames);

      // Render human-grade non-metallic audio
      const audio = synth.synthesizePosture(args.articulators, args.durationMs);
      const perception = analyzeAudio(audio, engine.sampleRate);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              actuatedMuscles: Object.keys(args.articulators),
              durationMs: args.durationMs,
              auditoryFeedback: perception,
              audioBase64: args.returnAudio ? toBase64Wav(audio, engine.sampleRate) : undefined,
            }),
          },
        ],
      };
    },

    get_articulator_state: async () => {
      const tele = engine.getTelemetry();
      const state: Record<string, number> = {};
      for (let i = 0; i < Math.min(ARTIC_KEYS.length, tele.artic.length); i++) {
        state[ARTIC_KEYS[i]] = Math.round(tele.artic[i] * 1000) / 1000;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              timestamp: engine.clock,
              articulators: state,
              glottis: {
                f0: tele.f0,
                voicing: tele.voicing,
                pLung: tele.pLung,
                velumPort: tele.velumPort,
              },
              activeGestures: tele.active,
            }),
          },
        ],
      };
    },

    set_glottal_source: async (args: z.infer<typeof setGlottalSourceSchema>) => {
      const pressure = args.lungPressure ?? args.pLung;
      const roughness = args.chaos ?? args.roughness;

      engine.setSource({
        pressure,
        f0: args.f0,
        voiced: args.voiced,
        breathiness: args.breathiness,
        tension: args.tension,
        fry: args.fry,
        roughness,
        vibratoDepth: args.vibratoDepth,
        vibratoRate: args.vibratoRate,
        drift: args.drift,
        brightness: args.brightness,
      });

      saveActiveState({
        f0: args.f0,
        lungPressure: pressure,
        breathiness: args.breathiness,
        tension: args.tension,
        fry: args.fry,
        roughness,
        chaos: roughness,
        brightness: args.brightness,
        drift: args.drift,
        vibratoDepth: args.vibratoDepth,
        vibratoRate: args.vibratoRate,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              updatedSource: {
                ...args,
                pressure,
                roughness,
              },
              description: `Glottal source calibrated: f0=${args.f0 ?? "unchanged"} Hz, lungPressure=${pressure ?? "unchanged"} cmH2O, breathiness=${args.breathiness ?? "unchanged"}, tension=${args.tension ?? "unchanged"}.`,
            }),
          },
        ],
      };
    },

    learn_articulatory_target: async (args: z.infer<typeof learnArticulatoryTargetSchema>) => {
      const result = learner.learnArticulatoryTarget(
        args.target,
        args.initialArticulators,
        args.maxEpisodes,
        args.learningRate,
        engine.body
      );

      // Apply the newly learned motor posture to the live voicebox engine
      engine.setArtic(result.learnedArticulators);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              mode: "DIVA_ClosedLoop_MotorLearning",
              target: result.target,
              episodesExecuted: result.episodes.length,
              initialErrorHz: result.initialErrorHz,
              finalErrorHz: result.finalErrorHz,
              improvementPercentage: result.improvementPercentage,
              converged: result.converged,
              learnedArticulators: result.learnedArticulators,
              learningTrajectory: result.episodes,
              initialAudioBase64: args.returnAudio ? result.initialAudioBase64 : undefined,
              finalAudioBase64: args.returnAudio ? result.finalAudioBase64 : undefined,
            }),
          },
        ],
      };
    },

    curiosity_babble: async (args: z.infer<typeof curiosityBabbleSchema>) => {
      const result = learner.curiosityBabble(args.numSteps, engine.body);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              mode: "Curiosity_Driven_Developmental_Babbling",
              strategy: args.strategy,
              totalExplorationSteps: result.totalSteps,
              discoveredVowelQuadrilateral: result.discoveredVowelQuadrilateral,
              explorationSteps: result.explorationSteps,
              audioBase64: args.returnAudio ? result.audioBase64 : undefined,
            }),
          },
        ],
      };
    },
  };
}
