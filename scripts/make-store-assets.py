"""Draw the Finzz logo from geometry and write app icons + Play Store graphics.

Usage:
  python scripts/make-store-assets.py                 # concept A (default)
  python scripts/make-store-assets.py --concept B     # concept B or C
  python scripts/make-store-assets.py --sheet         # store/logo-concepts.png
"""
import argparse
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
K = 4  # supersampling factor
BOLD = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"]
REG = ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]

GRAD = {"A": ("#4338CA", "#2563EB"), "B": ("#0F172A", "#1E3A8A"), "C": ("#2563EB", "#06B6D4")}
MID = {"A": "#3B4FD8", "B": "#172554", "C": "#1592DD"}
MINT, MINT_DK = (0x34, 0xD3, 0x99), (0x05, 0x96, 0x69)
WHITE = (255, 255, 255)


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def font(names, size):
    for n in names:
        if os.path.exists(n):
            return ImageFont.truetype(n, size)
    return ImageFont.load_default(size)


def background(concept, w, h, highlight=False, hl_center=(300, 260)):
    c0, c1 = (np.array(hexrgb(c), float) for c in GRAD[concept])
    ys, xs = np.mgrid[0:h, 0:w]
    t = ((xs / (w - 1)) + (ys / (h - 1))) / 2.0  # 135 degrees
    img = c0 + (c1 - c0) * t[..., None]
    if highlight:
        d = np.hypot(xs - hl_center[0], ys - hl_center[1])
        a = 0.14 * np.clip(1 - d / 520.0, 0, 1)
        img = img * (1 - a[..., None]) + 255 * a[..., None]
    return Image.fromarray(np.clip(img + 0.5, 0, 255).astype("uint8"), "RGB")


# ---------- geometry (1024 canvas) ----------
TH = 104  # bar thickness
STEM_H = 440
TOP = 512 - STEM_H // 2  # 292


def geom_f(concept):
    """x of the stem's left edge so the whole group is centred."""
    if concept == "A":
        width = 210 + 44 + 104  # middle arm + gap + coin diameter
        return 512 - width // 2
    return 512 - 380 // 2


ICON_ZOOM = {"A": 1.18}  # full-bleed icon only; adaptive/notification use zoom 1


def fit(img, zoom):
    """Resize the supersampled mark to 1024*zoom and centre-crop to 1024."""
    n = round(1024 * zoom)
    img = img.resize((n, n), Image.LANCZOS)
    o = (n - 1024) // 2
    return img.crop((o, o, o + 1024, o + 1024))


def mark(concept, notif=False, zoom=1.0):
    """Mark on transparent 1024x1024 RGBA, drawn supersampled."""
    N = 1024 * K
    s = lambda v: v * K
    if concept == "B":
        def disc(cx, cy, r):
            m = Image.new("L", (N, N), 0)
            ImageDraw.Draw(m).ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)], fill=255)
            return m
        left, right = disc(407, 512, 170), disc(617, 512, 170)
        inner = disc(617, 512, 144)
        ring = Image.fromarray(np.clip(np.asarray(right, int) - np.asarray(inner, int), 0, 255).astype("uint8"))
        white = Image.fromarray(np.maximum(np.asarray(left), np.asarray(ring)))
        lens = Image.fromarray(np.minimum(np.asarray(left), np.asarray(right)))
        out = Image.new("RGBA", (N, N), WHITE + (0,))
        out.putalpha(white)
        if not notif:
            mint = Image.new("RGBA", (N, N), MINT + (255,))
            mint.putalpha(lens)
            out = Image.alpha_composite(out, mint)
        return fit(out, zoom)

    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0 = geom_f(concept)
    w = WHITE + (255,)

    def bar(xa, ya, xb, yb):
        r = min(yb - ya, xb - xa) / 2
        d.rounded_rectangle([s(xa), s(ya), s(xb), s(yb)], radius=s(r), fill=w)

    bar(x0, TOP, x0 + TH, TOP + STEM_H)  # stem
    my = TOP + 170
    if concept == "A":
        bar(x0, TOP, x0 + 300, TOP + TH)  # top arm
        bar(x0, my, x0 + 210, my + TH)  # middle arm
        cx, cy, r = x0 + 210 + 44 + 52, my + TH / 2, 52
        d.ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)], fill=(w if notif else MINT + (255,)))
        if not notif:
            r2 = 36
            d.ellipse([s(cx - r2), s(cy - r2), s(cx + r2), s(cy + r2)], outline=MINT_DK + (255,), width=s(10))
    else:  # C
        bar(x0, TOP, x0 + 296, TOP + TH)
        ty = TOP + TH / 2
        d.polygon([(s(x0 + 280), s(ty - 75)), (s(x0 + 370), s(ty)), (s(x0 + 280), s(ty + 75))], fill=w)
        my_c = my + TH / 2
        tip = x0 + TH + 26
        bar(tip + 70, my, x0 + 330, my + TH)
        d.polygon([(s(tip), s(my_c)), (s(tip + 90), s(my_c - 75)), (s(tip + 90), s(my_c + 75))], fill=w)
    return fit(img, zoom)


def icon_img(concept):
    bg = background(concept, 1024, 1024, highlight=(concept == "A")).convert("RGBA")
    return Image.alpha_composite(bg, mark(concept, zoom=ICON_ZOOM.get(concept, 1.0))).convert("RGB")


def adaptive_img(concept):
    sz = round(1024 * 0.82)
    m = mark(concept).resize((sz, sz), Image.LANCZOS)
    out = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    out.paste(m, ((1024 - sz) // 2, (1024 - sz) // 2))
    return out


def notif_img(concept):
    a = mark(concept, notif=True).getchannel("A")
    a = a.crop(a.getbbox())
    f = min(76 / a.width, 76 / a.height)
    a = a.resize((max(1, round(a.width * f)), max(1, round(a.height * f))), Image.LANCZOS)
    full = Image.new("L", (96, 96), 0)
    full.paste(a, ((96 - a.width) // 2, (96 - a.height) // 2))
    out = Image.new("RGBA", (96, 96), (255, 255, 255, 0))
    out.putalpha(full)
    return out


def rounded(img, radius):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    o = img.convert("RGBA")
    o.putalpha(m)
    return o


def feature_graphic(concept):
    W, H = 1024, 500
    fg = background(concept, W, H).convert("RGBA")
    ic = rounded(icon_img(concept).resize((300, 300), Image.LANCZOS), 64)
    ix, iy = 110, (H - 300) // 2
    sa = Image.new("L", (W, H), 0)
    sa.paste(ic.getchannel("A"), (ix, iy + 14))
    sa = sa.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.40))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh.putalpha(sa)
    fg = Image.alpha_composite(fg, sh)
    fg.alpha_composite(ic, (ix, iy))

    tx, limit = 450, 964
    f1, f2 = font(BOLD, 96), font(REG, 38)
    d = ImageDraw.Draw(fg)
    t1, t2 = "Finzz", "Expenses & IOUs with friends"
    b1, b2 = d.textbbox((0, 0), t1, font=f1), d.textbbox((0, 0), t2, font=f2)
    pills = ["Split with friends", "Track spending", "Private vault"]
    ps, pad, gap, ph = 22, 14, 10, 40
    while True:
        fp = font(REG, ps)
        widths = [d.textlength(p, font=fp) + 2 * pad for p in pills]
        if tx + sum(widths) + gap * 2 <= limit or ps <= 16:
            break
        ps -= 1
    g1, g2 = 14, 26
    h1, h2 = b1[3] - b1[1], b2[3] - b2[1]
    y = (H - (h1 + g1 + h2 + g2 + ph)) // 2
    d.text((tx - b1[0], y - b1[1]), t1, font=f1, fill=WHITE + (255,))
    y += h1 + g1
    d.text((tx - b2[0], y - b2[1]), t2, font=f2, fill=WHITE + (217,))
    y += h2 + g2
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    x = tx
    for p, wd in zip(pills, widths):
        od.rounded_rectangle([x, y, x + wd, y + ph], radius=ph // 2, fill=WHITE + (46,))
        rb = od.textbbox((0, 0), "Ag", font=fp)  # fixed line box so pills align
        od.text((x + pad, y + (ph - (rb[3] - rb[1])) / 2 - rb[1]), p, font=fp, fill=WHITE + (255,))
        x += wd + gap
    return Image.alpha_composite(fg, ov).convert("RGB")


# ---------- SVG masters ----------
def svg(concept):
    c0, c1 = GRAD[concept]
    x0 = geom_f(concept)
    my = TOP + 170
    head = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">\n'
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{c0}"/><stop offset="1" stop-color="{c1}"/></linearGradient>\n'
            '<radialGradient id="h" gradientUnits="userSpaceOnUse" cx="300" cy="260" r="520">'
            '<stop offset="0" stop-color="#fff" stop-opacity="0.14"/>'
            '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>\n')
    bg = '<rect width="1024" height="1024" fill="url(#g)"/>\n'
    if concept == "A":
        cx, cy = x0 + 210 + 44 + 52, my + 52
        body = (f'<rect x="{x0}" y="{TOP}" width="104" height="440" rx="52" fill="#fff"/>\n'
                f'<rect x="{x0}" y="{TOP}" width="300" height="104" rx="52" fill="#fff"/>\n'
                f'<rect x="{x0}" y="{my}" width="210" height="104" rx="52" fill="#fff"/>\n'
                f'<circle cx="{cx}" cy="{cy}" r="52" fill="#34D399"/>\n'
                f'<circle cx="{cx}" cy="{cy}" r="31" fill="none" stroke="#059669" stroke-width="10"/>\n')
        return head + '</defs>\n' + bg + '<rect width="1024" height="1024" fill="url(#h)"/>\n' + body + '</svg>\n'
    if concept == "B":
        body = ('<clipPath id="L"><circle cx="407" cy="512" r="170"/></clipPath>\n'
                '<circle cx="407" cy="512" r="170" fill="#fff"/>\n'
                '<circle cx="617" cy="512" r="157" fill="none" stroke="#fff" stroke-width="26"/>\n'
                '<circle cx="617" cy="512" r="170" fill="#34D399" clip-path="url(#L)"/>\n')
        return head + '</defs>\n' + bg + body + '</svg>\n'
    ty, mc, tip = TOP + 52, my + 52, x0 + 104 + 26
    body = (f'<rect x="{x0}" y="{TOP}" width="104" height="440" rx="52" fill="#fff"/>\n'
            f'<rect x="{x0}" y="{TOP}" width="296" height="104" rx="52" fill="#fff"/>\n'
            f'<polygon points="{x0+280},{ty-75} {x0+370},{ty} {x0+280},{ty+75}" fill="#fff"/>\n'
            f'<rect x="{tip+70}" y="{my}" width="{x0+330-tip-70}" height="104" rx="52" fill="#fff"/>\n'
            f'<polygon points="{tip},{mc} {tip+90},{mc-75} {tip+90},{mc+75}" fill="#fff"/>\n')
    return head + '</defs>\n' + bg + body + '</svg>\n'


def sheet():
    W, H, S = 1536, 560, 352
    gap = (W - 3 * S) // 4
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    lf = font(BOLD, 26)
    for i, c in enumerate("ABC"):
        x = gap + i * (S + gap)
        ic = rounded(icon_img(c).resize((S, S), Image.LANCZOS), 80)
        im.paste(ic, (x, 24), ic)
        bb = d.textbbox((0, 0), c, font=lf)
        d.text((x + S / 2 - (bb[2] - bb[0]) / 2 - bb[0], 388 - bb[1]), c, font=lf, fill=(30, 30, 30))
        tile = Image.new("RGBA", (96, 96), (55, 65, 81, 255))
        tile.alpha_composite(notif_img(c))
        im.paste(tile.convert("RGB"), (x + (S - 96) // 2, 432))
    im.save(P("store", "logo-concepts.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--concept", choices=list("ABC"), default="A")
    ap.add_argument("--sheet", action="store_true")
    a = ap.parse_args()
    if a.sheet:
        sheet()
        print("wrote store/logo-concepts.png")
        return
    c = a.concept
    icon = icon_img(c)
    icon.save(P("assets", "icon.png"))
    adaptive_img(c).save(P("assets", "adaptive-icon.png"))
    notif_img(c).save(P("assets", "notification-icon.png"))
    icon.resize((512, 512), Image.LANCZOS).save(P("store", "play-icon-512.png"))
    feature_graphic(c).save(P("store", "feature-graphic-1024x500.png"))
    with open(P("store", f"logo-{c}.svg"), "w", encoding="utf-8") as f:
        f.write(svg(c))
    print("concept", c, "done; set app.json adaptiveIcon.backgroundColor to", MID[c])


main()
