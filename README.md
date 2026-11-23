<div align="center">

<img src="assets/logo.png" alt="VoiceBox Logo" width="120" height="120" />

# VoiceBox 🎙️

**The Biophysical Vocal Tract & Subtextual Prosody Engine for AI Agents**

*Stop giving your autonomous agents a synthetic smile filter. Give them an actual physical throat, lungs, and involuntary emotional leakage.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh/)
[![MCP](https://img.shields.io/badge/MCP-1.32+-8A2BE2?style=flat-square)](https://modelcontextprotocol.io/)
[![Acoustics](https://img.shields.io/badge/Acoustics-48_kHz_C--ABI-blue?style=flat-square)](https://github.com/basimrdj/voicebox-mcp)
[![Tests](https://img.shields.io/badge/Tests-80%20passed%20(87k%20asserts)-success?style=flat-square)](https://github.com/basimrdj/voicebox-mcp)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Quickstart](#quickstart) • [Upstream Attribution](#upstream-attribution--differentiation) • [The 7 Subtexts](#the-7-conversational-subtexts) • [Why VoiceBox?](#why-voicebox-vs-conventional-tts) • [Agent Skill](#-universal-agent-skill-integration-skillmd) • [MCP Tools](#mcp-tools-reference-16-standard--2-developmental)

</div>

---

## Upstream Attribution & Differentiation

VoiceBox's native physical acoustic waveguide builds upon the open-source **[CHIMERA](https://github.com/jamesondh/chimera-vocal-synth)** physical-modeling voice synthesizer created by **Jameson Hodge**. CHIMERA provides the underlying 1D transmission-line vocal tract simulation, airway mechanics, and gestural score scheduling.

### VoiceBox's Novel Differentiation

While CHIMERA implements the core physical airway and articulatory gestural mechanics, VoiceBox extends this foundation into the autonomous AI agent ecosystem by contributing:

1. **Universal Agent MCP Architecture**: Exposes 16+ biophysical control tools over standard Model Context Protocol (`stdio` JSON-RPC) and universal agent skills (`SKILL.md`) across Claude Code, Cursor, Windsurf, Antigravity, and LangChain/CrewAI.
2. **Dual-Pathway Vocal Psychology Engine**: Simulates involuntary limbic-PAG emotional leakage ($R_d$ glottal flow dynamics, subglottal pressure surges, $C^1$-continuous micro-glottal stops, 8.5 Hz neuromuscular tremors, and metrical phonology time-warping).
3. **Hybrid Resonator Layers & Streaming**: Integrates a BioNavb DDSP formant resonator bank with Gunnar Fant differential LF flow, Ingo Titze supraglottal inertance coupling, and smooth inter-chunk state tracking.
4. **Closed-Loop DIVA Sensorimotor Loop**: Provides auditory self-perception (`listen_to_self`) and autonomous motor babbling for AI agents to calibrate their own vowel space.

---

## Why VoiceBox vs. Conventional TTS?

Most AI speech engines treat voice like a text-translation pipeline: text goes in, and a neural vocoder reads it aloud with an unnaturally cheerful, uniform cadence. 

**Real human communication does not work that way.** When a human is annoyed or sarcastic, their surface words remain polite while their vocal cords involuntarily betray their real feelings.

| Dimension | Conventional Cloud TTS (ElevenLabs, Cartesia) | VoiceBox (Biophysical Waveguide) |
| :--- | :--- | :--- |
| **Acoustic Physics** | Latent diffusion tokens / Statistical frames | **48 kHz fluid dynamics & wave reflection mesh** |
| **Laryngeal Control** | None (black-box neural audio generator) | **17 articulators + 12 glottal source parameters** |
| **Emotional Subtext** | Cartoonish global mood filters | **Involuntary laryngeal clamp ($R_d \downarrow$, pressed phonation)** |
| **Tone Decoupling** | Impossible (text dictates vocal mood) | **Dual-Pathway (Polite words, cold tension leakage)** |
| **Non-Verbal Reflexes** | Hallucinated or incoherent | **Physiological 3-phase sighs, 5 Hz laughter, sobs** |
| **Singing Mechanics** | Synthetic autotune approximations | **1:6 Epilaryngeal resonance (Singer's Formant) + vibrato** |
| **Cost & Latency** | Cloud API charges per character (~200–500ms roundtrip) | **100% Local**: Native C-ABI waveguide renders at ~1–3ms per buffer; neural/Python subtext layer is ~150–400ms |
| **Barge-In Interruption** | Requires terminating cloud stream session | **Sub-25ms native stream cancel** via exponential pressure decay and buffer flush |
| **Harness Compatibility** | Cloud webhook / custom proprietary SDKs | **Native MCP stdio + Universal Agent Skill (`SKILL.md`)** |

---

## The Dual-Pathway Vocal Motor System

VoiceBox simulates the neuro-anatomical architecture of human vocal production:

```mermaid
flowchart TD
    subgraph Voluntary["1. Voluntary Cortical Pathway (What you SAY)"]
        Broca["Broca's Area & Laryngeal Motor Cortex"]
        Words["Surface Lexical Choice: 'I am completely fine with this decision.'"]
        Broca --> Words
    end

    subgraph Involuntary["2. Involuntary Limbic-PAG Pathway (How you SOUND)"]
        Limbic["Anterior Cingulate (ACC) & Amygdala"]
        PAG["Midbrain Periaqueductal Gray (PAG)"]
        NRA["Nucleus Retroambiguus (Caudal Medulla)"]
        Leak["Laryngeal Clamping:
        - LCA Hyper-Adduction (Rd=0.45 pressed phonation)
        - Clenched Jaw Offset (-0.25)
        - Vowel Nucleus Clipping (-25%)
        - Rigid Monotone Intonation (<1.5 st)"]
        Limbic --> PAG --> NRA --> Leak
    end

    subgraph Acoustics["3. 48 kHz Biophysical Waveguide Engine"]
        LF["Gunnar Fant Differential LF Glottal Flow Solver"]
        Inertance["Titze 1-Sample Supraglottal Inertance Feedback (Z_t)"]
        Formants["5-Pole Cascaded Vocal Tract Formant Resonators"]
        LF --> Inertance --> Formants
    end

    Words --> Acoustics
    Leak --> Acoustics
    Acoustics --> Output["Acoustic Output Stream:
    Polite words delivered with genuine, visceral passive-aggressive tension."]
```

---

## Quickstart

### 1. Installation & Platform Setup

#### macOS (Apple Silicon)
A pre-compiled native library (`lib/libchimera_wasm.dylib`) is included for Apple Silicon:
```bash
git clone https://github.com/basimrdj/voicebox-mcp.git
cd voicebox-mcp
bun install
```

#### Linux (`x86_64` / `aarch64`)
On Linux environments, compile the shared library (`libchimera_wasm.so`) from the upstream CHIMERA Rust engine:
```bash
# Clone upstream and build the C-ABI shared library
git clone https://github.com/jamesondh/chimera-vocal-synth.git reference/chimera-vocal-synth
cd reference/chimera-vocal-synth && cargo build --release -p chimera-wasm
cp target/release/libchimera_wasm.so ../../lib/
cd ../..
bun install
```
*(Alternatively, set `CHIMERA_LIB_PATH=/path/to/libchimera_wasm.so`)*

#### Synthesis Tiers & Optional Dependencies
VoiceBox employs a tiered synthesis fallback pipeline:
1. **Native Biophysical Waveguide (Primary, Local)**: Uses Bun FFI + `libchimera_wasm` for real-time 48 kHz transmission-line synthesis with zero external dependencies.
2. **Neural Subtext Conditioning (Optional)**: If running high-level neural subtext reshaping via `src/synthesis/neural_tts.py`, install Python packages: `pip install -r requirements.txt` (NumPy, SciPy, and optional MLX/PyTorch).
3. **System Fallback**: On macOS, if neural dependencies are unavailable during high-level TTS calls, the engine can fall back to the system speech synthesizer (`say`) before applying LPC formant filtering and subtext prosody reshaping.

---

### 2. Instant Audio CLI

```bash
# 1. Experience Nuanced Conversational Subtexts
bun run cli.ts speak "I am completely fine with this decision." --subtext passive_hostility --play
bun run cli.ts speak "Wait, did you really figure out what happened?" --subtext curiosity --play
bun run cli.ts speak "Oh, of course, that was an absolutely brilliant idea." --subtext sarcasm --play
bun run cli.ts speak "Let us try this whole thing one more time." --subtext exasperation --play

# 2. Trigger Involuntary Physiological Reflexes
bun run cli.ts gesture sigh --play
bun run cli.ts gesture laughter --play
bun run cli.ts gesture sob --play
bun run cli.ts gesture scream --play

# 3. Inspect Vocal Tract Anatomy & Morphometry
bun run cli.ts identity
```

---

## The 7 Conversational Subtexts

Human emotion is rarely expressed by shouting. It leaks through subtle laryngeal tension while the words remain calm:

| Subtext State | Intended Subtext | Biophysical & Acoustic Markers | Example Delivery |
| :--- | :--- | :--- | :--- |
| `passive_hostility` | Polite words, cold tension. | Pressed glottis ($R_d = 0.45$), clipped vowels (-25%), clenched jaw, rigid pitch. | *"Whatever you think is best."* |
| `curiosity` | Genuine intrigue, exploration. | High-rising boundary ($L-H\%$), elongated final vowel (+25%), expanded pitch range. | *"What does that mean for the system?"* |
| `sarcasm` | Dry irony, deadpan mockery. | Stretched tonic vowel (+45%), wide rise-fall followed by low monotone coda. | *"What could possibly go wrong?"* |
| `exasperation` | Weariness, repeating yourself. | Respiratory sigh dump ($P_s$ collapses $>50\%$), pitch trails into vocal fry. | *"Alright, let us look at the logs again."* |
| `annoyance` | Petty friction, minor irritation. | Tense vocal folds, sharp falling pitch accents ($H+L^*$), clipped coda stops. | *"We already went over this step."* |
| `anxiety` | Precarious danger, nervousness. | Synchronous 8.5 Hz neuromuscular tremor in $P_s$ and $f_0$, hurried syllables. | *"Are you sure it is going to work?"* |
| `quiet_dejection` | Subdued defeat, sorrow. | Hypokinetic parasympathetic collapse ($P_s \to P_{th}$), breathy whisper fade-out. | *"There is no point in trying anymore."* |

---

## 🤖 Universal Agent Skill Integration (`SKILL.md`)

VoiceBox is packaged with a universal Agent Skill adhering to the open [`agentskills.io`](https://agentskills.io) standard. Any AI coding agent or autonomous harness can automatically understand when, why, and how to use the voice box to its maximum potential.

### Harness Auto-Discovery Map

| Agent Harness | Discovery Path | Setup |
| :--- | :--- | :--- |
| **Antigravity / Gemini CLI** | `~/.gemini/config/skills/voicebox/` or `.agents/skills/voicebox/` | **Zero configuration.** Pre-installed in global config and workspace. |
| **Claude Code** | `.claude/skills/voicebox/` or `CLAUDE.md` | Pre-configured in repository. Loaded automatically on demand. |
| **Cursor & Windsurf** | `.agents/skills/voicebox/` or `.cursorrules` / `.windsurfrules` | Discovers the open `.agents/skills` standard in project root. |
| **Claude Desktop** | System prompt or MCP tool definitions | References the `SKILL.md` runbook for tool selection. |
| **LangChain / AutoGen / CrewAI / Smolagents** | `skills/voicebox/SKILL.md` | Ingests the `SKILL.md` specification into system prompt or tool memory. |

---

## MCP Tools Reference (16 Standard + 2 Developmental)

VoiceBox exposes **16 core biophysical tools** by default through standard `stdio` (JSON-RPC 2.0):

```json
{
  "mcpServers": {
    "voicebox": {
      "command": "bun",
      "args": ["run", "/path/to/voicebox-mcp/src/index.ts"]
    }
  }
}
```

> [!NOTE]
> **Enabling Developmental Learning Tools**: 
> Two developmental sensorimotor learning tools (`learn_articulatory_target` and `curiosity_babble` in Domain 4) are gated behind the environment variable `VOICEBOX_ENABLE_LEARNING=1`, because iterative gradient descent mutates articulatory state.

### 1. Speech & Subtext
- `speak_text`: Natural speech synthesis with `subtext`, `subtextIntensity`, `emotion`, and `intonation`.
- `speak_ipa`: Direct articulatory phonetic synthesis via International Phonetic Alphabet.
- `sing_notes`: Melodic note sequences with epilaryngeal 1:6 resonance (the Singer's Formant) and 5.8 Hz vibrato.

### 2. Reflexes & Gestures
- `perform_vocal_gesture`: Organic reflexes (`sigh`, `sob`, `cry`, `laughter`, `scream`, `gasp`, `chuckle`, `growl`, `whisper`).
- `beatbox_pattern`: Lingual and labial percussive rhythm generation (kick, snare, hi-hat, throat bass).

### 3. Anatomy & Motor Configuration
- `set_voice_identity`: Adjust anatomical vocal tract length, scale factor, and body mix.
- `get_voice_identity`: Inspect vocal tract dimensions and baseline neutral formant frequencies.
- `switch_creature`: Morph between human male, female, child, giant, and resonant forms.
- `set_glottal_source`: Real-time adjustment of $P_s, R_d, O_q$, breathiness, and tension.
- `babble_articulators`: Manual motor displacement of jaw, tongue body, tongue tip, lips, and larynx.
- `get_articulator_state`: Read current 3D positions of all 17 articulatory effectors.

### 4. Perception & DIVA Sensorimotor Learning
- `listen_to_self`: Auditory perception extracting $f_0$, formants $F_1–F_4$, HNR, RMS, and spectral centroid.
- `map_vowel_space`: Acoustic exploration of the phonetic vowel quadrilateral.
- `learn_articulatory_target` *(requires `VOICEBOX_ENABLE_LEARNING=1`)*: Closed-loop DIVA sensorimotor motor error gradient descent.
- `curiosity_babble` *(requires `VOICEBOX_ENABLE_LEARNING=1`)*: Intrinsically motivated self-supervised vocal tract exploration.

### 5. Conversational Streaming & Barge-In
- `stream_phonemic_speech`: Word-by-word streaming generation without filter transient clicks.
- `stream_articulatory_gestures`: Streaming low-latency articulatory motion paths.
- `control_voice_stream`: Manage streaming playback and sub-25ms barge-in interruption.

---

## Automated Verification & Benchmarks

VoiceBox features an automated test suite with 87,500+ assertions verifying acoustic physics, differential flow conservation, and MCP tool conformance:

```bash
bun test
```

```
tests/mcp_tools.test.ts          - 14 passed
tests/subtext_prosody.test.ts    - 25 passed
tests/emotional_prosody.test.ts  - 20 passed
tests/streaming_bargein.test.ts  -  4 passed
tests/sensorimotor_learning.test.ts - 7 passed
tests/formant_acoustics.test.ts  -  4 passed
tests/ffi_sanity.test.ts         -  6 passed

 80 pass
 0 fail
 87586 expect() calls
Ran 80 tests across 7 files. [22.88s]
```

### Benchmark Scope & Technical Notes
- **Acoustic Physics vs. MOS**: The automated test suite rigorously validates physical conservation laws (Gunnar Fant zero-integral glottal flow conservation $\int_0^{T_0} E(t) dt = 0$, Ingo Titze inertance stability), task-dynamic articulator ODE tracking, metrical phonology time-warp monotonicity, and MCP schema conformance. It does not measure subjective Mean Opinion Scores (MOS).
- **Latency Scope**: The sub-25ms conversational barge-in latency applies specifically to the **native streaming audio queue** (`control_voice_stream` cancel signal via exponential lung pressure decay and ring buffer flushing), enabling immediate interruption when a user speaks over the agent. High-level batch TTS calls routed through the Python subtext conditioning layer execute as out-of-process jobs (with a 25s timeout safety margin).

---

## License & Credits

- **VoiceBox MCP**: Licensed under the [MIT License](LICENSE). Copyright (c) 2026 Basim.
- **Upstream Engine (CHIMERA)**: The physical vocal synthesis engine builds upon [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth), Copyright (c) 2026 Jameson Hodge, used under the MIT License.
