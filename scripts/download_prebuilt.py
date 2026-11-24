#!/usr/bin/env python3
"""
VoiceBox Pre-Built Native Binary Installer
Downloads pre-compiled libchimera_wasm binaries (.so / .dylib / .dll)
from GitHub Releases so users on Linux, Windows, and macOS can run
the physical waveguide synthesis engine without building Rust from source.
"""

import os
import sys
import platform
import urllib.request
import urllib.error
import argparse

REPO = "basimrdj/voicebox-mcp"
DEFAULT_TAG = "v2.0.0"

def get_platform_info():
    system = sys.platform
    machine = platform.machine().lower()

    if system.startswith("linux"):
        os_name = "linux"
        target_name = "libchimera_wasm.so"
        if machine in ["x86_64", "amd64"]:
            asset_name = "libchimera_wasm-linux-x86_64.so"
        elif machine in ["aarch64", "arm64"]:
            asset_name = "libchimera_wasm-linux-aarch64.so"
        else:
            asset_name = "libchimera_wasm.so"

    elif system == "darwin":
        os_name = "macos"
        target_name = "libchimera_wasm.dylib"
        if machine in ["arm64", "aarch64"]:
            asset_name = "libchimera_wasm-macos-arm64.dylib"
        else:
            asset_name = "libchimera_wasm-macos-x86_64.dylib"

    elif system in ["win32", "cygwin"]:
        os_name = "windows"
        target_name = "chimera_wasm.dll"
        asset_name = "chimera_wasm-windows-x86_64.dll"

    else:
        raise RuntimeError(f"Unsupported operating system: {system}")

    return os_name, machine, target_name, asset_name

def download_file(url: str, dest_path: str):
    print(f"[VoiceBox] Fetching: {url}")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "VoiceBox-Binary-Fetcher/2.0"}
    )
    with urllib.request.urlopen(req) as resp, open(dest_path, "wb") as out_file:
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 65536
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            if total > 0:
                percent = (downloaded / total) * 100
                sys.stdout.write(f"\r[VoiceBox] Progress: {percent:.1f}% ({downloaded // 1024} KB / {total // 1024} KB)")
                sys.stdout.flush()
    print()

def main():
    parser = argparse.ArgumentParser(description="Download VoiceBox pre-built native libraries")
    parser.add_argument("--force", action="store_true", help="Overwrite existing library")
    parser.add_argument("--tag", type=str, default=DEFAULT_TAG, help="Release tag to download from")
    parser.add_argument("--dest", type=str, default=None, help="Custom destination folder")
    args = parser.parse_args()

    os_name, machine, target_name, asset_name = get_platform_info()
    print(f"[VoiceBox] Platform detected: {os_name} ({machine}) -> Asset: {asset_name}")

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dest_dir = args.dest or os.path.join(project_root, "lib")
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, target_name)

    if os.path.exists(dest_path) and not args.force:
        print(f"[VoiceBox] Native library already exists at: {dest_path}")
        print("[VoiceBox] Pass --force to re-download.")
        return

    # Try release tag first, then latest
    urls = [
        f"https://github.com/{REPO}/releases/download/{args.tag}/{asset_name}",
        f"https://github.com/{REPO}/releases/latest/download/{asset_name}",
        f"https://github.com/{REPO}/releases/download/{args.tag}/{target_name}",
        f"https://github.com/{REPO}/releases/latest/download/{target_name}",
    ]

    success = False
    for url in urls:
        try:
            download_file(url, dest_path)
            if os_name != "windows":
                os.chmod(dest_path, 0o755)
            print(f"[VoiceBox] Successfully installed {target_name} to: {dest_path}")
            success = True
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            print(f"[VoiceBox] HTTP Error {e.code}: {e.reason}")
        except Exception as e:
            print(f"[VoiceBox] Download attempt failed: {e}")

    if not success:
        print(f"[VoiceBox] Note: Pre-built release asset for {asset_name} is not yet published on GitHub Releases.")
        print(f"[VoiceBox] You can compile locally using: cargo build --release -p chimera-wasm --manifest-path reference/chimera-vocal-synth/Cargo.toml")
        print(f"[VoiceBox] Or run VoiceBox with pure DDSP and Neural backends (no native library required).")

if __name__ == "__main__":
    main()
