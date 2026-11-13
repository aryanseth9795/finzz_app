# Store assets

The Finzz logo (concept A: a white "F" with a mint coin on an indigo-to-blue gradient) is drawn from geometry by `scripts/make-store-assets.py`. No image source is needed.

Regenerate everything with `python scripts/make-store-assets.py`. Concept A is the default.

| File | Size | Purpose | Goes to |
|---|---|---|---|
| `../assets/icon.png` | 1024x1024 RGB | App icon, full-bleed | App (`app.json` icon) |
| `../assets/adaptive-icon.png` | 1024x1024 RGBA | Android adaptive foreground, mark inside the safe zone | App (adaptiveIcon, background `#3B4FD8`) |
| `../assets/notification-icon.png` | 96x96 RGBA | White monochrome status-bar icon | App (expo-notifications plugin) |
| `play-icon-512.png` | 512x512 PNG | Hi-res icon | Play Console → Store listing → App icon |
| `feature-graphic-1024x500.png` | 1024x500 RGB, no alpha | Feature graphic | Play Console → Store listing → Feature graphic |
| `logo-A.svg` | vector | Master for the website and other uses | — |
| `logo-concepts.png` | 1536x560 | Concepts A, B and C side by side | Reference |
| `source-logo.png` | 442x432 | The old logo, kept for reference | Not used |

## Switching concepts
- `python scripts/make-store-assets.py --sheet` rewrites `logo-concepts.png`.
- `python scripts/make-store-assets.py --concept B` regenerates every icon and graphic for that concept and writes `logo-B.svg`.
- Then set `app.json` `android.adaptiveIcon.backgroundColor`: A `#3B4FD8`, B `#172554`, C `#1592DD`.
- New icons reach phones only through a new build (AAB/APK), never through OTA.
