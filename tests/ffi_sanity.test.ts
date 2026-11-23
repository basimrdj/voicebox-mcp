import { describe, it, expect, afterAll } from "bun:test";
import { symbols, callJson, isNativeChimeraAvailable } from "../src/ffi/bindings.ts";
import { ChimeraEngine } from "../src/ffi/engine.ts";

describe("FFI & C-ABI Sanity", () => {
  if (!isNativeChimeraAvailable()) {
    it.skip("skips C-ABI tests when libchimera_wasm dynamic library is not present", () => {});
    return;
  }

  let engine: ChimeraEngine;

  it("checks layout version and gesture record size", () => {
    const version = symbols.chimera_layout_version();
    expect(version).toBe(1);

    const recordSize = symbols.chimera_gesture_record_size();
    expect(recordSize).toBe(272);
  });

  it("calls JSON API for engine version and catalog", () => {
    const ver = callJson<any>({ fn: "version" });
    expect(ver.layout).toBe(1);
    expect(ver.crate).toBe("0.2.0");

    const cat = callJson<any>({ fn: "catalog" });
    expect(cat.neutral).toBeDefined();
    expect(cat.articKeys.length).toBe(17);
    expect(cat.creatures.length).toBeGreaterThan(0);
  });

  it("initializes engine instance and verifies clock", () => {
    engine = new ChimeraEngine(48000);
    expect(engine.handle).toBeDefined();
    expect(engine.clock).toBe(0.0);
  });

  it("modifies body mix and reads back", () => {
    engine.setBody(0.8, 0.2);
    const body = engine.body;
    expect(body.female).toBeCloseTo(0.8, 2);
    expect(body.child).toBeCloseTo(0.2, 2);
  });

  it("sets articulators and renders audio frames", () => {
    engine.setArtic({ jaw: 0.5, tbY: -0.3, lipAp: 0.6 }, true);
    const frames = engine.render(256);
    expect(frames.length).toBe(256);
    expect(engine.clock).toBeGreaterThan(0.0);
  });

  it("takes telemetry snapshot", () => {
    const tele = engine.getTelemetry();
    expect(tele.phLen).toBeGreaterThan(0);
    expect(tele.orLen).toBeGreaterThan(0);
    expect(tele.phAreas.length).toBeGreaterThan(0);
    expect(tele.orAreas.length).toBeGreaterThan(0);
  });

  afterAll(() => {
    if (engine) engine.destroy();
  });
});
