# Play screenshots

Play rejects phone screenshots whose long side is more than 2x the short side. Modern phones capture 20:9 (1080x2400). `frame.py` turns raw captures into 1080x1920 (9:16) 24-bit RGB PNGs on the Finzz indigo-to-blue gradient, with a caption, rounded corners and a soft shadow. It checks size, mode, file size (< 8 MB) and ratio, and exits non-zero on any failure.

## Your 5 steps
1. Capture the shots on the phone with the demo account (see `shot-list.md`), in the order listed.
2. Copy the files into `D:/Desktop/Finzz/App/store/screenshots/raw/` (git-ignored), named so they sort in shot order (`01-chats.png`, `02-ledger.png`, ...).
3. Run (PowerShell, from the `D:/Desktop/Finzz/App` folder):

```powershell
python store/screenshots/frame.py --in store/screenshots/raw --out store/screenshots/out --captions store/screenshots/captions.txt --crop-top 90 --crop-bottom 120
```

4. Open every file in `store/screenshots/out/` and check the caption, cropping and that no real data shows. Adjust `--crop-top` / `--crop-bottom` (use 0 if your captures have no bars) and rerun.
5. Upload in Play Console, Main store listing, Phone screenshots (2 minimum, 8 maximum), in file order.

Caption N in `captions.txt` goes with the Nth sorted input. Keep captions to 40 characters or fewer; more than 2 lines is shrunk automatically.

## Notes
- Needs Python 3.13 with Pillow, and the Windows font `segoeuib.ttf` (falls back to `arialbd.ttf`). No network.
- On this machine Pillow lives in the user site-packages, so `python -I` (isolated mode) cannot import it. Use plain `python` as above; the inputs are only images, never code.
- `_test/` (git-ignored) holds synthetic inputs and outputs used to test the script.
- Raw captures can show personal data, so `.gitignore` keeps `store/screenshots/raw/` and `store/screenshots/_test/` out of git.
