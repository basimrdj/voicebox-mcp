# VoiceBox System Architecture

## 1. High-Level Architecture Overview

VoiceBox is a multi-tier speech production and vocal performance framework designed for autonomous AI agents. Rather than treating speech synthesis as a black-box text-to-waveform transformer with static categorical labels, VoiceBox decouples vocal expression into four distinct, independently serializable layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          1. LINGUISTIC CONTENT LAYER                        │
│   Normalized Text ──► G2P Phonemizer ──► Syllable Stress & Meter ──► Timing  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           2. VOCAL IDENTITY LAYER                           │
│   Vocal Tract Length (VTL) • Baseline F0 • Formant Offsets • Glottal Scale   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         3. VOCAL PERFORMANCE LAYER                          │
│   Continuous VAD Trajectories • Pitch Contours • Word Intention Modulation   │
│   Affectron Nonverbals (<sigh>, <breath>) • Dynamic Coarticulation Kinematics│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             4. RENDERING LAYER                              │
│   ┌───────────────────────────┬───────────────────────────┬─────────────┐   │
│   │   Physical C-Engine       │  Differentiable Resonator │  Neural TTS │   │
│   │   (CHIMERA 44-tube TLM)   │  (HiFi-Glot Filter Bank)  │  (VibeVoice)│   │
│   └───────────────────────────┴───────────────────────────┴─────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Four Distinct Layers

### Layer 1: Linguistic Content
- **Text Normalization**: Numbers, abbreviations, dates, and currency expansion.
- **Grapheme-to-Phoneme (G2P)**: International Phonetic Alphabet (IPA) and Arpabet representations.
- **Syllabification & Metrical Foot**: Identifying tonic nuclei, onset clusters, and coda consonants.
- **Phonemic Durations**: Segment-level duration models driven by phonetic context and coarticulation constraints rather than simple character-count heuristics.

### Layer 2: Vocal Identity (Voice DNA)
- Decouples *who is speaking* from *how they are speaking*.
- Defines biological morphometry:
  - Anatomic Vocal Tract Length (e.g., $17.5\text{ cm}$ male baseline, $14.5\text{ cm}$ female, $11.0\text{ cm}$ child).
  - Modal pitch distribution ($F_{0,mean}, F_{0,std}$).
  - Epilaryngeal narrowing ratio and vocal fold mass/stiffness profiles.
- Persisted as reusable JSON Voice DNA profiles (`voices/*.json`).

### Layer 3: Vocal Performance Timeline
- The central, portable data interchange format.
- Time-indexed tracks:
  - Pitch trajectory ($F_0(t)$) in semitones or Hertz.
  - Subglottal lung pressure ($P_s(t)$) in $\text{cmH}_2\text{O}$.
  - Glottal open quotient / shape parameter ($R_d(t)$).
  - Continuous Valence-Arousal-Dominance ($V(t), A(t), D(t)$).
  - Word-level communicative intent and stress modifiers.
  - Contextual nonverbal events (respiratory sighs, gasps, throat clears, chuckles).

### Layer 4: Rendering Dispatch
- Unified interface: `VoiceBox.perform(timeline, voice, options)`
- Multi-backend architecture:
  1. **Neural Expressive Backend**: Default high-fidelity speech synthesis using autoregressive flow matching and context prompt conditioning.
  2. **Differentiable Resonator Backend**: PyTorch all-pole filter bank driven by explicit $F_0$ and formant trajectories.
  3. **CHIMERA Physical Model**: Zero-dependency 44-tube transmission-line physical simulator running in pure C for extreme real-time (<0.5ms) and low-resource constraints.

---

## 3. Unified Developer API

```typescript
import { VoiceBox } from "@voicebox/core";

// 1. Initialize engine
const vb = new VoiceBox();

// 2. Perform speech with time-varying contextual performance
const result = await vb.perform({
  text: "I am completely fine with this decision.",
  voice: "carter_man",
  performance: {
    baseEmotion: "neutral",
    wordModulations: [
      { wordIndex: 2, text: "completely", emphasis: 1.4, vad: { valence: -0.4, arousal: 0.7, dominance: -0.2 } },
      { wordIndex: 3, text: "fine", durationScale: 1.3, tremor: 0.6 }
    ],
    nonverbals: [
      { position: "before", wordIndex: 0, type: "breath_catch" }
    ]
  },
  backend: "neural"
});

console.log(`Rendered ${result.durationMs}ms of audio in ${result.latencyMs}ms`);
```
