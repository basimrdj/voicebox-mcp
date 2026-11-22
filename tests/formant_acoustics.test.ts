import { describe, it, expect, beforeAll } from "bun:test";
import { callJson } from "../src/ffi/bindings.ts";

describe("Biophysical Formant Acoustic Accuracy", () => {
  let modelId: number;
  let catalog: any;

  beforeAll(() => {
    catalog = callJson({ fn: "catalog" });
    const m = callJson<any>({
      fn: "model",
      body: { female: 0.0, child: 0.0 },
      sampleRate: 48000.0,
    });
    modelId = m.model;
  });

  it("verifies neutral uniform tube resonant formants against Fant's theory (/ə/)", () => {
    const target = catalog.vowelTargets["male"]["ə"];
    const res = callJson<any>({
      fn: "transfer",
      model: modelId,
      artic: { ...catalog.neutral, ...target.artic },
    });

    const [f1, f2, f3, f4] = res.formants;

    // Gunnar Fant: idealized lossless uniform tube ~500, 1500, 2500, 3500 Hz
    expect(f1).toBeCloseTo(target.formants[0], -1); // 503 Hz
    expect(f2).toBeCloseTo(target.formants[1], -1); // 1456 Hz
    expect(f3).toBeCloseTo(target.formants[2], -1); // 2344 Hz
    expect(Math.abs(f4 - target.formants[3])).toBeLessThan(20); // 3595 Hz (within 20 Hz, 0.5%)
  });

  it("verifies high-front cardinal vowel /i/ acoustic perturbation", () => {
    const target = catalog.vowelTargets["male"]["i"];
    const res = callJson<any>({
      fn: "transfer",
      model: modelId,
      artic: { ...catalog.neutral, ...target.artic },
    });

    const [f1, f2, f3, f4] = res.formants;
    // High-front vowel /i/: low F1 (< 400 Hz) and elevated F2 (> 2000 Hz)
    expect(f1).toBeLessThan(400);
    expect(f2).toBeGreaterThan(2000);
    expect(f1).toBeCloseTo(target.formants[0], -1); // 337 Hz
    expect(f2).toBeCloseTo(target.formants[1], -1); // 2225 Hz
  });

  it("verifies low-back cardinal vowel /a/ acoustic perturbation", () => {
    const target = catalog.vowelTargets["male"]["a"];
    const res = callJson<any>({
      fn: "transfer",
      model: modelId,
      artic: { ...catalog.neutral, ...target.artic },
    });

    const [f1, f2, f3, f4] = res.formants;
    // Low-back vowel /a/: elevated F1 (> 650 Hz) and lowered F2 (< 1600 Hz)
    expect(f1).toBeGreaterThan(650);
    expect(f2).toBeLessThan(1600);
    expect(f1).toBeCloseTo(target.formants[0], -1); // 725 Hz
    expect(f2).toBeCloseTo(target.formants[1], -1); // 1452 Hz
  });

  it("verifies high-back rounded cardinal vowel /u/ acoustic perturbation", () => {
    const target = catalog.vowelTargets["male"]["u"];
    const res = callJson<any>({
      fn: "transfer",
      model: modelId,
      artic: { ...catalog.neutral, ...target.artic },
    });

    const [f1, f2, f3, f4] = res.formants;
    // High-back vowel /u/: low F1 (< 450 Hz) and low F2 (< 1100 Hz)
    expect(f1).toBeLessThan(450);
    expect(f2).toBeLessThan(1100);
    expect(f1).toBeCloseTo(target.formants[0], -1); // 378 Hz
    expect(f2).toBeCloseTo(target.formants[1], -1); // 997 Hz
  });
});
