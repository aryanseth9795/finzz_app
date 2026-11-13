"""Render mock/NN-*.html to store/screenshots/raw/NN-*.png (1080x2400) with headless Edge.
Usage: python store/screenshots/mock/render.py [--only NN] [--theme dark|light]"""
import argparse, glob, os, subprocess, sys, tempfile
from PIL import Image

EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.abspath(os.path.join(HERE, "..", "raw"))

ap = argparse.ArgumentParser()
ap.add_argument("--only")
ap.add_argument("--theme", choices=["dark", "light"], default="dark")
a = ap.parse_args()
os.makedirs(RAW, exist_ok=True)
pages = sorted(glob.glob(os.path.join(HERE, "[0-9][0-9]-*.html")))
if a.only:
    pages = [p for p in pages if os.path.basename(p).startswith(a.only + "-")]
if not pages:
    sys.exit("no pages")
bad = 0
for p in pages:
    name = os.path.basename(p)[:-5]
    out = os.path.join(RAW, name + ".png")
    if os.path.exists(out):
        os.remove(out)
    with tempfile.TemporaryDirectory() as prof:
        cmd = [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
               "--force-device-scale-factor=3", "--window-size=360,800",
               "--virtual-time-budget=5000", "--user-data-dir=" + prof,
               "--screenshot=" + out, "file:///" + p.replace("\\", "/") + "?theme=" + a.theme]
        subprocess.run(cmd, capture_output=True, timeout=120)
    if not os.path.exists(out):
        print("FAIL", name, "no output")
        bad += 1
        continue
    sz = Image.open(out).size
    ok = sz == (1080, 2400)
    bad += not ok
    print("OK " if ok else "BAD", name, sz)
sys.exit(1 if bad else 0)
