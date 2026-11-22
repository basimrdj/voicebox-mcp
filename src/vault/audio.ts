/**
 * Audio Vault: WAV encoding, Base64 transport, and local storage caching.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AudioVaultResult {
  filePath: string;
  durationMs: number;
  sampleCount: number;
  sampleRate: number;
  base64Wav: string;
}

export function encodeWav(
  samples: Float32Array,
  sampleRate: number = 48000,
  format: "pcm16" | "float32" = "pcm16"
): Buffer {
  const numChannels = 1;
  const isFloat = format === "float32";
  const bytesPerSample = isFloat ? 4 : 2;
  const bitsPerSample = bytesPerSample * 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const buffer = Buffer.alloc(bufferSize);

  // RIFF Chunk
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(bufferSize - 8, 4);
  buffer.write("WAVE", 8);

  // fmt Subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(isFloat ? 3 : 1, 20); // 1 = PCM, 3 = IEEE Float
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data Subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write sample data
  if (isFloat) {
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      buffer.writeFloatLE(samples[i], offset);
      offset += 4;
    }
  } else {
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      // Clamp to [-1.0, 1.0] and scale to 16-bit integer
      const s = Math.max(-1.0, Math.min(1.0, samples[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      buffer.writeInt16LE(Math.round(val), offset);
      offset += 2;
    }
  }

  return buffer;
}

export function toBase64Wav(samples: Float32Array, sampleRate: number = 48000): string {
  const wavBuf = encodeWav(samples, sampleRate, "pcm16");
  return wavBuf.toString("base64");
}

export function saveToVault(
  samples: Float32Array,
  sampleRate: number = 48000,
  prefix: string = "voicebox"
): AudioVaultResult {
  const vaultDir = process.env.VOICEBOX_VAULT_DIR || join(homedir(), ".voicebox", "vault");
  if (!existsSync(vaultDir)) {
    mkdirSync(vaultDir, { recursive: true });
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const filename = `${prefix}_${timestamp}_${randomSuffix}.wav`;
  const filePath = join(vaultDir, filename);

  const wavBuffer = encodeWav(samples, sampleRate, "pcm16");
  writeFileSync(filePath, wavBuffer);

  const durationMs = (samples.length / sampleRate) * 1000;
  const base64Wav = wavBuffer.toString("base64");

  return {
    filePath,
    durationMs,
    sampleCount: samples.length,
    sampleRate,
    base64Wav,
  };
}
