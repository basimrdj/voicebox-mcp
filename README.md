# VoiceBox 🎙️

> **The Biophysical Vocal Tract & Subtextual Prosody Engine for AI Agents**  
> Giving autonomous agents a physical human throat, lungs, and vocal cords running biophysical acoustics at 48 kHz.

---

## What is VoiceBox?

Most AI speech systems treat voice like a text translation task: you send words, and a neural vocoder reads them with a polite, uniform cadence.

**VoiceBox is different.** It is an embodied acoustic simulation of human anatomy:
- **17 Articulators & 12 Glottal Parameters**: Controls tongue height, jaw angle, lip aperture, hyoid position, velum port, and vocal fold tension.
- **The Dual-Pathway Motor System**: Decouples surface dictionary words from involuntary emotional leakage. Your agent can say *"I am completely fine with this decision"* while its vocal folds involuntarily clamp down with pressed phonation ($R_d = 0.45$) and a clenched jaw.
- **Physiological Reflexes**: Generates non-verbal human reactions like 3-phase sighs, 5 Hz staccato laughter bursts, spasmodic sobbing, gasps, and Amygdalar alarm screams.
- **Singing & Epilaryngeal Resonance**: Implements Johan Sundberg's 1:6 epilaryngeal area ratio to produce the *Singer's Formant* (clustering $F_3-F_5$ near 2.8–3.2 kHz) with 5.8 Hz neuromuscular vibrato.
- **Model Context Protocol (MCP)**: Native stdio JSON-RPC server exposing 18 biophysical tools to any MCP-compliant AI harness.

---

## Quickstart

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/basimrdj/voicebox-mcp.git
cd voicebox-mcp

# Install dependencies (requires Bun runtime)
bun install
```

### 2. Try It Out (CLI)

```bash
# 1. Nuanced Conversational Subtexts
bun run cli.ts speak "I am completely fine with this decision." --subtext passive_hostility --play
bun run cli.ts speak "Wait, did you really figure out what happened?" --subtext curiosity --play
bun run cli.ts speak "Oh, of course, that was an absolutely brilliant idea." --subtext sarcasm --play
bun run cli.ts speak "Let us try this whole thing one more time." --subtext exasperation --play

# 2. Physiological Non-Verbal Reflexes
bun run cli.ts gesture sigh --play
bun run cli.ts gesture laughter --play
bun run cli.ts gesture sob --play
bun run cli.ts gesture scream --play

# 3. View Your Current Vocal Anatomy
bun run cli.ts identity
```

---

## The 7 Conversational Subtexts

Human emotion is rarely expressed by screaming every word. It leaks through subtle laryngeal tension while the words remain calm:

| Subtext State | Intended Vibe | Acoustic Signature | Example Delivery |
| :--- | :--- | :--- | :--- |
| `passive_hostility` | Polite surface, underlying cold fury. | Pressed glottis ($R_d = 0.45$), clipped vowels (-25%), clenched jaw, rigid pitch. | *"Whatever you think is best."* |
| `curiosity` | Genuine intrigue, explorative interest. | High-rising boundary ($L-H\%$), elongated final vowel (+25%), expanded pitch range. | *"What does that mean for the system?"* |
| `sarcasm` | Dry irony and deadpan mockery. | Stretched tonic vowel (+45%), wide rise-fall followed by low monotone coda. | *"What could possibly go wrong?"* |
| `exasperation` | Weariness, repeating yourself. | Respiratory sigh dump ($P_s$ collapses $>50\%$), pitch trails into vocal fry. | *"Alright, let us look at the logs again."* |
| `annoyance` | Friction, minor irritation. | Tense vocal folds, sharp falling pitch accents ($H+L^*$), clipped coda stops. | *"We already went over this step."* |
| `anxiety` | Precarious danger, nervous tension. | Synchronous 8.5 Hz neuromuscular tremor in $P_s$ and $f_0$, hurried syllables. | *"Are you sure it is going to work?"* |
| `quiet_dejection` | Subdued defeat, sorrowful acceptance. | Hypokinetic parasympathetic collapse ($P_s \to P_{th}$), breathy whisper fade-out. | *"There is no point in trying anymore."* |

---

## 🤖 Universal Agent Skill Integration (`SKILL.md`)

VoiceBox is packaged with a universal Agent Skill adhering to the open [`agentskills.io`](https://agentskills.io) standard. This allows any AI coding agent or autonomous harness to automatically understand when, why, and how to use the voice box to its maximum potential.

The skill is pre-packaged in multiple standard directories for zero-config discovery:
- `skills/voicebox/SKILL.md` (Standard skills root)
- `.agents/skills/voicebox/SKILL.md` (Universal agent discovery)
- `.claude/skills/voicebox/SKILL.md` (Claude Code discovery)

### Universal Harness Compatibility

| Agent Harness | Auto-Discovery Path | Setup Instructions |
| :--- | :--- | :--- |
| **Antigravity / Gemini CLI** | `~/.gemini/config/skills/voicebox/` or `.agents/skills/voicebox/` | Pre-installed! Automatically discovers `SKILL.md` in workspace or global config. |
| **Claude Code** | `.claude/skills/voicebox/` or `skills/voicebox/` | Pre-configured. Automatically loaded when the user asks for vocalization or emotion. |
| **Cursor & Windsurf** | `.agents/skills/voicebox/` or `.cursorrules` / `.windsurfrules` | Drop `skills/voicebox/SKILL.md` into your rules or include it in agent context. |
| **Claude Desktop** | System Prompt or MCP Tool definition | Reference `skills/voicebox/SKILL.md` as your agent's voice operational guide. |
| **Custom Agent Frameworks** (LangChain, AutoGen, CrewAI, Smolagents) | `skills/voicebox/SKILL.md` | Ingest `SKILL.md` into the agent's system prompt or tool memory. |

### Installing Globally on Your Machine

To make VoiceBox available to your agents globally across all projects on your system:

```bash
# Antigravity / Gemini CLI
mkdir -p ~/.gemini/config/skills/voicebox
cp -r skills/voicebox/* ~/.gemini/config/skills/voicebox/

# Claude Code
mkdir -p ~/.claude/skills/voicebox
cp -r skills/voicebox/* ~/.claude/skills/voicebox/

# Open Agent Skills directory
mkdir -p ~/.agents/skills/voicebox
cp -r skills/voicebox/* ~/.agents/skills/voicebox/
```

---

## MCP Integration (Claude Desktop, Cursor, Antigravity)

Add VoiceBox to your MCP configuration file:

```json
{
  "mcpServers": {
    "voicebox": {
      "command": "bun",
      "args": [
        "run",
        "/absolute/path/to/voicebox-mcp/src/index.ts"
      ]
    }
  }
}
```

Once loaded, your agent gains access to 18 native biophysical tools:
- `speak_text`: Synthesize speech with subtext, emotion, intonation, and rate.
- `speak_ipa`: Direct articulatory phonetic synthesis via International Phonetic Alphabet.
- `sing_notes`: Melodic note sequences with epilaryngeal 1:6 resonance and vibrato.
- `perform_vocal_gesture`: Organic reflexes (`sigh`, `sob`, `cry`, `laughter`, `scream`, `gasp`, etc.).
- `beatbox_pattern`: Lingual and labial percussive rhythm generation.
- `set_voice_identity`: Adjust anatomical length, scale, and species morphology.
- `get_voice_identity`: Inspect vocal tract dimensions and formant baselines.
- `switch_creature`: Morph between human male, female, child, giant, and resonant forms.
- `set_glottal_source`: Real-time adjustment of $P_s, R_d, O_q$, breathiness, and tension.
- `babble_articulators`: Manual motor displacement of jaw, tongue body, tongue tip, and lips.
- `get_articulator_state`: Read current positions of all 17 articulatory effectors.
- `listen_to_self`: Auditory perception extracting $f_0$, formants $F_1–F_4$, HNR, and RMS.
- `map_vowel_space`: Acoustic exploration of the vowel quadrilateral.
- `learn_articulatory_target`: Closed-loop DIVA sensorimotor motor error gradient descent.
- `curiosity_babble`: Intrinsically motivated self-supervised motor babbling.
- `stream_phonemic_speech`: Real-time word-by-word streaming generation.
- `stream_articulatory_gestures`: Streaming low-latency articulatory motion paths.
- `control_voice_stream`: Manage streaming playback and sub-25ms barge-in interruption.

---

## Biophysical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Voluntary Cortical Pathway                      │
│        (Lexical Selection, Syntax, Semantic Message)             │
│                 "I am completely fine."                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Involuntary Limbic-PAG Pathway                  │
│       (ACC -> Midbrain PAG -> Medullary Nucleus Retroambiguus)   │
│       - LCA Hyper-Adduction (Pressed Glottal Waveform Rd=0.45)   │
│       - Clenched Jaw Offset (-0.25)                             │
│       - Piecewise Vowel Nucleus Clipping (-25%)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│          Interactive Acoustic Waveguide Engine (48 kHz)         │
│       - Gunnar Fant Zero-Integral Differential LF Model         │
│       - Titze 1-Sample Supraglottal Inertance Coupling (Z_t)     │
│       - 5-Pole Cascaded Vocal Tract Formant Biquads             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Automated Verification

VoiceBox features a comprehensive automated test suite with 87,500+ assertions verifying acoustic physics, differential flow conservation, and MCP tool conformance:

```bash
bun test
```

```
 80 pass
 0 fail
 87586 expect() calls
Ran 80 tests across 7 files. [22.88s]
```

---

## License

MIT License. Designed and authored by basimrdj.
