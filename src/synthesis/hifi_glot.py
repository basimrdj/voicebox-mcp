#!/usr/bin/env python3
"""
VoiceBox Research & Prototyping — Differentiable Resonator Filter Bank (DSP Physical Baseline)
Based on:
- Fant (1960): "Acoustic Theory of Speech Production"
- Titze (2008): "Nonlinear Source–Filter Coupling in Phonation"
- Gu et al. (2024): "High-Fidelity Neural Formant Synthesis with Differentiable Resonant Filters"

NOTE ON ARCHITECTURE:
This module implements a differentiable second-order all-pole resonant biquad filter bank in
PyTorch. While inspired by the physical resonator layers of HiFi-Glot, this script is a physical/DSP
synthesis baseline operated under torch.no_grad(). It does not contain pretrained neural vocoder
weights. A fully trained neural excitation vocoder is maintained as an active research track.
"""

import sys
import os
import json
import argparse
import numpy as np
import soundfile as sf
import torch
import torch.nn as nn

class DifferentiableResonatorBank(nn.Module):
    """
    Bank of 2nd-order all-pole resonant biquad filters in PyTorch.
    H(z) = G / (1 - a1*z^-1 - a2*z^-2)
    where:
      theta = 2 * pi * f_k / fs
      r = exp(-pi * b_k / fs)
      a1 = 2 * r * cos(theta)
      a2 = -r^2
      G = 1 - a1 - a2 (DC unity gain)
    """
    def __init__(self, sample_rate=48000, num_formants=5):
        super().__init__()
        self.sample_rate = sample_rate
        self.num_formants = num_formants

    def forward(self, excitation, formants, bandwidths):
        """
        excitation: [B, T] tensor of glottal flow excitation
        formants: [B, num_formants, T] tensor of formant frequencies in Hz
        bandwidths: [B, num_formants, T] tensor of bandwidths in Hz
        returns: [B, T] filtered audio waveform
        """
        B, T = excitation.shape
        fs = float(self.sample_rate)

        # Clamp frequencies and bandwidths
        f_clamped = torch.clamp(formants, 40.0, fs * 0.48)
        b_clamped = torch.clamp(bandwidths, 15.0, 2500.0)

        theta = 2.0 * np.pi * f_clamped / fs
        r = torch.exp(-np.pi * b_clamped / fs)

        a1 = 2.0 * r * torch.cos(theta)    # [B, num_formants, T]
        a2 = -r * r                        # [B, num_formants, T]
        g = 1.0 - a1 - a2                  # [B, num_formants, T]

        # Time-domain cascade simulation across formants
        y_current = excitation
        for k in range(self.num_formants):
            a1_k = a1[:, k, :]
            a2_k = a2[:, k, :]
            g_k = g[:, k, :]

            # Filter loop over time steps T
            y_out = torch.zeros_like(y_current)
            y1 = torch.zeros(B, device=excitation.device)
            y2 = torch.zeros(B, device=excitation.device)

            for t in range(T):
                yt = g_k[:, t] * y_current[:, t] + a1_k[:, t] * y1 + a2_k[:, t] * y2
                y2 = y1
                y1 = yt
                y_out[:, t] = yt

            y_current = y_out

        return y_current

def synthesize_trajectory_hifiglot(traj_data, output_path, sample_rate=48000):
    """
    Synthesizes audio from a trajectory dict using HiFi-Glot source-filter synthesis.
    """
    frames = traj_data.get("frames", [])
    if not frames:
        raise ValueError("Trajectory contains no frames.")

    total_dur_ms = frames[-1]["timeMs"]
    total_samples = int(np.ceil((total_dur_ms / 1000.0) * sample_rate))
    if total_samples <= 0:
        return

    dt_ms = 1000.0 / sample_rate
    times_ms = np.arange(total_samples) * dt_ms

    # Extract time series by linear interpolation across frames
    frame_times = np.array([f["timeMs"] for f in frames], dtype=np.float32)
    f0_pts = np.array([f["glottal"]["f0"] for f in frames], dtype=np.float32)
    ps_pts = np.array([f["glottal"]["subglottalPressure"] for f in frames], dtype=np.float32)
    rd_pts = np.array([f["glottal"]["glottalRd"] for f in frames], dtype=np.float32)
    breath_pts = np.array([f["glottal"]["breathiness"] for f in frames], dtype=np.float32)
    tremor_depth_pts = np.array([f["glottal"].get("tremorDepth", 0.0) for f in frames], dtype=np.float32)
    tremor_freq_pts = np.array([f["glottal"].get("tremorFrequency", 0.0) for f in frames], dtype=np.float32)

    # Interpolate source trajectories
    f0_interp = np.interp(times_ms, frame_times, f0_pts)
    ps_interp = np.interp(times_ms, frame_times, ps_pts)
    rd_interp = np.interp(times_ms, frame_times, rd_pts)
    breath_interp = np.interp(times_ms, frame_times, breath_pts)
    tremor_depth_interp = np.interp(times_ms, frame_times, tremor_depth_pts)
    tremor_freq_interp = np.interp(times_ms, frame_times, tremor_freq_pts)

    # Modulate pitch with tremor
    tremor_mask = tremor_depth_interp > 0.01
    if np.any(tremor_mask):
        tremor_phases = 2.0 * np.pi * tremor_freq_interp * (times_ms / 1000.0)
        f0_interp = f0_interp * (1.0 + 0.08 * tremor_depth_interp * np.sin(tremor_phases))

    # Interpolate formants and bandwidths (F1-F5, B1-B5)
    num_formants = 5
    formants_interp = np.zeros((num_formants, total_samples), dtype=np.float32)
    bandwidths_interp = np.zeros((num_formants, total_samples), dtype=np.float32)

    for k in range(num_formants):
        fk_pts = np.array([f["acoustics"]["formants"][k] for f in frames], dtype=np.float32)
        bk_pts = np.array([f["acoustics"]["bandwidths"][k] for f in frames], dtype=np.float32)
        formants_interp[k, :] = np.interp(times_ms, frame_times, fk_pts)
        bandwidths_interp[k, :] = np.interp(times_ms, frame_times, bk_pts)

    # 1. Generate Glottal Flow Pulse Derivative E(t)
    # Using continuous phase accumulator
    phase = 0.0
    phases = np.zeros(total_samples, dtype=np.float32)
    for i in range(total_samples):
        phases[i] = phase
        phase += f0_interp[i] / sample_rate
        if phase >= 1.0:
            phase -= 1.0

    # Gunnar Fant LF approximation for flow derivative
    # E(t): sharp negative pulse at closure Te, exponential return
    glottal_excitation = np.zeros(total_samples, dtype=np.float32)
    for i in range(total_samples):
        ph = phases[i]
        rd = rd_interp[i]
        # Open quotient Oq roughly 0.6 + 0.1 * (rd - 1.0)
        oq = np.clip(0.55 + 0.08 * (rd - 1.0), 0.35, 0.85)
        if ph < oq:
            # Opening and closing phase
            glottal_excitation[i] = np.sin(np.pi * ph / oq) * np.sin(2.0 * np.pi * ph / oq)
        else:
            # Return phase: rapid exponential decay
            decay = (ph - oq) / (1.0 - oq + 1e-5)
            glottal_excitation[i] = -0.8 * np.exp(-12.0 * decay / max(0.1, rd))

    # Pressure scaling (Ps / 8.0)^1.2
    ps_scale = np.power(np.maximum(1.0, ps_interp) / 8.0, 1.2)
    glottal_excitation *= ps_scale

    # 2. Turbulent Aspiration Noise
    noise = np.random.randn(total_samples).astype(np.float32)
    aspiration = noise * breath_interp * (0.3 + 0.7 * (phases < 0.6)) * 0.45

    total_excitation = glottal_excitation + aspiration

    # 3. Apply Differentiable Resonator Filter Bank
    resonator_bank = DifferentiableResonatorBank(sample_rate=sample_rate, num_formants=num_formants)
    with torch.no_grad():
        exc_t = torch.from_numpy(total_excitation).unsqueeze(0) # [1, T]
        formants_t = torch.from_numpy(formants_interp).unsqueeze(0) # [1, 5, T]
        bws_t = torch.from_numpy(bandwidths_interp).unsqueeze(0) # [1, 5, T]

        audio_t = resonator_bank(exc_t, formants_t, bws_t)
        audio = audio_t.squeeze(0).numpy()

    # 4. Lip Radiation Filter: (1 - 0.96 * z^-1) forward difference
    radiated = np.zeros_like(audio)
    radiated[1:] = audio[1:] - 0.96 * audio[:-1]
    radiated[0] = audio[0]

    # Gentle edge fade (10ms)
    fade_len = int(0.010 * sample_rate)
    if len(radiated) > 2 * fade_len:
        win_in = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fade_len))
        win_out = 0.5 - 0.5 * np.cos(np.linspace(np.pi, 0, fade_len))
        radiated[:fade_len] *= win_in
        radiated[-fade_len:] *= win_out

    # Peak normalization to -1.5 dBFS (0.84)
    peak = np.max(np.abs(radiated))
    if peak > 1e-4:
        radiated = (radiated / peak) * 0.84

    out_int16 = (radiated * 32767.0).astype(np.int16)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    sf.write(output_path, out_int16, sample_rate, subtype="PCM_16")
    print(f"SUCCESS: HiFi-Glot synthesized {output_path} ({len(radiated)} samples, {total_dur_ms:.1f}ms)")

def main():
    parser = argparse.ArgumentParser(description="VoiceBox HiFi-Glot Differentiable Resonator Synthesizer")
    parser.add_argument("--trajectory", type=str, required=True, help="Path to vocal trajectory JSON")
    parser.add_argument("--output", type=str, required=True, help="Output WAV path")
    parser.add_argument("--sample_rate", type=int, default=48000, help="Audio sample rate (Hz)")

    args = parser.parse_args()
    with open(args.trajectory, "r", encoding="utf-8") as f:
        traj_data = json.load(f)

    synthesize_trajectory_hifiglot(traj_data, args.output, args.sample_rate)

if __name__ == "__main__":
    main()
