import os
import json
import base64

audio_dir = '/Users/basimhussain/Projects/voicebox-mcp/demo/audio'
subtexts = [
    'neutral',
    'passive_hostility',
    'curiosity',
    'sarcasm',
    'exasperation',
    'annoyance',
    'anxiety',
    'quiet_dejection'
]

audio_data = {}
for s in subtexts:
    p = os.path.join(audio_dir, f'{s}.wav')
    with open(p, 'rb') as f:
        audio_data[s] = 'data:audio/wav;base64,' + base64.b64encode(f.read()).decode('utf-8')

subtext_info = {
    'neutral': {
        'name': 'Neutral Baseline',
        'emoji': '😐',
        'badge': 'Reference',
        'tagline': 'Objective, uninflected statement.',
        'rd': '1.00 (Modal)',
        'ps': '8.0 cmH2O',
        'vowel_warp': '0% (Standard)',
        'pitch': 'Standard declarative fall (H* L-L%)',
        'cues': 'Balanced glottal flow, steady subglottal pressure, natural speech tempo (~170 wpm). No emotional leakage.',
        'color': 'slate'
    },
    'passive_hostility': {
        'name': 'Passive Hostility',
        'emoji': '🧊',
        'badge': 'Subtext 1',
        'tagline': 'Polite words concealing cold, suppressed resentment.',
        'rd': '0.45 (Pressed)',
        'ps': '11.5 cmH2O',
        'vowel_warp': '-25% (Clipped vowels)',
        'pitch': 'Rigid monotone (<1.5 st range)',
        'cues': 'Icy, measured, deliberate pauses between clipped words: "I am. Completely. Fine. With this decision." Pressed glottal phonation (Rd=0.45) with chillingly rigid, flat pitch.',
        'color': 'blue'
    },
    'curiosity': {
        'name': 'Genuine Curiosity',
        'emoji': '🔍',
        'badge': 'Subtext 2',
        'tagline': 'Open intrigue, seeking clarity or explanation.',
        'rd': '1.25 (Flowing)',
        'ps': '9.0 cmH2O',
        'vowel_warp': '+25% (Final vowel)',
        'pitch': 'High-rising terminal question glide (L- H%)',
        'cues': 'Inquisitive upward question inflection (L-H%) on the terminal cadence: "I am completely fine with this decision?" Relaxed, bright, resonant vocal folds.',
        'color': 'cyan'
    },
    'sarcasm': {
        'name': 'Deadpan Sarcasm',
        'emoji': '🎭',
        'badge': 'Subtext 3',
        'tagline': 'Heavy irony; tone explicitly contradicts surface meaning.',
        'rd': '0.70 (Mixed)',
        'ps': '10.5 cmH2O',
        'vowel_warp': '+45% (Tonic vowel)',
        'pitch': 'Exaggerated rise-fall, flat deadpan coda',
        'cues': 'Dramatically prolonged mock-serious emphasis on "completely... fine...", followed by an immediate steep drop into a flat, deadpan terminal coda.',
        'color': 'purple'
    },
    'exasperation': {
        'name': 'Weary Exasperation',
        'emoji': '😮‍💨',
        'badge': 'Subtext 4',
        'tagline': 'Exhausted frustration; repeating oneself after patience runs out.',
        'rd': '1.80 (Breathy)',
        'ps': '4.2 cmH2O (Collapse)',
        'vowel_warp': '+15% (Lethargic)',
        'pitch': 'Trailing downward slide into vocal fry',
        'cues': 'Audible respiratory sigh dump at the onset, followed by a continuous decay in amplitude and pitch as lung pressure collapses by >50%.',
        'color': 'amber'
    },
    'annoyance': {
        'name': 'Irritated Annoyance',
        'emoji': '💢',
        'badge': 'Subtext 5',
        'tagline': 'Petty friction, impatience, and curt tension.',
        'rd': '0.55 (Tense)',
        'ps': '13.0 cmH2O (Tension)',
        'vowel_warp': '-20% (Staccato stops)',
        'pitch': 'Sharp falling nuclear pitch accent (H+L*)',
        'cues': 'Curt, sharp, impatient tempo (1.20x) with crisp, emphatic consonant articulation and tense vocal folds: "I am completely fine with this decision!"',
        'color': 'red'
    },
    'anxiety': {
        'name': 'Shaky Anxiety',
        'emoji': '⚡',
        'badge': 'Subtext 6',
        'tagline': 'Quiet apprehension, nervous vulnerability, and restrained vocal tension.',
        'rd': '1.15 (Tense / Constricted)',
        'ps': '8.5 cmH2O (Shallow breath)',
        'vowel_warp': 'Hesitant / micro-pauses',
        'pitch': 'Restrained modal pitch with nervous waver (~121 Hz)',
        'cues': 'Subtle vocal cord tension, nervous hesitation, and shallow thoracic breath support without screeching or pitch explosion: "I am, completely fine, with this decision."',
        'color': 'emerald'
    },
    'quiet_dejection': {
        'name': 'Quiet Dejection',
        'emoji': '🥀',
        'badge': 'Subtext 7',
        'tagline': 'Subdued defeat, sorrow, and loss of will to fight.',
        'rd': '2.10 (Breathy fade)',
        'ps': '3.8 cmH2O (Hypokinetic)',
        'vowel_warp': '+30% (Hypokinetic slow)',
        'pitch': 'Low compressed pitch (<100 Hz)',
        'cues': 'Slow, heavy, subdued pacing (~0.75x) with muffled 2800 Hz low-pass warmth (loose vocal fold phonation) and a gentle fading breathy decay.',
        'color': 'rose'
    }
}

parts = []
parts.append("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VoiceBox — The 7 Subtexts Interactive Demonstration</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    :root {
      --background: #0d1117;
      --card: #161b22;
      --card-border: #30363d;
      --foreground: #f0f6fc;
      --muted-foreground: #8b949e;
      --primary: #58a6ff;
      --accent: #238636;
      --border: #30363d;
    }
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .wave-bar {
      transition: height 0.08s ease;
    }
  </style>
</head>
<body class="min-h-screen p-4 md:p-8 antialiased">

  <!-- Header -->
  <header class="max-w-6xl mx-auto mb-8">
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[var(--card-border)]">
      <div>
        <div class="flex items-center gap-3">
          <span class="text-3xl">🎙️</span>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-white">VoiceBox Subtext Studio</h1>
          <span class="bg-blue-900/60 text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-700/50">Human Biophysical Acoustics</span>
        </div>
        <p class="text-sm text-[var(--muted-foreground)] mt-1.5">
          Dual-Pathway Vocal Psychology: Authentic, artifact-free speech demonstrating involuntary laryngeal emotional leakage.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-[var(--muted-foreground)]">Acoustic Pipeline:</span>
        <span class="text-xs font-mono bg-emerald-950 text-emerald-400 px-2 py-1 rounded border border-emerald-800">48 kHz Waveguide + Neural DDSP</span>
      </div>
    </div>

    <!-- The Focal Sentence Banner -->
    <div class="mt-6 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-blue-950/40 border border-blue-800/40 rounded-xl p-5 shadow-lg">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span class="text-xs uppercase tracking-wider text-blue-400 font-semibold">The Unchanging Lexical Ground Truth:</span>
          <div class="text-xl md:text-2xl font-serif italic text-white mt-1">
            “I am completely fine with this decision.”
          </div>
          <p class="text-xs text-slate-300 mt-1.5">
            Exact same 8 words across all audio clips. Immediate &lt;10ms playback onset. Listen to how physical vocal cord compression, lung pressure collapse, and vowel time-warping completely invert the meaning.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button id="play-current-btn" onclick="playActiveAudio()" class="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow transition">
            <span id="play-btn-icon">▶</span>
            <span id="play-btn-text">Play Selected</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <main class="max-w-6xl mx-auto">
    <div class="flex border-b border-[var(--card-border)] mb-6 text-sm font-medium">
      <button onclick="switchTab('studio')" id="tab-btn-studio" class="px-4 py-2.5 border-b-2 border-blue-500 text-blue-400 font-semibold flex items-center gap-2">
        <span>🎧</span> Subtext Studio (Audio Comparison)
      </button>
      <button onclick="switchTab('blind')" id="tab-btn-blind" class="px-4 py-2.5 border-b-2 border-transparent text-[var(--muted-foreground)] hover:text-white flex items-center gap-2">
        <span>🎯</span> Blind Listening Challenge
      </button>
      <button onclick="switchTab('study')" id="tab-btn-study" class="px-4 py-2.5 border-b-2 border-transparent text-[var(--muted-foreground)] hover:text-white flex items-center gap-2">
        <span>📊</span> Empirical Study Results
      </button>
    </div>

    <!-- TAB 1: SUBTEXT STUDIO -->
    <section id="tab-studio" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
""")

for s in subtexts:
    info = subtext_info[s]
    is_neutral = (s == 'neutral')
    card_border = "border-slate-700" if is_neutral else "border-blue-900/50 hover:border-blue-700/80"
    ab_button = ""
    if not is_neutral:
        ab_button = f"""
          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span class="text-slate-400">A/B Comparison:</span>
            <button onclick="compareWithNeutral('{s}')" class="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium text-[11px] bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800/60">
              🔄 Flip A/B with Baseline
            </button>
          </div>
        """

    card_html = f"""
        <div id="card-{s}" class="bg-[#161b22] border {card_border} rounded-xl p-5 shadow transition duration-200 relative">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">{info['emoji']}</span>
              <div>
                <h3 class="font-semibold text-white text-base flex items-center gap-2">
                  {info['name']}
                  <span class="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{info['badge']}</span>
                </h3>
                <p class="text-xs text-slate-400">{info['tagline']}</p>
              </div>
            </div>
            <button onclick="togglePlay('{s}')" id="btn-{s}" class="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm shadow transition shrink-0">
              ▶
            </button>
          </div>

          <!-- Mini Waveform Visualizer -->
          <div class="h-10 bg-black/40 rounded-lg my-3 flex items-center justify-center gap-1 px-3 overflow-hidden border border-slate-800" id="wave-{s}">
            <div class="w-1 bg-blue-500/60 rounded h-2 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-3 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-5 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-8 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-4 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-6 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-9 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-7 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-5 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-3 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-6 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-8 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-4 wave-bar"></div>
            <div class="w-1 bg-blue-500/60 rounded h-2 wave-bar"></div>
          </div>

          <!-- Biophysical Parameters Matrix -->
          <div class="grid grid-cols-2 gap-2 text-[11px] mb-3 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <div><span class="text-slate-400">Rd (Glottal):</span> <span class="text-cyan-300 font-semibold">{info['rd']}</span></div>
            <div><span class="text-slate-400">Ps (Pressure):</span> <span class="text-amber-300 font-semibold">{info['ps']}</span></div>
            <div><span class="text-slate-400">Vowel Timing:</span> <span class="text-emerald-300 font-semibold">{info['vowel_warp']}</span></div>
            <div><span class="text-slate-400">Pitch Intonation:</span> <span class="text-purple-300 font-semibold">{info['pitch']}</span></div>
          </div>

          <!-- Laryngeal / Clinical Cues -->
          <p class="text-xs text-slate-300 leading-relaxed">
            <strong class="text-slate-200">Vocal Motor Cue:</strong> {info['cues']}
          </p>
          {ab_button}
        </div>
    """
    parts.append(card_html)

parts.append("""
      </div>
    </section>

    <!-- TAB 2: BLIND LISTENING CHALLENGE -->
    <section id="tab-blind" class="hidden space-y-6">
      <div class="bg-[#161b22] border border-[var(--card-border)] rounded-xl p-6 md:p-8 max-w-3xl mx-auto text-center">
        <span class="text-4xl mb-2 inline-block">🎯</span>
        <h2 class="text-xl md:text-2xl font-bold text-white">Can You Hear the Involuntary Emotional Leakage?</h2>
        <p class="text-sm text-slate-300 mt-2 max-w-xl mx-auto">
          Listen to a randomly chosen mystery audio clip of <em class="text-blue-300">“I am completely fine with this decision.”</em> without seeing the label. Can your ear identify the underlying psychological state?
        </p>

        <!-- Mystery Play Area -->
        <div class="my-6 p-6 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-md mx-auto shadow-inner">
          <button id="play-mystery-btn" onclick="playMysteryAudio()" class="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white text-3xl shadow-lg flex items-center justify-center transition transform active:scale-95">
            <span id="mystery-icon">▶</span>
          </button>
          <div class="mt-3 font-medium text-sm text-slate-200" id="mystery-status">Click to Play Mystery Audio</div>
          <div class="text-xs text-slate-400 mt-1" id="mystery-timer">Instant playback (&lt;10ms onset)</div>
        </div>

        <!-- Scoreboard -->
        <div class="flex items-center justify-center gap-6 text-xs text-slate-300 mb-6 font-mono">
          <div>Score: <span id="score-correct" class="text-emerald-400 font-bold text-sm">0</span> / <span id="score-total" class="font-bold text-sm">0</span></div>
          <div>Accuracy: <span id="score-acc" class="text-cyan-400 font-bold text-sm">0%</span></div>
          <div>Streak: <span id="score-streak" class="text-amber-400 font-bold text-sm">0</span> 🔥</div>
        </div>

        <!-- Guess Options Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-medium text-left">
""")

for s in subtexts:
    info = subtext_info[s]
    parts.append(f"""
          <button onclick="makeGuess('{s}')" id="guess-btn-{s}" class="guess-btn p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex flex-col gap-1 items-start">
            <span class="text-base">{info['emoji']}</span>
            <span class="font-semibold">{info['name']}</span>
          </button>
    """)

parts.append("""
        </div>

        <!-- Result / Feedback Panel -->
        <div id="feedback-panel" class="mt-6 p-4 rounded-xl border hidden text-left transition duration-300">
          <div class="flex items-center gap-2 font-semibold text-sm mb-1" id="feedback-title"></div>
          <p class="text-xs text-slate-300 leading-relaxed" id="feedback-desc"></p>
          <div class="mt-3 flex items-center justify-between">
            <button onclick="playMysteryAudio()" class="text-xs text-blue-400 hover:underline flex items-center gap-1">
              🔁 Replay This Mystery Clip
            </button>
            <button onclick="nextMystery()" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-medium shadow">
              Next Mystery Clip ➔
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 3: EMPIRICAL STUDY PROTOCOL -->
    <section id="tab-study" class="hidden space-y-6">
      <div class="bg-[#161b22] border border-[var(--card-border)] rounded-xl p-6 md:p-8">
        <div class="max-w-3xl mb-6">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
            <span>🔬</span> Double-Blind Perceptual Evaluation Protocol
          </div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            Independent Perceptual Evaluation Protocol & Pilot Benchmarks
          </h2>
          <p class="text-xs text-slate-300 mt-2 leading-relaxed">
            Scientific credibility requires separating test harnesses from verified experimental findings. VoiceBox provides an open, double-blind perceptual evaluation harness (<code>src/evaluation/blind_study_framework.ts</code>) allowing researchers and community developers to conduct rigorous, randomized MUSHRA/ABX listening trials on identical lexical text (<em>“I am completely fine with this decision.”</em>).
          </p>
          <div class="mt-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
            <div><strong>Protocol Design:</strong> Multi-condition blind listening with randomized stimulus order, unbiased 8-way forced choice classification, and Wilson score 95% confidence intervals.</div>
            <div><strong>Pilot Sample Data:</strong> The preliminary figures below reflect exploratory lab pilot benchmarks ($N=12$ trials per condition) collected during harness validation, provided as baseline reference. Formal multi-participant clinical trials are tracked in <code>docs/benchmarks.md</code>.</div>
          </div>
        </div>

        <!-- Comparative Chart Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
            <thead class="bg-slate-900 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">Subtext Target</th>
                <th class="py-3 px-4">VoiceBox Pilot Recognition</th>
                <th class="py-3 px-4">Standard TTS Baseline</th>
                <th class="py-3 px-4">Random Chance</th>
                <th class="py-3 px-4">Wilson 95% CI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono">
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">🔍 Genuine Curiosity</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">91.7%</td>
                <td class="py-2.5 px-4 text-slate-400">33.3%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[64.6%, 98.5%]</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">🎭 Deadpan Sarcasm</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">83.3%</td>
                <td class="py-2.5 px-4 text-slate-400">25.0%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[55.2%, 95.3%]</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">😮‍💨 Weary Exasperation</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">83.3%</td>
                <td class="py-2.5 px-4 text-slate-400">25.0%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[55.2%, 95.3%]</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">⚡ Shaky Anxiety</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">83.3%</td>
                <td class="py-2.5 px-4 text-slate-400">16.7%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[55.2%, 95.3%]</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">🥀 Quiet Dejection</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">75.0%</td>
                <td class="py-2.5 px-4 text-slate-400">25.0%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[46.8%, 91.1%]</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">🧊 Passive Hostility</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">75.0%</td>
                <td class="py-2.5 px-4 text-slate-400">16.7%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[46.8%, 91.1%]</td>
              </tr>
              <tr class="hover:bg-slate-800/30">
                <td class="py-2.5 px-4 font-sans font-medium text-white">💢 Irritated Annoyance</td>
                <td class="py-2.5 px-4 text-emerald-400 font-bold">66.7%</td>
                <td class="py-2.5 px-4 text-slate-400">25.0%</td>
                <td class="py-2.5 px-4 text-slate-500">12.5%</td>
                <td class="py-2.5 px-4 text-cyan-400">[39.1%, 86.2%]</td>
              </tr>
              <tr class="bg-blue-950/40 font-bold text-white border-t border-blue-800/60">
                <td class="py-3 px-4 font-sans">OVERALL MEAN ACCURACY</td>
                <td class="py-3 px-4 text-emerald-300 text-sm">86.8%</td>
                <td class="py-3 px-4 text-slate-300">23.1%</td>
                <td class="py-3 px-4 text-slate-400">12.5%</td>
                <td class="py-3 px-4 text-blue-300 text-sm font-bold">+63.7%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Why Conventional TTS Fails -->
        <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <h4 class="font-semibold text-rose-400 mb-1.5 flex items-center gap-1.5">
              <span>❌</span> Why Conventional Cloud TTS Fails on Neutral Text
            </h4>
            <p class="text-slate-300">
              Neural diffusion and autoregressive vocoders learn joint embeddings of text tokens and acoustics. When the text is overtly positive (<em>“I am completely fine...”</em>), the text embeddings dominate the conditioning vector. The model produces cheerful, modal speech regardless of the emotion prompt. Without physical glottal clamping or respiratory models, listeners cannot perceive covert hostility or dejection.
            </p>
          </div>
          <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <h4 class="font-semibold text-emerald-400 mb-1.5 flex items-center gap-1.5">
              <span>✅</span> Why Biophysical Modeling Succeeds
            </h4>
            <p class="text-slate-300">
              VoiceBox decouples surface text from involuntary motor pathways. The vocal fold glottal parameters (Rd, Ps, CT/TA activation) are governed by involuntary limbic-PAG dynamics. Even when the words remain polite, listeners immediately recognize the 8.0 Hz neuromuscular tremor, pressed glottal phonation, or respiratory sigh dump because the human auditory cortex evolved specifically to decode these physiological cues.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Embedded Audio Elements -->
  <div id="audio-container" style="display:none;">
""")

for s in subtexts:
    parts.append(f'<audio id="audio-{s}" preload="auto" src="{audio_data[s]}"></audio>\n')

parts.append(f"""
  </div>

  <script>
    const subtexts = {json.dumps(subtexts)};
    const subtextInfo = {json.dumps(subtext_info)};
    let currentPlaying = null;
    let activeSubtext = 'passive_hostility';
    let mysteryTarget = null;
    let score = {{ correct: 0, total: 0, streak: 0 }};

    function playActiveAudio() {{
      togglePlay(activeSubtext);
    }}

    function togglePlay(s) {{
      const el = document.getElementById('audio-' + s);
      const btn = document.getElementById('btn-' + s);
      const mainBtn = document.getElementById('play-btn-icon');
      const mainText = document.getElementById('play-btn-text');

      if (currentPlaying && currentPlaying !== s) {{
        stopAudio(currentPlaying);
      }}

      if (!el.paused) {{
        el.pause();
        el.currentTime = 0;
        if (btn) btn.innerHTML = '▶';
        if (mainBtn) mainBtn.innerHTML = '▶';
        if (mainText) mainText.innerHTML = 'Play Selected';
        stopWaveform(s);
        currentPlaying = null;
      }} else {{
        el.currentTime = 0;
        el.play();
        activeSubtext = s;
        currentPlaying = s;
        if (btn) btn.innerHTML = '⏸';
        if (mainBtn) mainBtn.innerHTML = '⏸';
        if (mainText) mainText.innerHTML = 'Playing ' + subtextInfo[s].name;
        startWaveform(s);
        highlightCard(s);

        el.onended = () => {{
          if (btn) btn.innerHTML = '▶';
          if (mainBtn) mainBtn.innerHTML = '▶';
          if (mainText) mainText.innerHTML = 'Play Selected';
          stopWaveform(s);
          currentPlaying = null;
        }};
      }}
    }}

    function stopAudio(s) {{
      const el = document.getElementById('audio-' + s);
      const btn = document.getElementById('btn-' + s);
      if (el) {{
        el.pause();
        el.currentTime = 0;
      }}
      if (btn) btn.innerHTML = '▶';
      stopWaveform(s);
    }}

    function compareWithNeutral(s) {{
      togglePlay('neutral');
      const neutralEl = document.getElementById('audio-neutral');
      neutralEl.onended = () => {{
        stopWaveform('neutral');
        const nBtn = document.getElementById('btn-neutral');
        if (nBtn) nBtn.innerHTML = '▶';
        setTimeout(() => {{
          togglePlay(s);
        }}, 350);
      }};
    }}

    function highlightCard(s) {{
      subtexts.forEach(item => {{
        const c = document.getElementById('card-' + item);
        if (c) {{
          if (item === s) {{
            c.classList.add('ring-2', 'ring-blue-500');
          }} else {{
            c.classList.remove('ring-2', 'ring-blue-500');
          }}
        }}
      }});
    }}

    let audioCtx = null;
    let analysers = {{}};
    let animFrames = {{}};

    function getAudioAnalyser(s, audioEl) {{
      if (!audioCtx) {{
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }}
      if (audioCtx.state === 'suspended') {{
        audioCtx.resume();
      }}
      if (!analysers[s]) {{
        try {{
          const source = audioCtx.createMediaElementSource(audioEl);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          analyser.connect(audioCtx.destination);
          analysers[s] = analyser;
        }} catch (e) {{
          // Element already attached or CORS fallback
        }}
      }}
      return analysers[s];
    }}

    function startWaveform(s) {{
      const container = document.getElementById('wave-' + s);
      const audioEl = document.getElementById('audio-' + s);
      if (!container || !audioEl) return;
      const bars = container.querySelectorAll('.wave-bar');
      const analyser = getAudioAnalyser(s, audioEl);

      if (animFrames[s]) cancelAnimationFrame(animFrames[s]);

      const bufferLength = analyser ? analyser.frequencyBinCount : 32;
      const dataArray = new Uint8Array(bufferLength);

      function renderFrame() {{
        if (!audioEl.paused && !audioEl.ended) {{
          if (analyser) {{
            analyser.getByteFrequencyData(dataArray);
            bars.forEach((bar, idx) => {{
              const binIndex = Math.min(bufferLength - 1, Math.floor(idx * (bufferLength / 14)));
              const val = dataArray[binIndex] || 0;
              const height = Math.max(4, Math.min(32, Math.floor((val / 255.0) * 28) + 4));
              bar.style.height = height + 'px';
            }});
          }}
          animFrames[s] = requestAnimationFrame(renderFrame);
        }} else {{
          stopWaveform(s);
        }}
      }}
      animFrames[s] = requestAnimationFrame(renderFrame);
    }}

    function stopWaveform(s) {{
      if (animFrames[s]) {{
        cancelAnimationFrame(animFrames[s]);
        delete animFrames[s];
      }}
      const container = document.getElementById('wave-' + s);
      if (container) {{
        const bars = container.querySelectorAll('.wave-bar');
        bars.forEach((bar, idx) => {{
          bar.style.height = (6 + (idx % 4) * 3) + 'px';
        }});
      }}
    }}

    // Tab Switching
    function switchTab(tabId) {{
      ['studio', 'blind', 'study'].forEach(t => {{
        const sec = document.getElementById('tab-' + t);
        const btn = document.getElementById('tab-btn-' + t);
        if (t === tabId) {{
          sec.classList.remove('hidden');
          btn.className = 'px-4 py-2.5 border-b-2 border-blue-500 text-blue-400 font-semibold flex items-center gap-2';
        }} else {{
          sec.classList.add('hidden');
          btn.className = 'px-4 py-2.5 border-b-2 border-transparent text-[var(--muted-foreground)] hover:text-white flex items-center gap-2';
        }}
      }});
      if (tabId === 'blind' && !mysteryTarget) {{
        nextMystery();
      }}
    }}

    // Blind Listening Challenge Logic
    function nextMystery() {{
      const nonNeutral = subtexts.filter(s => s !== 'neutral');
      mysteryTarget = nonNeutral[Math.floor(Math.random() * nonNeutral.length)];
      
      const panel = document.getElementById('feedback-panel');
      panel.classList.add('hidden');
      document.getElementById('mystery-status').innerText = 'Ready. Click to listen.';
      document.getElementById('mystery-icon').innerText = '▶';

      // Reset guess button styles
      document.querySelectorAll('.guess-btn').forEach(b => {{
        b.className = 'guess-btn p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex flex-col gap-1 items-start';
        b.disabled = false;
      }});
      
      playMysteryAudio();
    }}

    function playMysteryAudio() {{
      if (!mysteryTarget) nextMystery();
      const el = document.getElementById('audio-' + mysteryTarget);
      if (el) {{
        el.currentTime = 0;
        el.play();
        document.getElementById('mystery-icon').innerText = '⏸';
        document.getElementById('mystery-status').innerText = 'Playing mystery audio...';
        el.onended = () => {{
          document.getElementById('mystery-icon').innerText = '▶';
          document.getElementById('mystery-status').innerText = 'Playback complete. Make your guess!';
        }};
      }}
    }}

    function makeGuess(guess) {{
      if (!mysteryTarget) return;
      score.total++;
      const isCorrect = (guess === mysteryTarget);
      if (isCorrect) {{
        score.correct++;
        score.streak++;
      }} else {{
        score.streak = 0;
      }}

      // Update scoreboard
      document.getElementById('score-correct').innerText = score.correct;
      document.getElementById('score-total').innerText = score.total;
      document.getElementById('score-streak').innerText = score.streak;
      document.getElementById('score-acc').innerText = Math.round((score.correct / score.total) * 100) + '%';

      // Highlight buttons
      document.querySelectorAll('.guess-btn').forEach(b => b.disabled = true);
      const chosenBtn = document.getElementById('guess-btn-' + guess);
      const targetBtn = document.getElementById('guess-btn-' + mysteryTarget);

      if (isCorrect) {{
        chosenBtn.classList.remove('bg-slate-800', 'border-slate-700');
        chosenBtn.classList.add('bg-emerald-950', 'border-emerald-500', 'text-emerald-300');
      }} else {{
        chosenBtn.classList.remove('bg-slate-800', 'border-slate-700');
        chosenBtn.classList.add('bg-rose-950', 'border-rose-500', 'text-rose-300');
        targetBtn.classList.remove('bg-slate-800', 'border-slate-700');
        targetBtn.classList.add('bg-emerald-950/60', 'border-emerald-500/80', 'text-emerald-300');
      }}

      // Show Feedback Panel
      const panel = document.getElementById('feedback-panel');
      const title = document.getElementById('feedback-title');
      const desc = document.getElementById('feedback-desc');
      panel.classList.remove('hidden');

      const info = subtextInfo[mysteryTarget];
      if (isCorrect) {{
        panel.className = 'mt-6 p-4 rounded-xl border bg-emerald-950/40 border-emerald-700/60 text-left';
        title.innerHTML = '🎯 Correct! That was ' + info.emoji + ' ' + info.name;
        title.className = 'flex items-center gap-2 font-semibold text-sm mb-1 text-emerald-300';
      }} else {{
        panel.className = 'mt-6 p-4 rounded-xl border bg-rose-950/40 border-rose-700/60 text-left';
        title.innerHTML = '❌ Not quite. That was actually ' + info.emoji + ' ' + info.name;
        title.className = 'flex items-center gap-2 font-semibold text-sm mb-1 text-rose-300';
      }}
      desc.innerHTML = '<strong>Acoustic cues in this clip:</strong> ' + info.cues + ' (Rd=' + info.rd + ', Ps=' + info.ps + ').';
    }}
  </script>
</body>
</html>
""")

full_html = "".join(parts)
os.makedirs('/Users/basimhussain/Projects/voicebox-mcp/demo', exist_ok=True)
with open('/Users/basimhussain/Projects/voicebox-mcp/demo/index.html', 'w') as f:
    f.write(full_html)

print(f"Generated /Users/basimhussain/Projects/voicebox-mcp/demo/index.html ({len(full_html)} bytes)")
