/**
 * Domain A: Anatomy & Morphometry Tools
 */
import { z } from "zod";
import { ChimeraEngine } from "../ffi/engine.ts";
import { callJson } from "../ffi/bindings.ts";
import { loadProfile, saveActiveState } from "../vault/profile.ts";

export const setVoiceIdentitySchema = z.object({
  bodyMix: z
    .object({
      female: z.number().min(0).max(1).optional(),
      child: z.number().min(0).max(1).optional(),
    })
    .optional(),
  scale: z.number().min(0.5).max(1.5).optional().describe("Overall vocal tract scale (1.0 = adult male)"),
  larynxOffset: z.number().min(-2.0).max(2.0).optional().describe("Larynx height offset in cm"),
  larynx: z.number().min(-2.0).max(2.0).optional().describe("Larynx height offset in cm (alias)"),
  pharynxScale: z.number().min(0.5).max(1.5).optional().describe("Pharynx length proportion scale"),
  tongueRadius: z.number().min(1.0).max(4.0).optional().describe("Tongue body curvature radius (cm)"),
  lipWidth: z.number().min(1.0).max(5.0).optional().describe("Rest lip width (cm)"),
});

export const switchCreatureSchema = z.object({
  creatureId: z
    .enum(["human", "songbird", "elephant", "seal", "alligator"])
    .describe("Species vocal morphology biophysics to instantiate"),
  params: z.record(z.string(), z.number()).optional().describe("Species-specific physical parameters"),
});

export function registerAnatomyTools(engine: ChimeraEngine) {
  return {
    set_voice_identity: async (args: z.infer<typeof setVoiceIdentitySchema>) => {
      const female = args.bodyMix?.female ?? engine.body.female;
      const child = args.bodyMix?.child ?? engine.body.child;
      engine.setBody(female, child);

      const larynx = args.larynx ?? args.larynxOffset;
      if (larynx !== undefined) {
        engine.setArtic({ larynx });
      }

      saveActiveState({
        bodyMix: { female, child },
        scale: args.scale,
        larynx,
        pharynxScale: args.pharynxScale,
        tongueRadius: args.tongueRadius,
        lipWidth: args.lipWidth,
      });

      // Read current airway geometry from engine
      const tele = engine.getTelemetry();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              bodyMix: { female, child },
              scale: args.scale ?? 1.0,
              larynx: larynx ?? 0.0,
              tractLengthCm: Math.round((tele.phLen + tele.orLen) * 100) / 100,
              pharynxLengthCm: Math.round(tele.phLen * 100) / 100,
              oralLengthCm: Math.round(tele.orLen * 100) / 100,
              description: `Voice identity set: ${female > 0.5 ? "Female" : "Male"} tilt ${female}, ${child > 0.2 ? "Child" : "Adult"} tilt ${child}. Larynx offset: ${larynx ?? 0.0} cm.`,
            }),
          },
        ],
      };
    },

    get_voice_identity: async () => {
      const tele = engine.getTelemetry();
      const body = engine.body;
      const profile = loadProfile();

      // Transfer function for baseline neutral tube
      let formants = [500, 1500, 2500, 3500];
      try {
        const transfer = callJson({
          fn: "transfer",
          model: 0,
          artic: {
            jaw: 0,
            tbX: 0,
            tbY: 0,
            ttX: 0,
            ttY: 0,
            ttCurl: 0,
            root: 0,
            lipAp: 0,
            lipProt: 0,
            lipWidth: 0,
            labiodental: 0,
            velum: 0,
            larynx: profile.larynx ?? 0,
            epilarynx: 0,
            ventricular: 0,
            lateral: 0,
            dorsum: 0,
          },
        });
        if (transfer.formants && transfer.formants.length >= 4) {
          formants = transfer.formants.slice(0, 4);
        }
      } catch {
        // Fallback to Fant's neutral quarter-wave resonance
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              activeSpecies: engine.activeCreature,
              bodyMix: body,
              anatomy: {
                totalLengthCm: Math.round((tele.phLen + tele.orLen) * 100) / 100,
                pharynxLengthCm: Math.round(tele.phLen * 100) / 100,
                oralLengthCm: Math.round(tele.orLen * 100) / 100,
                pharynxNodes: tele.phAreas.length,
                oralNodes: tele.orAreas.length,
                larynxShiftCm: profile.larynx ?? 0.0,
                tractScale: profile.scale ?? 1.0,
              },
              glottalSource: {
                f0: profile.f0,
                lungPressure: profile.lungPressure,
                breathiness: profile.breathiness,
                tension: profile.tension,
                brightness: profile.brightness ?? 0.5,
              },
              baselineNeutralFormantsHz: formants,
            }),
          },
        ],
      };
    },

    switch_creature: async (args: z.infer<typeof switchCreatureSchema>) => {
      engine.setCreature(args.creatureId, args.params || {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "success",
              activeCreature: args.creatureId,
              params: args.params || {},
              description: `Vocal morphology transformed into ${args.creatureId}.`,
            }),
          },
        ],
      };
    },
  };
}
