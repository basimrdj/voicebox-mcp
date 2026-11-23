# Agensi Marketplace Listing: VoiceBox

Use this document to submit or publish **VoiceBox** on [Agensi.io](https://agensi.io).

---

## 1. Basic Metadata

- **Skill Name**: `voicebox` (Display Name: **VoiceBox: Biophysical Vocal Tract & Subtext**)
- **Version**: `2.0.0`
- **Category**: `Audio & Speech` / `Embodied AI` / `Agent Tools`
- **Pricing**: `Free ($0)` *(Recommended for maximum developer adoption & GitHub stars)*
- **GitHub Repository**: [https://github.com/basimrdj/voicebox-mcp](https://github.com/basimrdj/voicebox-mcp)
- **Author**: Basim (`@basimrdj`)
- **Upstream Engine**: Built upon the open-source [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) vocal synthesizer by Jameson Hodge (MIT)
- **License**: MIT

---

## 2. Short Tagline (Max 120 Characters)

> *"A physical 48 kHz human vocal tract for AI agents, featuring involuntary emotional leakage, sighs, laughter, and singing."*

---

## 3. High-Impact Pitch (For Marketplace Header)

Most AI text-to-speech engines sound like a polite robot reading a spreadsheet. 

**VoiceBox gives your AI an actual physical human throat, lungs, and vocal cords.**

Instead of applying a cartoonish global pitch filter, VoiceBox simulates the **human dual-pathway motor system**: your agent can speak polite, diplomatic words while its vocal folds involuntarily clamp down with pressed phonation ($R_d = 0.45$) and a clenched jaw. Because that is how real humans actually talk.

---

## 4. Key Features & Capabilities

- 🎭 **7 Nuanced Conversational Subtexts**:
  - `passive_hostility`: Polite surface words with pressed glottal tension and clipped vowels.
  - `curiosity`: High-rising boundary tones ($L-H\%$) and elongated final vowels.
  - `sarcasm`: Disproportionately stretched tonic syllables with deadpan codas.
  - `exasperation`: Involuntary respiratory sigh dumps and pitch decay into vocal fry.
  - `annoyance`: Sharp falling nuclear pitch accents and tense pharyngeal posture.
  - `anxiety`: Phase-locked 8.5 Hz neuromuscular tremors in lung pressure and pitch.
  - `quiet_dejection`: Parasympathetic collapse, low acoustic power, and breathy whisper fade-out.

- 🫁 **Physiological Non-Verbal Reflexes**:
  - 3-phase PreBötzinger relief sighs.
  - 5 Hz staccato laughter bursts.
  - 4 Hz spasmodic sobbing and gasps.
  - 30–150 Hz Amygdalar alarm screams.

- 🎶 **Singing & Beatboxing**:
  - Johan Sundberg's 1:6 epilaryngeal area ratio to produce the *Singer's Formant* (2.8–3.2 kHz).
  - 5.8 Hz neuromuscular CT/TA vibrato loop ($\pm 50\text{ cents}$).
  - Lingual and labial percussive beatbox patterns.

- 🧠 **Closed-Loop DIVA Sensorimotor Learning**:
  - Frank Guenther's DIVA neural model for auditory biofeedback and autonomous vowel babbling.

- ⚡ **Zero Cloud Dependencies**:
  - Runs completely locally at 48,000 Hz via high-performance C-ABI waveguide and Apple Silicon MLX.
  - Zero API accounts or third-party token balances required.

- 🛑 **Sub-25ms Conversational Barge-In**:
  - Supports live word-by-word streaming with instant interrupt handling when the user speaks over the agent.

---

## 5. Harness Compatibility

VoiceBox adheres to the open `agentskills.io` specification:
- **Claude Code**: Auto-discovers via `.claude/skills/voicebox/SKILL.md`
- **Cursor & Windsurf**: Discovers via `.agents/skills/voicebox/SKILL.md`
- **Antigravity / Gemini CLI**: Discovers via `.gemini/config/skills/voicebox/SKILL.md`
- **Any MCP Client**: Stdio JSON-RPC connection via `bun run src/index.ts`

---

## 6. Sample Agent Prompts to Showcase

1. *"Speak this apology to the user, but leak quiet exasperation into your vocal tone."*
2. *"Take a deep relief sigh, then tell me that the build finally passed."*
3. *"Sing a 3-note ascending arpeggio with the singer's formant and vibrato."*
4. *"Say 'I'm completely fine with your decision' with heavy passive-aggressive tension."*
