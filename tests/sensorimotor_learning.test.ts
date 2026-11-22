/**
 * Sensorimotor Learning & Auditory Feedback Test Suite (Bio-NAVB v2)
 * Tests Frank Guenther's DIVA Model (Closed-Loop Motor Error Correction)
 * and Curiosity-Driven Developmental Babbling.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { DivaMotorLearner } from "../src/learning/diva.ts";
import { ChimeraEngine } from "../src/ffi/engine.ts";
import { registerBabblingTools } from "../src/tools/babbling.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../src/tools/registry.ts";

describe("DIVA Sensorimotor Learning & Auditory Feedback", () => {
  let learner: DivaMotorLearner;
  let engine: ChimeraEngine;
  let babblingTools: ReturnType<typeof registerBabblingTools>;

  beforeAll(() => {
    engine = new ChimeraEngine(48000);
    learner = new DivaMotorLearner(48000);
    babblingTools = registerBabblingTools(engine);
  });

  afterAll(() => {
    if (engine) engine.destroy();
  });

  it("converges on high-front cardinal vowel /i/ via closed-loop DIVA motor error correction", () => {
    // Start with arbitrary non-matching posture (lowered, retracted tongue)
    const initialPosture = { jaw: 0.5, tbX: -0.5, tbY: -0.5 };

    const result = learner.learnArticulatoryTarget(
      "i",
      initialPosture,
      8,
      0.45
    );

    // Target formants for /i/: F1 ~280, F2 ~2280 Hz
    expect(result.target.f1).toBeLessThan(350);
    expect(result.target.f2).toBeGreaterThan(2000);

    // Initial error was large (>1000 Hz)
    expect(result.initialErrorHz).toBeGreaterThan(1000);

    // Final error after 8 episodes should be < 70 Hz (demonstrating >90% error reduction)
    expect(result.finalErrorHz).toBeLessThan(70);
    expect(result.improvementPercentage).toBeGreaterThanOrEqual(90);
    expect(result.converged).toBe(true);

    // Verify motor effectors adapted in correct physiological direction:
    // /i/ requires tongue body fronting (tbX > 0) and tongue body elevation (tbY > 0)
    expect(result.learnedArticulators.tbX).toBeGreaterThan(0.2);
    expect(result.learnedArticulators.tbY).toBeGreaterThan(0.1);
    expect(result.learnedArticulators.jaw).toBeLessThan(initialPosture.jaw);

    // Verify learning trajectory monotonically decreases overall
    const firstEp = result.episodes[0];
    const lastEp = result.episodes[result.episodes.length - 1];
    expect(lastEp.errorHz.euclidean).toBeLessThan(firstEp.errorHz.euclidean);
    expect(result.initialAudioBase64).toBeDefined();
    expect(result.finalAudioBase64).toBeDefined();
  });

  it("converges on low-back cardinal vowel /a/ via closed-loop DIVA motor error correction", () => {
    // Target /a/: F1 ~730 Hz, F2 ~1450 Hz
    const initialPosture = { jaw: -0.5, tbX: 0.5, tbY: 0.5 };

    const result = learner.learnArticulatoryTarget(
      "a",
      initialPosture,
      8,
      0.45
    );

    expect(result.initialErrorHz).toBeGreaterThan(500);
    expect(result.finalErrorHz).toBeLessThan(60);
    expect(result.improvementPercentage).toBeGreaterThanOrEqual(85);
    expect(result.converged).toBe(true);

    // /a/ requires jaw depression (jaw > 0) and tongue lowering
    expect(result.learnedArticulators.jaw).toBeGreaterThan(0.2);
    expect(result.learnedArticulators.tbY).toBeLessThan(0.0);
  });

  it("executes curiosity-driven developmental babbling and maps cardinal quadrilateral", () => {
    const result = learner.curiosityBabble(12);

    expect(result.totalSteps).toBe(12);
    expect(result.explorationSteps.length).toBe(12);

    // Verify discovery of cardinal vowel anchors
    const quad = result.discoveredVowelQuadrilateral;
    expect(quad.highFront_i).toBeDefined();
    expect(quad.lowFront_ae).toBeDefined();
    expect(quad.lowBack_a).toBeDefined();
    expect(quad.highBack_u).toBeDefined();

    // Verify competence progress calculation across steps
    for (const step of result.explorationSteps) {
      expect(typeof step.competenceProgress).toBe("number");
      expect(step.formants.length).toBeGreaterThanOrEqual(4);
      expect(step.f0).toBeGreaterThan(50);
    }

    expect(result.audioBase64).toBeDefined();
    const buf = Buffer.from(result.audioBase64!, "base64");
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("executes learn_articulatory_target and curiosity_babble tools via MCP tool handler", async () => {
    const learnRes = await babblingTools.learn_articulatory_target({
      target: "i",
      initialArticulators: { jaw: 0.4, tbX: -0.4, tbY: -0.4 },
      maxEpisodes: 6,
      learningRate: 0.5,
      returnAudio: true,
    });

    const learnData = JSON.parse(learnRes.content[0].text);
    expect(learnData.status).toBe("success");
    expect(learnData.mode).toBe("DIVA_ClosedLoop_MotorLearning");
    expect(learnData.improvementPercentage).toBeGreaterThanOrEqual(85);
    expect(learnData.learnedArticulators).toBeDefined();
    expect(learnData.learningTrajectory.length).toBeGreaterThan(0);
    expect(learnData.finalAudioBase64).toBeDefined();

    const babbleRes = await babblingTools.curiosity_babble({
      numSteps: 8,
      strategy: "vowel_triangle",
      returnAudio: true,
    });

    const babbleData = JSON.parse(babbleRes.content[0].text);
    expect(babbleData.status).toBe("success");
    expect(babbleData.mode).toBe("Curiosity_Driven_Developmental_Babbling");
    expect(babbleData.totalExplorationSteps).toBe(8);
    expect(babbleData.discoveredVowelQuadrilateral).toBeDefined();
    expect(babbleData.audioBase64).toBeDefined();
  });

  it("verifies registration in McpServer when enableLearning option is true", () => {
    const customServer = new McpServer({ name: "test-learning", version: "1.0.0" });
    registerAllTools(customServer, engine, { enableLearning: true });

    const registered = (customServer as any)._registeredTools;
    expect(registered["learn_articulatory_target"]).toBeDefined();
    expect(registered["curiosity_babble"]).toBeDefined();
    expect(Object.keys(registered).length).toBe(18);
  });

  it("handles out-of-range impossible targets and NaN inputs with numerical stability", () => {
    const res = learner.learnArticulatoryTarget(
      { f1: 50, f2: 8000 },
      { jaw: 2.0, tbX: NaN },
      6,
      0.45
    );

    expect(res.converged).toBe(false);
    expect(res.learnedArticulators).toBeDefined();
    for (const v of Object.values(res.learnedArticulators)) {
      expect(isNaN(v as number)).toBe(false);
    }
  });

  it("maintains filter stability under rapid time dilation (<10ms gestures)", () => {
    const synth = (learner as any).synth;
    const rapidGestures = [];
    for (let i = 0; i < 20; i++) {
      rapidGestures.push({
        t0: i * 0.008,
        t1: (i + 1) * 0.008,
        strength: 1.0,
        targets: { jaw: i % 2 === 0 ? 0.5 : -0.5, breath: 1.0 },
        label: i % 2 === 0 ? "a" : "i",
      });
    }
    const rapidAudio = synth.synthesizePlan(rapidGestures, 0.16);
    expect(rapidAudio.length).toBeGreaterThan(0);
    for (let i = 0; i < rapidAudio.length; i++) {
      expect(isNaN(rapidAudio[i])).toBe(false);
    }
  });
});
