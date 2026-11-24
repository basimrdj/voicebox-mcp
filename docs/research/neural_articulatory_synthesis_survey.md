# State-of-the-Art Neural, Articulatory & Emotional Speech Synthesis (2024–2026)

## 1. Survey Scope & Methodology

This document audits modern neural and physical speech synthesis systems, their mathematical formulations, code availability, pretrained checkpoints, licensing constraints, and practical integration feasibility into VoiceBox.

---

## 2. Articulatory & Differentiable Physical Synthesis

### A. SPARC — Speech-Articulatory Coding (Berkeley Speech Group, 2024)
- **Repository**: `https://github.com/Berkeley-Speech-Group/Speech-Articulatory-Coding`
- **What it Solves**: Codes continuous speech through vocal tract kinematics (electromagnetic articulography / EMA) using an autoencoder with articulatory loss constraints.
- **Conditioning Signals**: 12-channel articulatory kinematic trajectories (jaw, tongue tip, tongue dorsum, lip aperture/protrusion, velum).
- **License**: MIT / Permissive Academic.
- **VoiceBox Takeaway**: Provides a principled continuous kinematic latent space for articulatory motion, avoiding ad-hoc heuristic parameters. However, requires mapping from text/phonemes to kinematic targets before driving speech generation.

### B. HiFi-Glot — Neural Formant Synthesis with Differentiable Resonators (Gu et al., 2024)
- **Repository**: `https://github.com/PupuAI/HiFi-Glot`
- **What it Solves**: Bridges physical source-filter theory and neural vocoding. Uses a learned neural excitation generator combined with differentiable all-pole digital resonator banks to produce high-fidelity audio with explicit formant and bandwidth control.
- **Conditioning Signals**: Time-varying pitch contour ($F_0$), formant frequencies ($F_1\text{--}F_5$), bandwidths ($B_1\text{--}B_5$), and excitation parameters.
- **License**: Apache-2.0 / Open Weights.
- **VoiceBox Critical Finding**: The preliminary VoiceBox `src/synthesis/hifi_glot.py` was merely a biquad difference equation loop in PyTorch with **zero learned weights** running under `torch.no_grad()`. True HiFi-Glot requires the trained neural excitation generator to achieve human naturalness.

### C. diffTLM — Differentiable Transmission-Line Model (Chen et al., NeurIPS 2026)
- **Repository**: `https://github.com/echen01/diffTLM`
- **What it Solves**: Formulates 1D/3D vocal tract wave propagation through acoustic transmission lines as a fully differentiable PyTorch/WebGPU simulation.
- **Conditioning Signals**: Vocal tract cross-sectional area functions $A(x, t)$ across 20–44 spatial segments.
- **License**: MIT.
- **VoiceBox Takeaway**: The gold standard for inverse vocal tract estimation (DIVA motor calibration). Given target audio, diffTLM can calculate $\nabla_{A(x)} \mathcal{L}_{acoustic}$ to fit true physiological vocal tract shapes from audio.

---

## 3. Emotional Controllability, Transition & Subtext Research

### D. CoCoEmo — Composable & Controllable Emotional TTS (ICML 2026)
- **Repository**: `https://github.com/wsssy/CoCoEmo`
- **What it Solves**: Enables composition of mixed, contradictory emotions (e.g., surface politeness + internal hostility) without requiring retraining or combinatorial dataset collection.
- **Mechanism**: **Activation Steering**. Computes emotional representation direction vectors $\mathbf{v}_{emo}$ in the residual stream of transformer TTS models (CosyVoice2, IndexTTS2) and applies linear steering offsets:
  $$\mathbf{h}'_l = \mathbf{h}_l + \alpha \mathbf{v}_{a} + \beta \mathbf{v}_{b}$$
- **License**: Apache-2.0.
- **VoiceBox Takeaway**: Decoupled conversational subtext is mathematically identical to activation steering. Instead of brittle DSP filters, subtext can be steered directly inside the latent space of modern neural TTS.

### E. EmoTra-TTS & TED-TTS (EMNLP 2026)
- **Repository**: `https://github.com/Liu-Tianchi/EmoTra-TTS`
- **What it Solves**: Eliminates sudden emotional jarring by enabling smooth intra-utterance emotional transitions across words.
- **Conditioning Signals**: Continuous time-varying Valence-Arousal-Dominance (VAD) trajectories parameterized by $C^1$-continuous cubic Hermite splines.
- **VoiceBox Takeaway**: Proves that emotional prosody must be planned as time-continuous trajectories rather than static sentence-level categorical flags.

### F. Affectron — Contextually Aligned Nonverbal Vocalizations (ACL 2026)
- **Repository**: `https://github.com/Choddeok/Affectron`
- **What it Solves**: Generates contextually appropriate nonverbal vocalizations (involuntary sighs, hesitant inhalations, laughter, throat clearing) integrated into the speech timeline rather than spliced as pre-baked WAV clips.
- **Conditioning Signals**: Text with paralinguistic tag markers (`<sigh>`, `<gasp>`, `<chuckle>`) conditioned on dialogue context.
- **VoiceBox Takeaway**: Human anxiety, exasperation, and relief are signaled by respiratory events (inhalation catches, sigh dumps) preceding or trailing speech.

### G. WeSCon — Word-Level Emotional Expression Control (NeurIPS 2025)
- **Reference**: `https://wangtianrui.github.io/wescon/`
- **What it Solves**: Provides fine-grained word-level emotion intensity vectors, allowing a speaker to deliver a sentence calmly while placing intense emphasis or emotional leak on a single target word.

---

## 4. Foundation Model Comparative Matrix & Licensing Audit

| Foundation Model | Architecture | Naturalness | Inference Speed | Licensing & Commercial Use | VoiceBox Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen3-TTS** | Autoregressive + Flow-Matching (Nov 2026) | State-of-the-Art | Real-Time Factor < 0.25 (Metal/CUDA) | Apache 2.0 (Permissive) | Primary candidate for zero-shot naturalness & instruction following |
| **CosyVoice 2 / 2.5** | Multi-lingual LLM-based TTS (Alibaba) | Exceptional | Fast streaming chunks | Apache 2.0 (Permissive) | Primary target for CoCoEmo activation steering |
| **IndexTTS 2 / 2.5** | Autoregressive Diffusion (Bilibili) | Very High | Moderate | **Bilibili Non-Commercial / Custom License** | Restricted; must remain an optional external plugin, not bundled default |
| **Chatterbox Nano/Turbo** | Lightweight Neural TTS (Resemble AI) | Good | Ultra-fast (<15ms latency) | Apache 2.0 | Best candidate for low-resource CPU / edge deployment |
| **VibeVoice Realtime 0.5B** | MLX Flow Matching & PyTorch / Transformers | High naturalness | Real-time (Apple Silicon, CUDA, AMD ROCm) | MIT / Apache 2.0 compatible | Multi-platform neural subtext baseline |
| **CHIMERA C-Engine** | Native Transmission-Line Physical Model | Synthetic / Robotic | Sub-millisecond (<0.5ms) | MIT (Jameson Hodge upstream attribution) | Deterministic physical baseline & articulatory testbed |
| **HiFi-Glot Native** | Differentiable Resonator Filter Bank | Clear Formants | Zero Latency (DSP) | Apache 2.0 | Physical acoustic realization layer |
