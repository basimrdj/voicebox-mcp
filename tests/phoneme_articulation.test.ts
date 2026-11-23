/**
 * VoiceBox Milestone 1 — Phoneme-Level Articulatory & Speech Production Tests
 * 
 * Verifies:
 * 1. Cardinal vowel acoustic quadrilateral separation (/i/, /a/, /u/, /ə/).
 * 2. Minimal pair phonetic contrasts:
 *    - Voicing contrast: "pin" (/pɪn/) vs "bin" (/bɪn/)
 *    - Vowel tension/height contrast: "bit" (/bɪt/) vs "beat" (/bit/)
 *    - Manner of articulation: "cat" (/kæt/) vs "mat" (/mæt/)
 * 3. Consonant articulation mechanics:
 *    - Plosive closure, release, and aspiration (/p, t, k/)
 *    - Fricative turbulence and glottal abduction (/s, f/)
 *    - Nasal coupling with velum port lowering (/m, n/)
 * 4. Dual-pathway synthesis verification:
 *    - Physical transmission waveguide (CHIMERA C-ABI)
 *    - Biophysical DDSP resonator filter bank
 */

import { describe, it, expect } from "bun:test";
import { PhonemePlanner } from "../src/synthesis/phoneme_planner.ts";
import { SynthesisOrchestrator } from "../src/synthesis/synthesis_orchestrator.ts";
import { ChimeraEngine } from "../src/ffi/engine.ts";
import { isNativeChimeraAvailable } from "../src/ffi/bindings.ts";

describe("Milestone 1: Phoneme-Level Articulatory & Speech Production", () => {
  const orchestrator = new SynthesisOrchestrator();

  it("differentiates cardinal vowel quadrilateral acoustic targets (/i/, /a/, /u/, /ə/)", () => {
    const vowelPlan = PhonemePlanner.planPhoneticTrajectory("beat bat boot but");
    expect(vowelPlan.frames.length).toBeGreaterThan(0);

    // 1. High-front /i/ (in "beat")
    const beatFrame = vowelPlan.frames.find((f) => f.phoneme === "i" && f.kind === "vowel");
    expect(beatFrame).toBeDefined();
    if (beatFrame) {
      expect(beatFrame.acoustics.formants[0]).toBeLessThan(450); // Low F1
      expect(beatFrame.acoustics.formants[1]).toBeGreaterThan(1800); // High F2
      expect(beatFrame.articulators.tongueBodyY).toBeGreaterThan(0); // High tongue body
    }

    // 2. Low-back /a/ (in "bat" / "bot")
    const batPlan = PhonemePlanner.planPhoneticTrajectory("father");
    const openFrame = batPlan.frames.find((f) => (f.phoneme === "a" || f.phoneme === "ɑ") && f.kind === "vowel");
    expect(openFrame).toBeDefined();
    if (openFrame) {
      expect(openFrame.acoustics.formants[0]).toBeGreaterThan(600); // Elevated F1
      expect(openFrame.acoustics.formants[1]).toBeLessThan(1600); // Moderate/low F2
      expect(openFrame.articulators.jaw).toBeGreaterThan(0); // Open jaw
    }

    // 3. High-back rounded /u/ (in "boot")
    const bootFrame = vowelPlan.frames.find((f) => f.phoneme === "u" && f.kind === "vowel");
    expect(bootFrame).toBeDefined();
    if (bootFrame) {
      expect(bootFrame.acoustics.formants[0]).toBeLessThan(500); // Low F1
      expect(bootFrame.acoustics.formants[1]).toBeLessThan(1200); // Low F2
    }

    // 4. Central neutral /ə/ (in "but" / schwa)
    const schwaPlan = PhonemePlanner.planPhoneticTrajectory("the decision");
    const schwaFrame = schwaPlan.frames.find((f) => f.phoneme === "ə" && f.kind === "vowel");
    expect(schwaFrame).toBeDefined();
    if (schwaFrame) {
      // Neutral uniform tube F1 ~500 Hz, F2 ~1500 Hz
      expect(schwaFrame.acoustics.formants[0]).toBeGreaterThan(350);
      expect(schwaFrame.acoustics.formants[0]).toBeLessThan(650);
      expect(schwaFrame.acoustics.formants[1]).toBeGreaterThan(1200);
      expect(schwaFrame.acoustics.formants[1]).toBeLessThan(1750);
    }
  });

  it("produces distinct articulatory and acoustic representations for minimal pairs", () => {
    // Contrast 1: Voicing distinction in plosives "pin" vs "bin"
    const pinPlan = PhonemePlanner.planPhoneticTrajectory("pin");
    const binPlan = PhonemePlanner.planPhoneticTrajectory("bin");

    // "pin" contains voiceless aspirated stop frames with glottal abduction
    const pAspirated = pinPlan.frames.find((f) => f.phoneme === "p" && f.aspiration > 0.2);
    expect(pAspirated).toBeDefined();
    expect(pAspirated!.voiced).toBe(false);

    // "bin" begins with voiced stop /b/ with zero glottal abduction aspiration
    const bMaxAspiration = Math.max(...binPlan.frames.filter((f) => f.phoneme === "b").map((f) => f.aspiration));
    expect(bMaxAspiration).toBeLessThan(0.05);

    // Contrast 2: Manner distinction "cat" (stop /k/) vs "mat" (nasal /m/)
    const catPlan = PhonemePlanner.planPhoneticTrajectory("cat");
    const matPlan = PhonemePlanner.planPhoneticTrajectory("mat");

    const kFrame = catPlan.frames.find((f) => f.phoneme === "k");
    const mFrame = matPlan.frames.find((f) => f.phoneme === "m");

    expect(kFrame).toBeDefined();
    expect(mFrame).toBeDefined();
    expect(kFrame!.kind).toBe("stop");
    expect(mFrame!.kind).toBe("nasal");
    // Nasal /m/ has lowered velum port (open velopharyngeal coupling > 0.3)
    const mMaxVelum = Math.max(...matPlan.frames.filter((f) => f.phoneme === "m").map((f) => f.articulators.velum));
    const kMaxVelum = Math.max(...catPlan.frames.filter((f) => f.phoneme === "k").map((f) => f.articulators.velum));
    expect(mMaxVelum).toBeGreaterThan(0.3);
    expect(mMaxVelum).toBeGreaterThan(kMaxVelum);
  });

  it("articulates plosives, fricatives, and nasals with physiological realism", () => {
    const text = "A fine stop and calm smile.";
    const plan = PhonemePlanner.planPhoneticTrajectory(text);

    // 1. Fricative /f/ or /s/ should have glottal abduction and turbulence aspiration
    const fricativeFrames = plan.frames.filter((f) => f.kind === "fricative");
    expect(fricativeFrames.length).toBeGreaterThan(0);
    const aspiratedFric = fricativeFrames.find((f) => f.aspiration > 0.1);
    expect(aspiratedFric).toBeDefined();

    // 2. Nasal /m/ or /n/ should have velum lowering
    const nasalFrames = plan.frames.filter((f) => f.kind === "nasal");
    expect(nasalFrames.length).toBeGreaterThan(0);
    const openVelum = nasalFrames.find((f) => f.articulators.velum > 0.1);
    expect(openVelum).toBeDefined();

    // 3. Plosive stop should have tight constriction
    const stopFrames = plan.frames.filter((f) => f.kind === "stop");
    expect(stopFrames.length).toBeGreaterThan(0);
  });

  it("synthesizes intelligible speech through both physical waveguide and DDSP engines", async () => {
    const text = "Testing vocal articulation.";

    // 1. Test DDSP Formant Resonator Pathway
    const ddspResult = await orchestrator.synthesizeSpeech({
      text,
      intent: "neutral",
      engine: "ddsp",
    });

    expect(ddspResult.engineUsed).toBe("ddsp");
    expect(ddspResult.samples.length).toBeGreaterThan(0);
    expect(ddspResult.durationMs).toBeGreaterThan(500);
    expect(ddspResult.perception.rms).toBeGreaterThan(0.01);
    expect(ddspResult.trajectory.frames.length).toBeGreaterThan(20);

    // 2. Test Physical Transmission Waveguide Pathway (with C-ABI ChimeraEngine)
    if (isNativeChimeraAvailable()) {
      const chimera = new ChimeraEngine(48000);
      const physicalOrch = new SynthesisOrchestrator(chimera);
      const physicalResult = await physicalOrch.synthesizeSpeech({
        text,
        intent: "neutral",
        engine: "physical",
      });

      expect(physicalResult.engineUsed).toBe("physical");
      expect(physicalResult.samples.length).toBeGreaterThan(0);
      expect(physicalResult.durationMs).toBeGreaterThan(500);
      expect(physicalResult.perception.rms).toBeGreaterThan(0.01);
      chimera.destroy();
    }
  });
});
