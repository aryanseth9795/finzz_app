# Finzz screen mock kit

HTML replicas of real Finzz screens (dark theme by default, light optional), rendered at 1080x2400 with headless Edge, then framed by `../frame.py`. Replicas must match the real app (read the real screen in `src/` first). Use data from `DEMO.md` only.

## Making a screen
1. Copy `_template.html` to `NN-name.html` (NN = 01..08, shot order; `00-` is the kit sample and is not framed).
2. Put content inside `<main class="screen">`. Use only CSS variables from `kit.css` (`--primary`, `--sp-lg`, `--r-md`, `--fs-md`, `--fw-bold`, `--card`, `--credit`, `--chart-1`..`--chart-8`, `--shadow-card`, ...). Screen area is 360 x 800 CSS px minus a 24px status bar and an 82px tab bar. For full-height screens add class `no-tabs` to `.screen` and remove `#tabbar`.
3. Icons: `<i data-ion="chatbubbles-outline"></i>` (any Ionicons name; default 24px, set `font-size` inline).
4. Avatars: `<span class="avatar" data-name="Rohan Mehta" data-size="56"></span>` (same colour hash and initials as the app's Avatar).
5. Status bar and tab bar are auto-built: `<div id="statusbar"></div>` and `<nav id="tabbar" data-active="Chats"></nav>` (Chats, Pool, Expenses, Notes, Vault). JS: `Finzz.statusbar(el)`, `Finzz.tabbar(el, active)`, `Finzz.inr(n)` (en-IN rupees, e.g. `₹1,24,500`), `Finzz.num(n)`, `Finzz.icons(root)`, `Finzz.avatars(root)` (call the last two after injecting HTML dynamically).
6. Keep script tags `icons.js` then `kit.js`.

## Render
```powershell
python store/screenshots/mock/render.py
```
Or one page: `python store/screenshots/mock/render.py --only 02`. Output: `store/screenshots/raw/NN-name.png`, asserted 1080x2400. Needs internet once for Roboto from Google Fonts (falls back to a sans font offline). Always open the PNG and check it.

## Frame
Move or exclude `00-kit-sample.png` from `raw/` first (delete it), then:
```powershell
python store/screenshots/frame.py --in store/screenshots/raw --out store/screenshots/out --captions store/screenshots/captions.txt
```

## Theme
Dark is the default (the real captures are dark). `kit.js` reads `?theme=light|dark` and sets `<html data-theme>` before first paint; `kit.css` has dark tokens on `:root` and light ones under `html[data-theme="light"]`. Render with `python store/screenshots/mock/render.py --theme dark` (default) or `--theme light`. Use tokens only (`var(--card)` etc.); extra tokens: `--gesture-pill`, `--statusbar-bg`, `--statusbar-fg`. Avoid hardcoded hex for surfaces/text.
