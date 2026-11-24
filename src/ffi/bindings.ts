/**
 * Typed Bun FFI bindings to libchimera_wasm (C-ABI).
 * Supports macOS (.dylib), Linux (.so), and Windows (.dll).
 */
import { dlopen, FFIType, toArrayBuffer } from "bun:ffi";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function findLibraryPath(): string | null {
  if (process.env.CHIMERA_LIB_PATH && existsSync(process.env.CHIMERA_LIB_PATH)) {
    return process.env.CHIMERA_LIB_PATH;
  }

  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";
  const libNames = isMac
    ? ["libchimera_wasm.dylib"]
    : isWindows
      ? ["chimera_wasm.dll", "libchimera_wasm.dll"]
      : ["libchimera_wasm.so"];

  const searchDirs = [
    resolve(process.cwd(), "lib"),
    resolve(import.meta.dir, "../../lib"),
    resolve(process.cwd(), "lib", isWindows ? "x86_64-windows" : isMac ? "arm64-macos" : "x86_64-linux"),
    resolve(process.cwd(), "reference/chimera-vocal-synth/target/release"),
    resolve(process.cwd(), "target/release"),
    resolve(process.cwd()),
    resolve("/home/user/chimera/target/release"),
    resolve("/home/user/workspace/target/release"),
    resolve("/tmp"),
    resolve(import.meta.dir, "../../reference/chimera-vocal-synth/target/release"),
    resolve(import.meta.dir, "../../../reference/chimera-vocal-synth/target/release"),
  ];

  for (const dir of searchDirs) {
    for (const libName of libNames) {
      const candidate = resolve(dir, libName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

const libPath = findLibraryPath();

let loadedFfi: any = null;

if (libPath) {
  try {
    loadedFfi = dlopen(libPath, {
  // Linear memory & general API
  chimera_alloc: { args: ["usize" as any], returns: FFIType.ptr },
  chimera_free: { args: [FFIType.ptr, "usize" as any], returns: FFIType.void },
  chimera_call: { args: [FFIType.ptr, "usize" as any], returns: FFIType.u32 },
  chimera_result_ptr: { args: [], returns: FFIType.ptr },
  chimera_result_len: { args: [], returns: "usize" as any },
  chimera_layout_version: { args: [], returns: FFIType.u32 },
  chimera_gesture_record_size: { args: [], returns: FFIType.u32 },
  chimera_probe: { args: [FFIType.u32, FFIType.f64, FFIType.f64], returns: FFIType.f64 },

  // Audio Engine Lifecycle
  engine_new: { args: [FFIType.f64], returns: FFIType.ptr },
  engine_free: { args: [FFIType.ptr], returns: FFIType.void },
  engine_render: { args: [FFIType.ptr, "usize" as any], returns: FFIType.ptr },
  engine_clock: { args: [FFIType.ptr], returns: FFIType.f64 },

  // Speech Score & Gestures
  engine_records: { args: [FFIType.ptr], returns: FFIType.ptr },
  engine_schedule: { args: [FFIType.ptr, "usize" as any, FFIType.f64, FFIType.u32], returns: FFIType.f64 },
  engine_stop_speech: { args: [FFIType.ptr], returns: FFIType.void },
  engine_release: { args: [FFIType.ptr, FFIType.f64], returns: FFIType.void },

  // Articulators & Source Values
  engine_values: { args: [FFIType.ptr], returns: FFIType.ptr },
  engine_set_artic: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.void },
  engine_set_source: { args: [FFIType.ptr], returns: FFIType.void },
  engine_set_gate: { args: [FFIType.ptr, FFIType.f64], returns: FFIType.void },
  engine_set_body: { args: [FFIType.ptr, FFIType.f64, FFIType.f64], returns: FFIType.void },

  // Anatomy inspection
  engine_n_ph: { args: [FFIType.ptr], returns: FFIType.u32 },
  engine_n_or: { args: [FFIType.ptr], returns: FFIType.u32 },
  engine_body_female: { args: [FFIType.ptr], returns: FFIType.f64 },
  engine_body_child: { args: [FFIType.ptr], returns: FFIType.f64 },

  // Telemetry
  engine_telemetry: { args: [FFIType.ptr], returns: FFIType.ptr },
  engine_tele_labels: { args: [FFIType.ptr], returns: FFIType.ptr },

  // Beatbox Sequencer
  engine_set_beat: { args: [FFIType.ptr, FFIType.u32, "usize" as any, FFIType.f64, FFIType.f64, FFIType.u32], returns: FFIType.void },
  engine_beat_hit: { args: [FFIType.ptr], returns: FFIType.void },
  engine_beat_step: { args: [FFIType.ptr], returns: FFIType.f64 },

  // Creatures
  engine_set_creature: { args: [FFIType.ptr, FFIType.ptr, "usize" as any], returns: FFIType.u32 },
  engine_set_human: { args: [FFIType.ptr], returns: FFIType.void },
  engine_creature_param: { args: [FFIType.ptr, "usize" as any, FFIType.f64], returns: FFIType.void },
  engine_creature_telemetry: { args: [FFIType.ptr], returns: FFIType.ptr },
  engine_play_call: { args: [FFIType.ptr, "usize" as any, FFIType.f64, FFIType.f64], returns: FFIType.void },
  engine_stop_call: { args: [FFIType.ptr], returns: FFIType.void },
    });
  } catch (err) {
    console.warn(`[VoiceBox FFI] Warning: Failed to dlopen ${libPath}:`, err);
    loadedFfi = null;
  }
}

export const ffi = loadedFfi;
export const symbols: any = loadedFfi ? loadedFfi.symbols : null;

export function isNativeChimeraAvailable(): boolean {
  return loadedFfi !== null && loadedFfi.symbols !== null;
}

/**
 * Execute a JSON call on the CHIMERA main-thread engine.
 */
export function callJson<T = any>(req: Record<string, any>): T {
  if (!symbols) {
    throw new Error(
      `Native CHIMERA dynamic library is unavailable in this environment. Attempted call '${req.fn}' failed. Set CHIMERA_LIB_PATH to libchimera_wasm or use the neural DDSP synthesizer.`
    );
  }
  const enc = new TextEncoder();
  const bytes = enc.encode(JSON.stringify(req));
  const p = symbols.chimera_alloc(bytes.length);
  if (!p) throw new Error("chimera_alloc failed to allocate memory");
  const buf = new Uint8Array(toArrayBuffer(p, 0, bytes.length));
  buf.set(bytes);

  const status = symbols.chimera_call(p, bytes.length);
  symbols.chimera_free(p, bytes.length);

  const resPtr = symbols.chimera_result_ptr();
  if (!resPtr) throw new Error("chimera_result_ptr returned null");
  const resLen = Number(symbols.chimera_result_len());
  const resBuf = new Uint8Array(toArrayBuffer(resPtr, 0, resLen));
  const text = new TextDecoder().decode(resBuf);
  const json = JSON.parse(text);

  if (status !== 0) {
    throw new Error(json.error || `chimera_call('${req.fn}') failed`);
  }
  return json as T;
}
