# Scientific Audit: Human Phonation, Vocal Physiology & Emotional Prosody

## 1. Executive Summary & Epistemic Stance

A foundational flaw in early computational voice prototypes is the conflation of **mathematical control parameters** with **universal physiological truths**.

In VoiceBox, we formally reject the naive assumption that a given emotional state corresponds to a static, invariant anatomical configuration (e.g., asserting that "anxiety is universally an 8.5 Hz tremor" or "sadness is universally an $R_d = 2.20$ glottal collapse"). Modern acoustic phonetics and psychoacoustics demonstrate that emotional prosody is:
1. **Context-dependent**: Influenced by social hierarchy, communicative intent, and pragmatic goal.
2. **Speaker-dependent**: Shaped by baseline vocal anatomy, pitch range, and individual coping strategies.
3. **Probabilistic**: Manifesting as distributions of acoustic cues rather than deterministic physiological invariants.

We treat all biophysical parameters ($R_d, P_s$, articulatory offsets, formant transitions) as **controllable inductive priors** and **synthesis dimensions**, not dogmatic biological absolutes.

---

## 2. Ingo Titze — Nonlinear Source–Filter Coupling in Phonation (2008)

### Core Physical Mechanisms:
Classical linear acoustic theory (Fant, 1960) treats the vocal source (glottal airflow) and the vocal tract filter as independent, non-interacting systems:
$$P(f) = U_g(f) \cdot H(f) \cdot R(f)$$
Titze (2008) proved that **nonlinear acoustic interaction** between the glottal source and the supraglottal air column dominates human voice quality, vocal efficiency, and register transitions:
1. **Inertive Loading (Level 1 Coupling)**: When the vocal tract input impedance is inertive (inertance $I > 0$), meaning the acoustic pressure is in phase with air column acceleration, the supraglottal pressure $P_{sup}$ is negative during glottal closing. This asymmetric pressure differential across the vocal folds accelerates closing, sharpening the glottal flow shutoff slope ($E_e$) and boosting harmonic power in the 2–4 kHz region by 6–12 dB without increased muscular effort.
2. **Biomechanic Coupling (Level 2 Coupling)**: Extreme supraglottal pressures feed back directly onto vocal fold tissue displacement, causing subharmonic generation, pitch jumps, bifurcations, and chaos (audible as rough vocal fry or voice breaks under intense emotion).

### Synthesis & Engineering Implications:
- In VoiceBox, supraglottal coupling cannot be simulated by simply slapping a filter onto an audio signal.
- The glottal pulse derivative $d U_g / dt$ must be skewed dynamically as a function of the instantaneous acoustic load of the vocal tract tube geometry.
- Glottal open quotient ($O_q$), return quotient ($R_a$), and amplitude quotient ($R_k$) are dynamically coupled to vocal tract resonant inertance.

---

## 3. Frank Guenther — The DIVA Model of Speech Motor Control

### Theoretical Architecture:
The DIVA (Directions Into Velocities of Articulators) model describes the neurocomputational feedforward and feedback control systems governing speech acquisition and production:
1. **Feedforward Control Subsystem**:
   - Stores learned motor programs mapping phonetic targets (syllables) directly to articulatory velocities ($v_{art}$).
   - Operates rapidly without waiting for sensory feedback (essential for fluent speech rates of 4–7 syllables/sec).
2. **Auditory & Somatosensory Feedback Subsystems**:
   - Monitors acoustic output ($F_1, F_2, F_3, F_0$) and somatosensory state (articular contact, jaw displacement).
   - Computes sensory error: $e_{aud}(t) = y_{target}(t) - y_{actual}(t)$.
   - Updates feedforward motor commands via inverse Jacobian mapping ($J^{-1}$): $\Delta \theta = J^{-1} \cdot e_{aud}$.

### The Dual-Objective Crux for VoiceBox Self-Calibration:
A critical finding from Guenther's work and inverse vocal tract modeling is that **the articulatory-to-acoustic mapping is many-to-one** (the "acoustic inversion problem"):
- Multiple distinct vocal tract configurations can produce identical formant frequencies ($F_1, F_2$).
- Optimizing purely for acoustic error $\min \|F_{meas} - F_{target}\|$ often causes articulators to converge onto biologically impossible or bizarre configurations that sound robotic or unstable.
- **Therefore, VoiceBox self-calibration must decouple into two distinct objectives**:
  1. *Sensory Target Alignment*: Convergence on intended acoustic and phonetic targets.
  2. *Perceptual Naturalness & Motor Economy*: Regularization preventing extreme articulatory displacement and ensuring humanlike coarticulation paths.

---

## 4. Klaus Scherer — Vocal Communication of Emotion (2003) & Component Process Model

### Paradigmatic Insights:
Scherer's Component Process Model (CPM) demonstrates that vocal affect is driven by appraisal checks (novelty, pleasantness, goal conduciveness, coping capacity):
1. **Sympathetic vs. Parasympathetic Autonomic Drive**:
   - *High Arousal / Low Coping (Panic Fear, Acute Anxiety)*: Sympathetic excitation increases subglottal pressure ($P_s$), tightens cricothyroid tension (elevating $F_0$), and causes shallow, irregular thoracic breathing.
   - *Low Arousal / Low Coping (Depression, Quiet Dejection)*: Parasympathetic dominance leads to muscular hypotonia, lax vocal fold adduction ($R_d > 2.0$), dying subglottal pressure collapse, and downward pitch drift toward vocal fry.
2. **The "Push" vs. "Pull" Effects in Emotional Prosody**:
   - *Push Effects*: Involuntary physiological leakage (tremor, breathlessness, vocal fold tension).
   - *Pull Effects*: Voluntary socio-cultural communicative shaping (politeness, irony, deadpan understatement, sarcasm).
   - Authentic conversational subtext is the **interference pattern between Push and Pull effects**—the conflict between what the speaker feels and what they intend to project.

---

## 5. Larrouy-Maestri et al. (2024) & Negative Emotion Correlates (2025)

### Systematic Review Findings:
Recent comprehensive reviews (Larrouy-Maestri et al., 2024; PMC12231869; Systematic Review of Negative Emotion Correlates, 2025; PMC12289014) critically dismantle the myth of universal emotion archetypes:
1. **Lack of Invariant Signatures**: Across hundreds of empirical studies, no single acoustic parameter consistently distinguishes fear from anxiety, or anger from contempt across all speakers.
2. **Fundamental Frequency Variability**: While mean $F_0$ often rises under stress, up to 30% of anxious speakers exhibit pitch *depression* or monotone flattening due to behavioral freezing and suppression.
3. **Temporal Dominance**: In human listening tests, speech rate, pause distribution, and syllable duration variance often convey emotional authenticity more reliably than spectral tilt or pitch height alone.

### Design Principles for VoiceBox:
- Never hardcode a single rigid emotion preset.
- Expose continuous performance dimensions: Valence $[-1, 1]$, Arousal $[0, 1]$, Dominance $[-1, 1]$, Tension $[0, 1]$, and Phonation Laxness $[0, 1]$.
- Support localized, word-level prosodic inflection rather than global sentence-level color filters.
