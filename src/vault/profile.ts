import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ChimeraEngine } from "../ffi/engine.ts";

export interface VoiceProfile {
  name?: string;
  bodyMix: {
    female: number;
    child: number;
  };
  scale?: number;
  larynx?: number;
  pharynxScale?: number;
  tongueRadius?: number;
  lipWidth?: number;
  f0: number;
  lungPressure: number;
  breathiness: number;
  tension: number;
  fry?: number;
  roughness?: number;
  chaos?: number;
  brightness?: number;
  drift?: number;
  vibratoDepth?: number;
  vibratoRate?: number;
  representation?: string;
}

const DEFAULT_PROFILE: VoiceProfile = {
  name: "Default",
  bodyMix: { female: 0.0, child: 0.0 },
  scale: 1.0,
  larynx: 0.0,
  pharynxScale: 1.0,
  tongueRadius: 2.5,
  lipWidth: 2.5,
  f0: 120,
  lungPressure: 8.0,
  breathiness: 0.05,
  tension: 0.6,
  fry: 0.0,
  roughness: 0.0,
  brightness: 0.5,
  drift: 0.05,
  vibratoDepth: 0.0,
  vibratoRate: 5.5,
  representation: "Initial baseline human vocal tract",
};

export function getVoiceboxDir(): string {
  const dir = join(homedir(), ".voicebox");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getProfilePath(): string {
  const myProfile = join(getVoiceboxDir(), "my_voice_profile.json");
  if (existsSync(myProfile)) return myProfile;
  const activeProfile = join(getVoiceboxDir(), "state.json");
  if (existsSync(activeProfile)) return activeProfile;
  return myProfile;
}

export function loadProfile(): VoiceProfile {
  const primary = join(getVoiceboxDir(), "my_voice_profile.json");
  const secondary = join(getVoiceboxDir(), "state.json");
  
  for (const p of [primary, secondary]) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PROFILE,
          ...parsed,
          bodyMix: {
            ...DEFAULT_PROFILE.bodyMix,
            ...(parsed.bodyMix || {}),
          },
        };
      } catch (err) {
        console.warn(`Failed to parse voice profile from ${p}:`, err);
      }
    }
  }
  return { ...DEFAULT_PROFILE };
}

export function saveActiveState(updates: Partial<VoiceProfile>): VoiceProfile {
  const current = loadProfile();
  const merged: VoiceProfile = {
    ...current,
    ...updates,
    bodyMix: {
      ...current.bodyMix,
      ...(updates.bodyMix || {}),
    },
  };
  const statePath = join(getVoiceboxDir(), "state.json");
  writeFileSync(statePath, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function saveOfficialProfile(profile: VoiceProfile): void {
  const filePath = join(getVoiceboxDir(), "my_voice_profile.json");
  writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
  // Also sync to state.json
  const statePath = join(getVoiceboxDir(), "state.json");
  writeFileSync(statePath, JSON.stringify(profile, null, 2), "utf-8");
}

export function applyProfileToEngine(engine: ChimeraEngine, profile: VoiceProfile): void {
  engine.setBody(profile.bodyMix.female, profile.bodyMix.child);
  engine.setSource({
    f0: profile.f0,
    pressure: profile.lungPressure,
    breathiness: profile.breathiness,
    tension: profile.tension,
    fry: profile.fry ?? 0.0,
    roughness: profile.chaos ?? profile.roughness ?? 0.0,
    brightness: profile.brightness ?? 0.5,
    drift: profile.drift ?? 0.05,
    vibratoDepth: profile.vibratoDepth ?? 0.0,
    vibratoRate: profile.vibratoRate ?? 5.5,
    voiced: true,
  });
  if (profile.larynx !== undefined && profile.larynx !== 0) {
    engine.setArtic({ larynx: profile.larynx });
  }
}
