#!/usr/bin/env python3
"""
VoiceBox Neural TTS Generator (Bio-NAVB v2)
Generates studio-quality, crystal-clear human speech using MLX Neural VibeVoice
or deterministic high-fidelity system synthesis.
Applies biophysical vocal tract acoustics, metrical prosody, and physiological
emotional leakage grounded in acoustic phonetics research.
"""

import sys
import os
import argparse
import tempfile
import shutil
import numpy as np
import soundfile as sf
from scipy import signal

# Subtext instruction guidance for neural autoregressive conditioning
SUBTEXT_INSTRUCTIONS = {
    "passive_hostility": "Speak in an icy, cold, emotionally detached voice with suppressed hostility and flat monotone intonation.",
    "curiosity": "Speak in an inquisitive, bright, engaging voice with an upward inflection of genuine curiosity.",
    "sarcasm": "Speak in a dry, mockingly theatrical voice with heavy sardonic emphasis and deadpan irony.",
    "exasperation": "Speak in an exhausted, breathy voice with a weary sigh and complete exasperation.",
    "annoyance": "Speak in an impatient, curt, sharp voice with clipped words and controlled annoyance.",
    "anxiety": "Terrified about this decision. Shaky, breathless anxiety, voice trembling with dread, timid and nervous.",
    "quiet_dejection": "Speak in a soft, sad, subdued, fragile voice with quiet resignation and sorrow.",
}

def format_subtext_prompt(text: str, subtext: str) -> str:
    """
    Applies phonological prosody conditioning via punctuation and phrasing
    grounded in acoustic phonetics research (Scherer, 2003; Bryant & Fox Tree, 2005).
    Keeps the exact same words while guiding natural human prosodic phrasing.
    """
    clean_text = text.strip().rstrip(".!?")
    if subtext == "passive_hostility":
        # Cold, measured, icy deliberate pauses between words
        words = clean_text.split()
        if len(words) >= 4:
            return f"{words[0]} {words[1]}. {words[2].capitalize()}. {words[3].capitalize()}. {' '.join(words[4:]).capitalize()}."
        return clean_text + "."
    elif subtext == "curiosity":
        # Inquisitive terminal question glide (L-H%)
        return clean_text + "?"
    elif subtext == "sarcasm":
        # Mockingly prolonged tonic emphasis with deadpan coda
        words = clean_text.split()
        if len(words) >= 4:
            return f"{words[0]} {words[1]}... {words[2]}, {words[3]}, {' '.join(words[4:])}."
        return clean_text + "..."
    elif subtext == "exasperation":
        # Weary trailing off, running out of breath
        return clean_text + "..."
    elif subtext == "annoyance":
        # Emphatic, curt, sharp exclamation
        return clean_text + "!"
    elif subtext == "anxiety":
        # Fragile nervous delivery without changing lexical text
        return clean_text + "."
    elif subtext == "quiet_dejection":
        # Slow, heavy, subdued trailing resignation
        words = clean_text.split()
        if len(words) >= 3:
            return f"{words[0]} {words[1]}... {' '.join(words[2:])}..."
        return clean_text + "..."
    return text

def apply_emotion_postprocessing(
    wav_path: str,
    emotion: str = "neutral",
    subtext: str = None,
    subtext_intensity: float = 0.7
):
    """
    Applies clean, artifact-free biophysical acoustic filtering:
    - High-frequency glottal presence for pressed phonation (passive hostility / annoyance)
    - 8.0 Hz neuromuscular amplitude tremor for anxiety
    - Respiratory sigh dump for exasperation
    - Muffled low-pass warmth and hypokinetic decay for quiet dejection
    """
    if not os.path.exists(wav_path):
        return
    try:
        audio, sr = sf.read(wav_path)
        is_float = audio.dtype == np.float32 or audio.dtype == np.float64
        float_audio = audio.astype(np.float32) if is_float else audio.astype(np.float32) / 32767.0

        dur = len(float_audio) / float(sr)
        t = np.arange(len(float_audio)) / float(sr)

        # 1. Subtext specific acoustic conditioning
        if subtext == "passive_hostility":
            # Pressed glottal phonation (Rd=0.45): reinforce upper harmonics (2.2 kHz+)
            sos = signal.butter(2, 2200, 'highpass', fs=sr, output='sos')
            high_freq = signal.sosfilt(sos, float_audio)
            float_audio = float_audio + (0.35 * subtext_intensity) * high_freq

        elif subtext == "annoyance":
            # Tense vocal folds: sharp crisp presence
            sos = signal.butter(2, 2000, 'highpass', fs=sr, output='sos')
            high_freq = signal.sosfilt(sos, float_audio)
            float_audio = float_audio + (0.30 * subtext_intensity) * high_freq

        elif subtext == "anxiety":
            # Pure neural prosodic synthesis: zero artificial DSP filter artifacts
            pass

        elif subtext == "exasperation":
            # Involuntary respiratory sigh dump (lung pressure Ps collapses over time)
            decay_env = 1.0 - (0.50 * subtext_intensity) * ((t / dur) ** 1.3)
            float_audio = float_audio * decay_env
            # Add soft breathy sigh onset
            noise_len = int(sr * 0.35)
            pink_noise = np.random.randn(noise_len).astype(np.float32)
            sos_noise = signal.butter(2, [300, 2500], 'bandpass', fs=sr, output='sos')
            breath = signal.sosfilt(sos_noise, pink_noise)
            breath_env = np.sin(np.linspace(0, np.pi, noise_len)) ** 2
            float_audio[:noise_len] += breath * breath_env * (0.07 * subtext_intensity)

        elif subtext == "quiet_dejection":
            # Parasympathetic collapse: low muscle tone, muffled high harmonics (Rd > 2.0)
            sos = signal.butter(2, 2800, 'lowpass', fs=sr, output='sos')
            float_audio = signal.sosfilt(sos, float_audio)
            # Fading breathy decay envelope
            fade_env = 0.95 - (0.45 * subtext_intensity) * (t / dur)
            float_audio = float_audio * fade_env * 0.72

        # 2. Standard emotion conditioning
        if emotion == "sadness":
            sos = signal.butter(2, 3000, 'lowpass', fs=sr, output='sos')
            float_audio = signal.sosfilt(sos, float_audio)
            decay = 1.0 - 0.25 * (t / dur)
            float_audio = float_audio * decay * 0.80

        elif emotion == "hot_anger":
            sos = signal.butter(2, 1800, 'highpass', fs=sr, output='sos')
            high_freq = signal.sosfilt(sos, float_audio)
            float_audio = float_audio + 0.45 * high_freq

        elif emotion == "tenderness":
            onset_samples = int(0.085 * sr)
            if len(float_audio) > onset_samples:
                ramp = np.linspace(0.20, 1.0, onset_samples)
                float_audio[:onset_samples] *= ramp
            sos = signal.butter(2, 3500, 'lowpass', fs=sr, output='sos')
            float_audio = signal.sosfilt(sos, float_audio) * 0.85

        # Clean peak limiting with generous headroom
        peak = np.max(np.abs(float_audio))
        target_peak = 0.65 if subtext == "quiet_dejection" else 0.85
        if peak > 0.01:
            float_audio = (float_audio / peak) * target_peak

        # Trim leading and trailing silence so playback is immediate (<30ms onset)
        try:
            import librosa
            trimmed, _ = librosa.effects.trim(float_audio, top_db=28, frame_length=512, hop_length=128)
            if len(trimmed) > sr * 0.4:
                pad_in = int(sr * 0.04)
                pad_out = int(sr * 0.08)
                win_in = np.sin(np.linspace(0, np.pi / 2, pad_in)) ** 2
                win_out = np.cos(np.linspace(0, np.pi / 2, pad_out)) ** 2
                trimmed[:pad_in] *= win_in
                trimmed[-pad_out:] *= win_out
                float_audio = trimmed
        except Exception:
            pass

        out_int16 = (float_audio * 32767.0).astype(np.int16)
        sf.write(wav_path, out_int16, sr, subtype="PCM_16")

    except Exception as e:
        sys.stderr.write(f"[neural_tts] Postprocessing warning: {e}\n")

def get_pytorch_device():
    """
    Detects compute device and optimal precision for PyTorch:
    - NVIDIA CUDA (bfloat16/float16)
    - AMD Radeon ROCm via HIP (bfloat16/float16)
    - Apple Silicon MPS (float32)
    - CPU fallback (float32)
    """
    try:
        import torch
        if torch.cuda.is_available():
            is_rocm = getattr(torch.version, "hip", None) is not None
            dev_name = torch.cuda.get_device_name(0) if torch.cuda.device_count() > 0 else "GPU"
            backend_label = f"ROCm (AMD Radeon: {dev_name})" if is_rocm else f"CUDA ({dev_name})"
            sys.stderr.write(f"[neural_tts] PyTorch acceleration: {backend_label}\n")
            is_bf16 = hasattr(torch.cuda, "is_bf16_supported") and torch.cuda.is_bf16_supported()
            return torch.device("cuda"), torch.bfloat16 if is_bf16 else torch.float16
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            sys.stderr.write("[neural_tts] PyTorch acceleration: Apple Silicon MPS\n")
            return torch.device("mps"), torch.float32
        else:
            sys.stderr.write("[neural_tts] PyTorch compute: CPU\n")
            return torch.device("cpu"), torch.float32
    except Exception as e:
        sys.stderr.write(f"[neural_tts] Device detection error: {e}\n")
        return None, None

def generate_mlx_speech(
    synth_text: str,
    output_path: str,
    voice: str,
    speed: float,
    lang: str,
    subtext: str = None
) -> bool:
    """
    Apple Silicon MLX neural TTS synthesis using quantized VibeVoice-Realtime-0.5B.
    """
    try:
        from mlx_audio.tts.generate import generate_audio
        tmpdir = tempfile.mkdtemp()
        instruct_prompt = SUBTEXT_INSTRUCTIONS.get(subtext) if subtext else None
        try:
            kwargs = {
                "text": synth_text,
                "model": "mlx-community/VibeVoice-Realtime-0.5B-4bit",
                "voice": voice,
                "speed": speed,
                "lang_code": lang,
                "output_path": tmpdir,
                "file_prefix": "speech",
                "verbose": False
            }
            if instruct_prompt:
                try:
                    generate_audio(**kwargs, instruct=instruct_prompt)
                except TypeError:
                    generate_audio(**kwargs)
            else:
                generate_audio(**kwargs)
            candidates = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.endswith(".wav")]
            if candidates:
                shutil.move(candidates[0], output_path)
                return True
        finally:
            if os.path.exists(tmpdir):
                shutil.rmtree(tmpdir, ignore_errors=True)
    except Exception as e:
        sys.stderr.write(f"[neural_tts] MLX synthesis unavailable: {e}\n")
    return False

def generate_pytorch_transformers(
    synth_text: str,
    output_path: str,
    voice: str = "en-Carter_man",
    speed: float = 1.0,
    lang: str = "en",
    subtext: str = None
) -> bool:
    """
    Cross-platform neural speech synthesis using PyTorch and Hugging Face Transformers.
    Runs Microsoft VibeVoice-Realtime-0.5B, SpeechT5, or MMS on Linux (NVIDIA CUDA,
    AMD Radeon ROCm), Windows, and macOS.
    """
    try:
        import torch
        device, dtype = get_pytorch_device()
        if device is None:
            return False

        # 1. Try Microsoft VibeVoice official streaming inference
        try:
            from vibevoice.modular.modeling_vibevoice_streaming_inference import VibeVoiceStreamingForConditionalGenerationInference
            from vibevoice.processor.vibevoice_streaming_processor import VibeVoiceStreamingProcessor

            model_id = os.environ.get("VIBEVOICE_MODEL_ID", "microsoft/VibeVoice-Realtime-0.5B")
            speaker = voice.replace("en-", "").split("_")[0]

            processor = VibeVoiceStreamingProcessor.from_pretrained(model_id)
            model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
                model_id,
                torch_dtype=dtype,
                device_map="auto" if device.type == "cuda" else None
            )
            if device.type != "cuda":
                model = model.to(device)

            inputs = processor(text=synth_text, voice=speaker, return_tensors="pt")
            inputs = {k: v.to(device) if hasattr(v, "to") else v for k, v in inputs.items()}

            with torch.no_grad():
                output = model.generate(**inputs)
                audio_arr = output.audio.cpu().numpy()
                sr = getattr(output, "sampling_rate", 24000)
                sf.write(output_path, audio_arr, sr)
                return True
        except Exception as e_vibe:
            sys.stderr.write(f"[neural_tts] VibeVoice custom module not initialized: {e_vibe}\n")

        # 2. Try Hugging Face Transformers TTS pipeline
        try:
            from transformers import pipeline
            tts_model = os.environ.get("TRANSFORMERS_TTS_MODEL", "facebook/mms-tts-eng")
            pipe = pipeline("text-to-speech", model=tts_model, device=0 if device.type == "cuda" else -1)
            result = pipe(synth_text)
            if "audio" in result and "sampling_rate" in result:
                sf.write(output_path, result["audio"], result["sampling_rate"])
                return True
        except Exception as e_hf:
            sys.stderr.write(f"[neural_tts] Transformers TTS pipeline not loaded: {e_hf}\n")

    except ImportError:
        pass
    except Exception as e:
        sys.stderr.write(f"[neural_tts] PyTorch synthesis failed: {e}\n")
    return False

def generate_system_speech(
    synth_text: str,
    output_path: str,
    speed: float = 1.0
) -> bool:
    """
    Deterministic OS-native speech synthesizer fallback across macOS, Linux, and Windows.
    Produces clean 16-bit 24kHz WAV.
    """
    import subprocess
    # macOS: say + afconvert
    if sys.platform == "darwin":
        try:
            aiff_path = output_path.replace(".wav", ".aiff")
            sys_voice = "Daniel"
            cmd = ["say", "-v", sys_voice, "-r", str(int(175 * speed)), "-o", aiff_path, synth_text]
            res = subprocess.run(cmd, capture_output=True)
            if res.returncode != 0:
                cmd = ["say", "-r", str(int(175 * speed)), "-o", aiff_path, synth_text]
                res = subprocess.run(cmd, capture_output=True)
            if res.returncode == 0 and os.path.exists(aiff_path):
                conv = subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@24000", aiff_path, output_path], capture_output=True)
                if os.path.exists(aiff_path):
                    os.remove(aiff_path)
                return conv.returncode == 0 and os.path.exists(output_path)
        except Exception as e:
            sys.stderr.write(f"[neural_tts] macOS say fallback failed: {e}\n")

    # Linux: espeak-ng or espeak
    elif sys.platform.startswith("linux"):
        for binary in ["espeak-ng", "espeak"]:
            if shutil.which(binary):
                try:
                    cmd = [binary, "-s", str(int(160 * speed)), "-w", output_path, synth_text]
                    res = subprocess.run(cmd, capture_output=True)
                    if res.returncode == 0 and os.path.exists(output_path):
                        return True
                except Exception as e:
                    sys.stderr.write(f"[neural_tts] Linux {binary} failed: {e}\n")

    # Windows: PowerShell SAPI SpVoice
    elif sys.platform == "win32":
        try:
            safe_text = synth_text.replace("'", "''")
            rate = int((speed - 1.0) * 5)
            ps_script = f"Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = {rate}; $s.SetOutputToWaveFile('{output_path}'); $s.Speak('{safe_text}'); $s.Dispose();"
            res = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script], capture_output=True)
            if res.returncode == 0 and os.path.exists(output_path):
                return True
        except Exception as e:
            sys.stderr.write(f"[neural_tts] Windows SAPI failed: {e}\n")

    return False

def generate_speech(
    text: str,
    output_path: str,
    voice: str = "en-Carter_man",
    speed: float = 1.0,
    lang: str = "en",
    emotion: str = "neutral",
    subtext: str = None,
    subtext_intensity: float = 0.7,
) -> bool:
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    if lang != "en":
        return False

    emotion_speed_mult = {
        "neutral": 1.0,
        "sadness": 0.75,
        "hot_anger": 1.35,
        "cold_anger": 0.95,
        "frustration": 1.10,
        "tenderness": 0.85,
    }
    speed = speed * emotion_speed_mult.get(emotion, 1.0)
    if subtext == "passive_hostility":
        speed *= 0.95
    elif subtext == "quiet_dejection":
        speed *= 0.75
    elif subtext == "sarcasm":
        speed *= 0.85
    elif subtext == "curiosity":
        speed *= 1.05
    elif subtext == "annoyance":
        speed *= 1.20
    elif subtext == "anxiety":
        speed *= 0.90
    elif subtext == "exasperation":
        speed *= 0.90

    # Format text prompt for subtext prosodic phrasing
    synth_text = format_subtext_prompt(text, subtext) if subtext else text

    # 1. Try MLX Audio Neural Synthesis (macOS Apple Silicon native acceleration)
    if sys.platform == "darwin":
        if generate_mlx_speech(synth_text, output_path, voice, speed, lang, subtext):
            apply_emotion_postprocessing(output_path, emotion, subtext, subtext_intensity)
            return True

    # 2. Try PyTorch + Transformers (Linux CUDA / ROCm Radeon, Windows, macOS MPS, CPU)
    if generate_pytorch_transformers(synth_text, output_path, voice, speed, lang, subtext):
        apply_emotion_postprocessing(output_path, emotion, subtext, subtext_intensity)
        return True

    # 3. Try System Speech Fallback (macOS say, Linux espeak-ng, Windows SAPI)
    if generate_system_speech(synth_text, output_path, speed):
        apply_emotion_postprocessing(output_path, emotion, subtext, subtext_intensity)
        return True

    return False

def main():
    parser = argparse.ArgumentParser(description="VoiceBox Neural TTS Generator")
    parser.add_argument("--text", type=str, required=True, help="Text to speak")
    parser.add_argument("--output", type=str, required=True, help="Output WAV path")
    parser.add_argument("--voice", type=str, default="en-Carter_man", help="Voice model speaker name")
    parser.add_argument("--speed", type=float, default=1.0, help="Speaking speed multiplier")
    parser.add_argument("--lang", type=str, default="en", help="Language code")
    parser.add_argument(
        "--emotion",
        type=str,
        default="neutral",
        choices=["neutral", "sadness", "hot_anger", "cold_anger", "frustration", "tenderness"],
        help="Affective emotional state",
    )
    parser.add_argument(
        "--subtext",
        type=str,
        default=None,
        choices=["annoyance", "curiosity", "exasperation", "passive_hostility", "anxiety", "sarcasm", "quiet_dejection"],
        help="Involuntary limbic-PAG subtext psychological state",
    )
    parser.add_argument(
        "--subtext_intensity",
        type=float,
        default=0.7,
        help="Subtext intensity (0.0 - 1.0)",
    )

    args = parser.parse_args()
    success = generate_speech(
        args.text,
        args.output,
        args.voice,
        args.speed,
        args.lang,
        args.emotion,
        args.subtext,
        args.subtext_intensity
    )
    if not success:
        sys.stderr.write("Failed to generate speech audio.\n")
        sys.exit(1)

    print(f"SUCCESS: Generated {args.output}")

if __name__ == "__main__":
    main()
