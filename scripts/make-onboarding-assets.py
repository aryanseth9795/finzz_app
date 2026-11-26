#!/usr/bin/env python3
"""Build onboarding slides + video posters. Run from the repo root.

Usage: python scripts/make-onboarding-assets.py [videos_dir]
"""
import io
import subprocess
import sys
from pathlib import Path

from PIL import Image

VIDEOS_DIR = r"D:\Desktop\Finzz\Agent\promo\out\videos"
SHOTS_DIR = Path("store/screenshots/out")
OUT_DIR = Path("assets/onboarding")

# poster name -> (source mp4, timestamp seconds)
POSTERS = {
    "video-teaser.jpg": ("finzz-teaser-9x16.mp4", 5.0),
    "video-promo.jpg": ("finzz-promo-9x16.mp4", 25.0),
    "video-story-hindi.jpg": ("finzz-story-hindi-9x16.mp4", 35.0),
    "video-friends-pools.jpg": ("finzz-v1-friends-pools-9x16.mp4", 32.5),
    "video-expenses.jpg": ("finzz-v2-expenses-9x16.mp4", 18.0),
    "video-vault-notes.jpg": ("finzz-v3-vault-notes-9x16.mp4", 18.0),
}


def make_slides(quality):
    for src in sorted(SHOTS_DIR.glob("0[1-8]-*.png")):
        im = Image.open(src).convert("RGB").resize((720, 1280), Image.LANCZOS)
        im.save(OUT_DIR / (src.stem + ".jpg"), "JPEG", quality=quality,
                optimize=True, progressive=True)


def make_posters(vdir):
    for name, (mp4, ts) in POSTERS.items():
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", str(ts), "-i", str(Path(vdir) / mp4),
             "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
            check=True, stdout=subprocess.PIPE).stdout
        im = Image.open(io.BytesIO(raw)).convert("RGB").resize((540, 960), Image.LANCZOS)
        im.save(OUT_DIR / name, "JPEG", quality=80, optimize=True, progressive=True)


def main():
    vdir = sys.argv[1] if len(sys.argv) > 1 else VIDEOS_DIR
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_slides(82)
    slides = sum(p.stat().st_size for p in OUT_DIR.glob("0*.jpg"))
    if slides > 800 * 1024:
        make_slides(78)
    make_posters(vdir)
    total = 0
    for p in sorted(OUT_DIR.glob("*.jpg")):
        s = p.stat().st_size
        total += s
        print(f"{p.as_posix()}  {s / 1024:.1f} KB")
    print(f"TOTAL {total / 1024:.1f} KB")


if __name__ == "__main__":
    main()
