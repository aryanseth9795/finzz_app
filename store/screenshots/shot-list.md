# Shot list (7 shots, in order)

Use the **demo account(s) only**: no real names, phones or amounts. Pick light or dark mode and keep every shot the same. Capture at the phone's native size (1080x2400 is fine; `frame.py` fits it to 1080x1920).
Name the raw files `01-...`, `02-...` so the sort order matches `captions.txt`.

| # | Screen and how to reach it | Demo data needed | Caption (line N of captions.txt) |
|---|---|---|---|
| 1 | Chats list: open the app, Chats tab | 4-6 friends with fake names, mixed owe / owed balances, one unread badge | All your friend ledgers in one place |
| 2 | A chat ledger: Chats tab, open one friend | 8+ rows, some verified, at least 2 pending, one edited | Every entry verified by both sides |
| 3 | Report preview: inside the chat, month header menu, report | A month with 6+ rows; set the month with the month picker | Share a clean monthly report |
| 4 | Expenses list: Expenses tab | A month of rows with category chips under the add form, "Food · UPI" style payment mode on rows, day headers | Track spending by category and mode |
| 5 | Analytics: Expenses tab, Analytics | At least 3 months of expenses across 5+ categories so the trend and "Where it went" fill | See where your money went |
| 6 | Notes: Notes tab, open a note shared with a friend | 2-3 notes, one shared (View or Edit) with a demo friend | Share notes with friends |
| 7 | Pools: Pools tab | 2 pools with 3+ members each, some activity | Pool money with your group |

## Vault
The Vault screen blocks screenshots (FLAG_SECURE), so it is **not** in the list. Try the Vault lock screen only if capture works there; if it does, add it as shot 8 with a new last line in `captions.txt` such as "Passwords stay on your device". Otherwise the privacy message is already carried by the Play listing text.

## Tips
- Turn on demo / airplane-free data first; hide notifications (Do Not Disturb) so none appear in the status bar.
- Crop the status bar and nav bar with `--crop-top` / `--crop-bottom` (typically about 90 and 120 px at 1080 wide); check one raw image first.
