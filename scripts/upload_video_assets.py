#!/usr/bin/env python3
"""
Uploads the generated MP4 visualizers to GitHub user-attachments
and saves the asset URLs into a JSON map.
"""

import os
import sys
import json
import subprocess
import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
VIDEO_DIR = os.path.join(PROJECT_ROOT, "demo", "video")
OUTPUT_JSON = os.path.join(VIDEO_DIR, "asset_urls.json")

# Get GitHub token and repo ID using gh CLI
token = subprocess.check_output(["gh", "auth", "token"]).decode("utf-8").strip()
repo_id = subprocess.check_output(["gh", "api", "repos/basimrdj/voicebox-mcp", "--jq", ".id"]).decode("utf-8").strip()

files_to_upload = [
    "subtext_master_showcase.mp4",
    "neutral.mp4",
    "passive_hostility.mp4",
    "curiosity.mp4",
    "sarcasm.mp4",
    "exasperation.mp4",
    "annoyance.mp4",
    "anxiety.mp4",
    "quiet_dejection.mp4",
]

urls = {}

for fname in files_to_upload:
    fpath = os.path.join(VIDEO_DIR, fname)
    if not os.path.exists(fpath):
        print(f"Skipping {fname}, file not found.")
        continue

    print(f"Uploading {fname} ({os.path.getsize(fpath) / 1024:.1f} KB)...")
    upload_url = f"https://uploads.github.com/user-attachments/assets?name={fname}&content_type=video/mp4&repository_id={repo_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "video/mp4",
    }

    with open(fpath, "rb") as f:
        resp = requests.post(upload_url, headers=headers, data=f)

    if resp.status_code in (200, 201):
        data = resp.json()
        asset_url = data.get("url")
        urls[fname] = asset_url
        print(f"✓ Uploaded {fname} -> {asset_url}")
    else:
        print(f"❌ Failed to upload {fname}: {resp.status_code} {resp.text}")

with open(OUTPUT_JSON, "w") as f:
    json.dump(urls, f, indent=2)

print(f"All assets uploaded successfully! Saved to {OUTPUT_JSON}")
