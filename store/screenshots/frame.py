"""Turn raw phone screenshots into Play-ready 1080x1920 RGB PNGs on a brand gradient."""
import argparse, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
TOP, BOTTOM = (0x43, 0x38, 0xCA), (0x25, 0x63, 0xEB)  # logo-A.svg indigo -> blue
MARGIN, RADIUS, CAP_SIZE = 48, 36, 64
FONTS = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"]
MAX_BYTES = 8 * 1024 * 1024


def load_font(size):
    for p in FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise SystemExit("No bold font found (segoeuib.ttf / arialbd.ttf)")


def gradient():
    col = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / (H - 1)
        col.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))
    return col.resize((W, H))


def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def compose(src, caption, crop_top, crop_bottom):
    im = Image.open(src).convert("RGB")
    im = im.crop((0, crop_top, im.width, im.height - crop_bottom))
    bg = gradient()
    d = ImageDraw.Draw(bg)
    size = CAP_SIZE
    font = load_font(size)
    lines = wrap(d, caption, font, W - 2 * MARGIN) if caption else []
    while len(lines) > 2 and size > 36:  # keep to 2 lines
        size -= 4
        font = load_font(size)
        lines = wrap(d, caption, font, W - 2 * MARGIN)
    lines = lines[:2]
    lh = int(size * 1.25)
    y = 70
    for ln in lines:
        d.text((W / 2, y), ln, font=font, fill="white", anchor="mt")
        y += lh
    top = (y + 30) if lines else 70
    bottom_pad = 70
    aw, ah = W - 2 * MARGIN, H - top - bottom_pad
    s = min(aw / im.width, ah / im.height)
    nw, nh = round(im.width * s), round(im.height * s)
    im = im.resize((nw, nh), Image.LANCZOS)
    x0, y0 = (W - nw) // 2, top + (ah - nh) // 2
    mask = Image.new("L", (nw, nh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, nw - 1, nh - 1), RADIUS, fill=255)
    shadow = Image.new("L", (W, H), 0)
    shadow.paste(mask.point(lambda v: int(v * 0.45)), (x0, y0 + 14))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    bg.paste((0, 0, 0), (0, 0), shadow)
    bg.paste(im, (x0, y0), mask)
    return bg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--captions")
    ap.add_argument("--crop-top", type=int, default=0)
    ap.add_argument("--crop-bottom", type=int, default=0)
    a = ap.parse_args()
    caps = []
    if a.captions:
        with open(a.captions, encoding="utf-8") as f:
            caps = [l.strip() for l in f.read().splitlines()]
    files = sorted(f for f in os.listdir(a.inp) if f.lower().endswith((".png", ".jpg", ".jpeg")))
    if not files:
        print("No PNG/JPG inputs in", a.inp)
        return 1
    os.makedirs(a.out, exist_ok=True)
    rows, fail = [], False
    for i, f in enumerate(files):
        cap = caps[i] if i < len(caps) else ""
        out = os.path.join(a.out, f"{i+1:02d}-{os.path.splitext(f)[0]}.png")
        try:
            compose(os.path.join(a.inp, f), cap, a.crop_top, a.crop_bottom).save(out, "PNG", optimize=True)
            o = Image.open(out)
            size = os.path.getsize(out)
            ratio = max(o.size) / min(o.size)
            ok = o.size == (W, H) and o.mode == "RGB" and size < MAX_BYTES and ratio <= 2
        except Exception as e:
            print("ERROR", f, e)
            ok, size, ratio = False, 0, 0
        fail |= not ok
        rows.append((os.path.basename(out), "1080x1920", f"{size/1024:.0f} KB", f"{ratio:.2f}", "OK" if ok else "FAIL"))
    print(f"{'file':32} {'size':10} {'bytes':>9} {'ratio':>6}  status")
    for r in rows:
        print(f"{r[0]:32} {r[1]:10} {r[2]:>9} {r[3]:>6}  {r[4]}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
