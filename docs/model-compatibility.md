# Model Compatibility & Backend Matrix

## 1. Overview

VoiceBox decouples vocal performance authoring from acoustic rendering. Different backends provide different trade-offs between physical controllability, naturalness, latency, and resource footprint.

Every backend in VoiceBox must explicitly declare its capabilities:
- **Exact**: The control directly modulates the acoustic synthesis engine.
- **Approximate**: The control is mapped into an instruction prompt or feature vector.
- **Unsupported**: The control has no effect on this backend (gracefully ignored without failing).

---

## 2. Backend Feature & Capability Matrix

| Feature / Control | Physical / CHIMERA | Differentiable Resonator (HiFi-Glot DSP) | VibeVoice Realtime 0.5B (MLX & PyTorch) | CoCoEmo / CosyVoice (Steered) | Qwen3-TTS Expressive |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **G2P / Phoneme Timing** | Exact | Exact | Internal Neural | Internal Neural | Internal Neural |
| **Vocal Tract Cross-Sections**| Exact (44 tubes) | Approximate (Formants) | Unsupported | Unsupported | Unsupported |
| **Glottal Flow ($R_d, P_s$)** | Exact (Fant LF) | Exact (LF Excitation) | Approximate (Acoustic Filter) | Unsupported | Approximate |
| **Pitch Contour ($F_0$)** | Exact | Exact | Approximate | Steered Vector | Context Prompted |
| **Word-Level Emotion** | Approximate | Approximate | Approximate | Exact (Vector Steering)| Exact (Instruction) |
| **Smooth Emotion Transition** | Exact ($C^1$ spline) | Exact ($C^1$ spline) | Interpolated | Steered Trajectory | Contextual |
| **Nonverbal Vocalizations** | Physical Reflexes | Filtered Noise | Prompted | Latent Insertion | Exact Token (`<sigh>`) |
| **License** | MIT | Apache-2.0 | MIT / Apache-2.0 | Apache-2.0 | Apache-2.0 |
| **Platforms Supported** | macOS, Linux, Windows | macOS, Linux | Linux (CUDA, ROCm), Windows, macOS | Linux, macOS (CUDA/MPS) | Linux, macOS |
| **Memory Footprint** | < 15 MB | < 40 MB | ~500 MB (4-bit) / ~1.0 GB | ~2.5 GB | ~3.8 GB |
| **Time to First Audio** | < 1 ms | < 5 ms | ~85 ms (MLX) / ~180 ms (PyTorch)| ~140 ms | ~180 ms |

---

### 2.1 Cross-Platform Neural Subtext Layer (MLX, PyTorch & AMD ROCm)

The neural subtext generation layer automatically adapts to host hardware:
- **macOS (Apple Silicon)**: Utilizes quantized MLX flow matching (`mlx-community/VibeVoice-Realtime-0.5B-4bit`) for sub-100ms streaming generation.
- **Linux & Windows (NVIDIA CUDA)**: Runs Microsoft's official `microsoft/VibeVoice-Realtime-0.5B` via PyTorch and Transformers with automatic CUDA device mapping and bfloat16/float16 acceleration.
- **Linux & Windows (AMD Radeon GPUs with ROCm)**: Fully supported through PyTorch HIP/ROCm. When `torch.version.hip` is detected, VoiceBox automatically routes neural tensor computation to Radeon compute units.
  ```bash
  # Install PyTorch with ROCm 6.2 for AMD Radeon GPUs:
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/rocm6.2
  pip install transformers soundfile scipy
  ```
- **CPU & Lightweight Systems**: Seamless fallback to CPU PyTorch or native platform speech synthesizers (`say` on macOS, `espeak-ng` on Linux, `SAPI` on Windows) with universal biophysical post-processing applied identically.

---

### 2.2 Pre-Built Native Waveguide Binaries (Skip the Rust Build)

For users who want physical 44-tube transmission-line waveguide synthesis without installing the Rust toolchain:
- **Pre-built binaries** are compiled in GitHub Actions CI for every platform:
  - Linux x86_64: `libchimera_wasm.so`
  - macOS arm64: `libchimera_wasm.dylib`
  - Windows x86_64: `chimera_wasm.dll`
- **Instant Installation**:
  ```bash
  bun run setup:native
  # or
  python3 scripts/download_prebuilt.py
  ```
  The script automatically queries GitHub Releases, downloads the correct shared library for your platform, and drops it into `lib/`. If the native binary is absent, VoiceBox runs uninterrupted in pure DDSP and neural synthesis modes.

---

## 3. Strict Licensing Guidelines

1. **Permissive First**: The core VoiceBox repository, MCP server, and default local pipelines are distributed strictly under permissive open-source licenses (MIT and Apache-2.0).
2. **Upstream Attribution**: CHIMERA was authored by Jameson Hodge and is licensed under MIT. Full attribution is maintained in `LICENSE` and across all native source files.
3. **Restricted Model Policy (IndexTTS, etc.)**:
   - Any backend governed by non-commercial or proprietary licenses (e.g., IndexTTS Bilibili license, non-commercial research weights) must **never** be bundled into the core package or distributed as default weights.
   - Restricted backends are supported exclusively as **opt-in external plugins** requiring explicit user installation.
4. **Dataset Compliance**: Datasets with non-commercial restrictions (e.g., RAVDESS) are used solely for comparative reference evaluation scripts, never embedded into redistributable model checkpoints.
