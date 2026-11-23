# VoiceBox Project Breakthrough Roadmap

## Milestone Overview

```
[M0] Scientific Audit & Baseline  ──► [M1] Phoneme Articulation & G2P ──► [M2] Foundation Models & Backend API
  ▲                                                                              │
  └───────────────────────────────┬──────────────────────────────────────────────┘
                                  ▼
[M3] Performance Timeline & Steering ──► [M4] Physically Conditioned Synthesis ──► [M5] Emotion Studio & Agent SDK
                                                                                             │
                                                                                             ▼
                                                                           [M6] Scientific Validation & Launch
```

---

## Milestone Status

### Milestone 0: Scientific Audit & Honest Baseline (IN PROGRESS)
- [x] Comprehensive research audit: Titze (2008), DIVA, Scherer (2003), Larrouy-Maestri (2024), 2025 Negative Emotion Review (`docs/research/vocal_physiology_audit.md`).
- [x] Modern neural and physical synthesis audit: SPARC, HiFi-Glot, diffTLM, CoCoEmo, EmoTra-TTS, Affectron (`docs/research/neural_articulatory_synthesis_survey.md`).
- [x] Model compatibility & licensing matrix (`docs/model-compatibility.md`).
- [x] Objective benchmark specifications (`docs/benchmarks.md`).
- [ ] Remove unverified claims (120-listener / 960-trial assertion) from `README.md` and `demo/index.html`.
- [ ] Replace `Math.random()` in `demo/index.html` with real Web Audio `AnalyserNode` FFT spectrum visualization.
- [ ] Document physical DSP vs trained neural synthesizer distinctions honestly in code comments and README.

### Milestone 1: Phoneme-Level Articulation & G2P Pipeline (PENDING)
- [ ] Implement robust G2P (Grapheme-to-Phoneme) and syllabification pipeline.
- [ ] Map phonemes to dynamic articulatory targets (jaw, tongue body, tongue tip, lip aperture, velum).
- [ ] Implement critically damped coarticulation filter between phoneme transitions.
- [ ] Add consonant release, plosive burst, and fricative turbulence modeling.
- [ ] Unit tests for vowel quadrilateral and minimal pair distinction.

### Milestone 2: Foundation Models & Unified Rendering Backend (PENDING)
- [ ] Standardize the `VoiceBox.perform()` unified API across physical and neural backends.
- [ ] Integrate local neural speech synthesis with explicit backend capability reporting.
- [ ] Zero-shot voice conditioning and identity preservation.

### Milestone 3: Universal Vocal Performance Timeline & Steering (PENDING)
- [ ] Design and implement the JSON-serializable Vocal Performance Timeline format.
- [ ] Support word-level emphasis, duration multipliers, and continuous VAD trajectories.
- [ ] Add nonverbal vocalization integration (respiratory sigh dump, breath catch, nervous swallow).
- [ ] Test intra-utterance emotional transitions on the 7-word benchmark.

### Milestone 4: Physically Conditioned Neural Synthesis (PENDING)
- [ ] Bridge physical trajectory controls into neural prompt conditioning and latent representation.
- [ ] Formally distinguish between physical DSP filters and learned neural weights.
- [ ] Validate acoustic sensitivity: measure how changes in $R_d$, $P_s$, and formants affect audio output.

### Milestone 5: VoiceBox Emotion Studio & Agent Voice SDK (PENDING)
- [ ] Build interactive Emotion Studio demo with word-level timeline keyframing.
- [ ] Implement true Web Audio FFT spectrogram and animated spectrum visualizers.
- [ ] Build Agent SDK with streaming audio and conversational barge-in interruption (<25ms).
- [ ] Provide drop-in integrations for autonomous agent harnesses.

### Milestone 6: Scientific Validation & Public Release (PENDING)
- [ ] Run open double-blind perceptual evaluation harness.
- [ ] Publish reproducible benchmarks and audio artifacts.
- [ ] Prepare launch-ready README, quickstart guides, and documentation.
