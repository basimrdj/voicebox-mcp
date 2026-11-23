#!/usr/bin/env python3
"""
Generates high-definition, studio-quality animated visualizer MP4 videos
for the 7 Conversational Subtexts benchmark:
"I am completely fine with this decision."
"""

import os
import sys
import subprocess
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

AUDIO_DIR = "/Users/basimhussain/Projects/voicebox-mcp/demo/audio"
VIDEO_DIR = "/Users/basimhussain/Projects/voicebox-mcp/demo/video"
os.makedirs(VIDEO_DIR, exist_ok=True)

SUBTEXT_CONFIG = [
    {
        "id": "neutral",
        "name": "NEUTRAL BASELINE",
        "emoji": "😐",
        "badge": "Rd=1.00 Modal | Ps=8.0 cmH2O | Fall (H* L-L%)",
        "tagline": "Objective, balanced reference statement. Zero emotional leakage.",
        "color": (88, 166, 255),      # GitHub blue #58a6ff
        "bg_badge": (22, 27, 34),
    },
    {
        "id": "passive_hostility",
        "name": "PASSIVE HOSTILITY",
        "emoji": "🧊",
        "badge": "Rd=0.45 Pressed | Ps=11.5 cmH2O | Flat Monotone",
        "tagline": "Polite words concealing cold, suppressed resentment and rigid pitch.",
        "color": (56, 189, 248),      # Cyan #38bdf8
        "bg_badge": (12, 35, 50),
    },
    {
        "id": "curiosity",
        "name": "GENUINE CURIOSITY",
        "emoji": "🔍",
        "badge": "Rd=1.25 Flow | Ps=9.0 cmH2O | Terminal Rise (L-H%)",
        "tagline": "Open intrigue and upward question glide on 'decision?'.",
        "color": (34, 211, 238),      # Bright aqua #22d3ee
        "bg_badge": (10, 40, 48),
    },
    {
        "id": "sarcasm",
        "name": "DEADPAN SARCASM",
        "emoji": "🎭",
        "badge": "Rd=0.70 Mixed | Ps=10.5 cmH2O | Mock Tonic Stretch",
        "tagline": "Heavy irony: prolonged 'completely fine' with flat deadpan coda.",
        "color": (192, 132, 252),     # Purple #c084fc
        "bg_badge": (35, 20, 55),
    },
    {
        "id": "exasperation",
        "name": "WEARY EXASPERATION",
        "emoji": "😮‍💨",
        "badge": "Rd=1.80 Breathy | Ps=4.2 cmH2O (Collapse) | Fry",
        "tagline": "Audible sigh dump onset with continuous lung pressure collapse.",
        "color": (251, 191, 36),      # Amber #fbbf24
        "bg_badge": (45, 32, 10),
    },
    {
        "id": "annoyance",
        "name": "IRRITATED ANNOYANCE",
        "emoji": "💢",
        "badge": "Rd=0.55 Tense | Ps=13.0 cmH2O | Falling (H+L*)",
        "tagline": "Sharp, curt, impatient tempo (1.20x) with tense vocal folds.",
        "color": (248, 113, 113),     # Coral Red #f87171
        "bg_badge": (45, 18, 18),
    },
    {
        "id": "anxiety",
        "name": "SHAKY ANXIETY",
        "emoji": "⚡",
        "badge": "Rd=1.20 | Ps=8.5 cmH2O | Neural Prosodic Tremor",
        "tagline": "Natural apprehensive hesitation, nervous throat tremor, and authentic vulnerability.",
        "color": (232, 121, 249),     # Fuchsia #e879f9
        "bg_badge": (40, 15, 45),
    },
    {
        "id": "quiet_dejection",
        "name": "QUIET DEJECTION",
        "emoji": "🥀",
        "badge": "Rd=2.20 Lax | Ps=4.8 cmH2O | Breathy Decay",
        "tagline": "Subdued amplitude, hypokinetic parasympathetic collapse, fragile fade.",
        "color": (148, 163, 184),     # Slate #94a3b8
        "bg_badge": (25, 30, 38),
    },
]

W, H = 840, 260
FPS = 30
NUM_BARS = 44
BAR_W = 12
BAR_SPACING = 5
VIZ_TOTAL_W = NUM_BARS * BAR_W + (NUM_BARS - 1) * BAR_SPACING
VIZ_START_X = (W - VIZ_TOTAL_W) // 2
VIZ_BOTTOM_Y = 232
VIZ_MAX_H = 80

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"
font_title = ImageFont.truetype(FONT_PATH, 20)
font_text = ImageFont.truetype(FONT_PATH, 17)
font_meta = ImageFont.truetype(FONT_PATH, 13)
font_small = ImageFont.truetype(FONT_PATH, 11)

def render_subtext_video(cfg: dict) -> str:
    audio_path = os.path.join(AUDIO_DIR, f"{cfg['id']}.wav")
    out_mp4 = os.path.join(VIDEO_DIR, f"{cfg['id']}.mp4")

    data, sr = sf.read(audio_path)
    if len(data.shape) > 1:
        data = data[:, 0]
    dur = len(data) / sr
    total_frames = max(1, int(dur * FPS))

    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{W}x{H}", "-pix_fmt", "rgb24", "-r", str(FPS),
        "-i", "pipe:0",
        "-i", audio_path,
        "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out_mp4
    ]

    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    accent_color = cfg["color"]
    bg_badge = cfg["bg_badge"]

    # Pre-calculate FFT envelopes for smooth animation
    win_size = 1024
    for f in range(total_frames):
        t = f / FPS
        sample_idx = int(t * sr)
        start = max(0, sample_idx - win_size // 2)
        end = min(len(data), sample_idx + win_size // 2)
        chunk = data[start:end]
        if len(chunk) < win_size:
            chunk = np.pad(chunk, (0, win_size - len(chunk)))

        win = np.hanning(len(chunk))
        mag = np.abs(np.fft.rfft(chunk * win))
        freq_bins = np.logspace(0.8, np.log10(len(mag)), NUM_BARS + 1).astype(int)
        bar_heights = []
        for b in range(NUM_BARS):
            b_start = min(len(mag) - 1, freq_bins[b])
            b_end = min(len(mag), max(b_start + 1, freq_bins[b + 1]))
            val = np.mean(mag[b_start:b_end]) if b_end > b_start else 0.0
            # Studio visualizer gain curve
            h = int(np.clip(val * 48.0, 5, VIZ_MAX_H))
            bar_heights.append(h)

        # Base Frame Image
        img = Image.new("RGB", (W, H), (13, 17, 23)) # GitHub Dark #0d1117
        draw = ImageDraw.Draw(img)

        # Outer Card Border
        draw.rounded_rectangle([(6, 6), (W - 6, H - 6)], radius=12, outline=(48, 54, 61), width=2)

        # Top Bar: Emoji + Title
        title_str = f"{cfg['emoji']}  {cfg['name']}"
        draw.text((28, 20), title_str, font=font_title, fill=accent_color)

        # Top Right Badge Pill
        badge_text = cfg["badge"]
        bbox = draw.textbbox((0, 0), badge_text, font=font_meta)
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        bx = W - 28 - bw - 18
        draw.rounded_rectangle([(bx, 18), (bx + bw + 18, 18 + bh + 8)], radius=10, fill=bg_badge, outline=(48, 54, 61))
        draw.text((bx + 9, 22), badge_text, font=font_meta, fill=(201, 209, 217))

        # Sentence Text
        draw.text((28, 56), "\"I am completely fine with this decision.\"", font=font_text, fill=(240, 246, 252))
        draw.text((28, 82), cfg["tagline"], font=font_meta, fill=(139, 148, 158))

        # Divider & Progress Track
        draw.line([(28, 114), (W - 28, 114)], fill=(33, 38, 45), width=2)
        prog_x = int(28 + (W - 56) * (t / dur))
        draw.line([(28, 114), (prog_x, 114)], fill=accent_color, width=2)

        # Visualizer Bars
        for b in range(NUM_BARS):
            bx = VIZ_START_X + b * (BAR_W + BAR_SPACING)
            bh = bar_heights[b]
            by = VIZ_BOTTOM_Y - bh

            # Subtle glow cap
            draw.rounded_rectangle([(bx, by), (bx + BAR_W, VIZ_BOTTOM_Y)], radius=3, fill=accent_color)
            # Bright top cap
            draw.line([(bx + 1, by), (bx + BAR_W - 1, by)], fill=(255, 255, 255), width=1)

        # Bottom Info Bar
        time_str = f"{t:04.2f}s / {dur:04.2f}s"
        draw.text((28, VIZ_BOTTOM_Y + 5), "VOICEBOX BIOPHYSICAL 48 kHz", font=font_small, fill=(72, 79, 88))
        draw.text((W - 115, VIZ_BOTTOM_Y + 5), time_str, font=font_small, fill=(139, 148, 158))

        p.stdin.write(img.tobytes())

    p.stdin.close()
    p.wait()
    size_kb = os.path.getsize(out_mp4) / 1024
    print(f"✓ Rendered {cfg['id']}.mp4 ({dur:.2f}s, {size_kb:.1f} KB)")

    # Also render an optimized animated GIF for instant, native markdown display
    out_gif = os.path.join(VIDEO_DIR, f"{cfg['id']}.gif")
    gif_cmd = [
        "ffmpeg", "-y", "-i", out_mp4,
        "-vf", "fps=12,scale=400:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        "-loop", "0",
        out_gif
    ]
    subprocess.run(gif_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_mp4

def render_compilation_video() -> str:
    """Concatenates all 8 subtexts into a single continuous showcase video."""
    out_master = os.path.join(VIDEO_DIR, "subtext_master_showcase.mp4")
    concat_txt = os.path.join(VIDEO_DIR, "concat_list.txt")

    with open(concat_txt, "w") as f:
        for cfg in SUBTEXT_CONFIG:
            f.write(f"file '{cfg['id']}.mp4'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_txt,
        "-c", "copy",
        "-movflags", "+faststart",
        out_master
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(concat_txt)
    size_kb = os.path.getsize(out_master) / 1024
    print(f"✓ Master Compilation Rendered: subtext_master_showcase.mp4 ({size_kb:.1f} KB)")
    return out_master

if __name__ == "__main__":
    print("Generating animated visualizer videos...")
    for cfg in SUBTEXT_CONFIG:
        render_subtext_video(cfg)
    render_compilation_video()
    print("All video visualizers ready!")
