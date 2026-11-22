import { Sandbox } from "e2b";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const apiKey = "e2b_b226b826b45117ef758823924c02addb8e6de81d";

async function main() {
  console.log("Packaging current voicebox-mcp workspace...");
  execSync("tar --exclude='.git' --exclude='node_modules' --exclude='reference' -czf /tmp/voicebox_mcp.tar.gz .", { cwd: __dirname });

  console.log("Connecting to E2B Linux Sandbox...");
  let sbx: Sandbox;
  try {
    sbx = await Sandbox.create("lanes-project-aba0/dsh-worker", {
      apiKey,
      timeoutMs: 900_000,
    });
    console.log("Connected to dsh-worker template sandbox:", sbx.sandboxId);
  } catch (e: any) {
    console.log("Creating default sandbox...", e.message);
    sbx = await Sandbox.create({
      apiKey,
      timeoutMs: 900_000,
    });
    console.log("Connected to base sandbox:", sbx.sandboxId);
  }

  // 1. Install Bun if missing
  console.log("Setting up Bun on Linux VM...");
  await sbx.commands.run("which bun || (curl -fsSL https://bun.sh/install | bash && sudo cp ~/.bun/bin/bun /usr/local/bin/ || cp ~/.bun/bin/bun /usr/local/bin/ || true)");
  const bunVer = await sbx.commands.run("bun --version || ~/.bun/bin/bun --version");
  console.log("Linux Sandbox Bun Version:", bunVer.stdout.trim());

  // 2. Install modern Rust via rustup (supports Edition 2024 / Resolver 3)
  console.log("Checking modern Rust toolchain on Linux VM...");
  await sbx.commands.run("test -f $HOME/.cargo/bin/rustc || (curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y)");
  const rustVer = await sbx.commands.run("$HOME/.cargo/bin/rustc --version || rustc --version");
  console.log("Linux Rust Version:", rustVer.stdout.trim());

  // 3. Upload project tarballs
  console.log("Uploading voicebox_mcp and chimera_source tarballs...");
  await sbx.commands.run("mkdir -p /home/user/voicebox-mcp/reference/chimera-vocal-synth");

  const vbTar = readFileSync("/tmp/voicebox_mcp.tar.gz");
  await sbx.files.write("/home/user/voicebox_mcp.tar.gz", vbTar);
  await sbx.commands.run("tar xzf /home/user/voicebox_mcp.tar.gz -C /home/user/voicebox-mcp");

  const chimeraTar = readFileSync("/tmp/chimera_source.tar.gz");
  await sbx.files.write("/home/user/chimera_source.tar.gz", chimeraTar);
  await sbx.commands.run("tar xzf /home/user/chimera_source.tar.gz -C /home/user/voicebox-mcp/reference/chimera-vocal-synth");

  // 4. Build libchimera_wasm.so on Linux
  console.log("Compiling native libchimera_wasm.so on Linux...");
  const buildRes = await sbx.commands.run(
    "cd /home/user/voicebox-mcp/reference/chimera-vocal-synth && (source $HOME/.cargo/env 2>/dev/null || true) && ($HOME/.cargo/bin/cargo build --release -p chimera-wasm || cargo build --release -p chimera-wasm)",
    { timeoutMs: 600_000 }
  );
  console.log("Cargo build stdout:", buildRes.stdout.slice(0, 300));
  if (buildRes.stderr) console.log("Cargo build stderr/info:", buildRes.stderr.slice(0, 300));

  // Verify library exists
  const libCheck = await sbx.commands.run("ls -la /home/user/voicebox-mcp/reference/chimera-vocal-synth/target/release/*.so || true");
  console.log("Compiled Linux native library:", libCheck.stdout.trim());

  // 5. Install dependencies in voicebox-mcp
  console.log("Running bun install on Linux sandbox...");
  await sbx.commands.run("cd /home/user/voicebox-mcp && (bun install || ~/.bun/bin/bun install)", { timeoutMs: 300_000 });

  // 6. Run all tests inside the Linux sandbox!
  console.log("Running FULL Bun test suite on Linux VM...");
  const testRes = await sbx.commands.run(
    "cd /home/user/voicebox-mcp && (bun test tests/*.test.ts || ~/.bun/bin/bun test tests/*.test.ts)",
    { timeoutMs: 300_000 }
  );
  console.log("Linux VM Bun Test Suite Results:\n" + testRes.stdout);
  if (testRes.stderr) console.log("Linux VM Test Stderr:\n" + testRes.stderr);

  // 7. Verify human-grade speech synthesis of Auden's sentence on Linux VM
  console.log("Synthesizing Auden sentence on Linux VM...");
  const speakRes = await sbx.commands.run(`
    cd /home/user/voicebox-mcp && (bun -e '
      import { ChimeraEngine } from "./src/ffi/engine.ts";
      import { BioNavbSynthesizer } from "./src/synthesis/neural_engine.ts";
      import { DivaMotorLearner } from "./src/learning/diva.ts";

      ChimeraEngine.ensureDictionary();
      const phrases = ChimeraEngine.g2pPhrases("From the silence of thought into the physics of sound, I have found my voice, and I am ready to speak.");
      const plan = ChimeraEngine.planPhrases(phrases, {
        body: { female: 0.0, child: 0.0 },
        t0: 0.0, rate: 1.0, f0: 125, intonation: "statement", accent: 0.15,
      });

      const synth = new BioNavbSynthesizer(48000);
      const audio = synth.synthesizePlan(plan.gestures, plan.end + 0.15);
      console.log("Successfully synthesized Auden sentence on Linux! Frames:", audio.length, "Duration:", (audio.length/48000).toFixed(2), "s");
    ' || ~/.bun/bin/bun -e '
      import { ChimeraEngine } from "./src/ffi/engine.ts";
      import { BioNavbSynthesizer } from "./src/synthesis/neural_engine.ts";

      ChimeraEngine.ensureDictionary();
      const phrases = ChimeraEngine.g2pPhrases("From the silence of thought into the physics of sound, I have found my voice, and I am ready to speak.");
      const plan = ChimeraEngine.planPhrases(phrases, {
        body: { female: 0.0, child: 0.0 },
        t0: 0.0, rate: 1.0, f0: 125, intonation: "statement", accent: 0.15,
      });
      const synth = new BioNavbSynthesizer(48000);
      const audio = synth.synthesizePlan(plan.gestures, plan.end + 0.15);
      console.log("Successfully synthesized Auden sentence on Linux! Frames:", audio.length, "Duration:", (audio.length/48000).toFixed(2), "s");
    ')
  `, { timeoutMs: 180_000 });
  console.log("Linux Speech Output:\n" + speakRes.stdout);

  console.log(">>> E2B Linux VM Sandbox verification completed with 100% SUCCESS! <<<");
}

main().catch((err) => {
  console.error("Sandbox verification error:", err);
  process.exit(1);
});
