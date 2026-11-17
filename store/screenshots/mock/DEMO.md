# Finzz demo world (fictional; every screen must use exactly this)

"Today" is **Fri 13 Nov 2026**. Currency via `Finzz.inr()`. Sign convention: **+ = they owe Aarav**, **- = Aarav owes them**.

## User
Aarav Kapoor (`data-name="Aarav Kapoor"`), phone shown nowhere.

## Friends and balances (verified rows only)
| Friend | Balance | Chat list line | Last activity | Unread |
|---|---|---|---|---|
| Rohan Mehta | -1,340 (you owe; incl. pending) | Auto fare ₹220 (pending) | Nov 11 | 2 |
| Priya Nair | +2,350 (owes you) | Cab to airport | Nov 10 | 0 |
| Vikram Singh | +5,600 (owes you) | Weekend trek stay | Nov 8 | 0 |
| Ananya Iyer | -1,275 (you owe) | Book club snacks | Nov 5 | 0 |
| Karan Malhotra | +890 (owes you) | Chai and samosa | Nov 2 | 0 |
| Sneha Reddy | 0 (settled) | Settled up | Oct 28 | 0 |

Totals: owed to you 8,840 (2,350 + 5,600 + 890); you owe 5,395 (4,120 + 1,275); net +3,445.

## Chat with Rohan Mehta (Oct-Nov 2026)
"Gave" = Aarav paid, Rohan owes (+). "Got" = Rohan paid, Aarav owes (-).
| # | Date | Note | Amount | Dir | Status | Effect |
|---|---|---|---|---|---|---|
| 1 | Oct 03 | Dinner at Social | 1,850 | gave | verified | +1,850 |
| 2 | Oct 07 | Movie tickets | 700 | got | verified | -700 |
| 3 | Oct 12 | Cab to airport | 640 | gave | verified | +640 |
| 4 | Oct 18 | Cricket turf booking | 1,200 | got | verified | -1,200 |
| 5 | Oct 24 | Diwali sweets | 950 | gave | verified | +950 |
| 6 | Oct 30 | Rent share | 6,500 | got | verified, **edited** (was 6,000) | -6,500 |
| 7 | Nov 02 | Groceries | 1,320 | gave | verified | +1,320 |
| 8 | Nov 06 | Coffee and snacks | 480 | got | verified | -480 |
| 9 | Nov 09 | Concert tickets | 3,000 | gave | **pending** | not counted |
| 10 | Nov 11 | Auto fare | 220 | got | **pending** | not counted |

Check (verified only): 1,850-700+640-1,200+950-6,500+1,320-480 = -4,120. **The app counts PENDING rows in the monthly summary and the report (only rejected rows are excluded; server txController.ts ~453, chatReport/data.ts:155)**, so the balance shown on screen is -4,120 + 3,000 - 220 = **-1,340 (you owe ₹1,340)**. Nov: sent 4,320, received 700; Oct carry-forward -4,960.

## Expenses (personal, Sep-Nov 2026)
Categories (chart colour order): Food (chart-1), Transport (chart-2), Shopping (chart-3), Bills (chart-4), Entertainment (chart-5), Health (chart-6). Modes: `Cash`, `Online · UPI`, `Online · Card`.

| Category | Sep | Oct | Nov (to 13th) |
|---|---|---|---|
| Food | 6,200 | 7,150 | 3,480 |
| Transport | 2,400 | 2,850 | 1,260 |
| Shopping | 3,800 | 6,400 | 2,150 |
| Bills | 5,100 | 5,100 | 5,100 |
| Entertainment | 1,500 | 2,200 | 950 |
| Health | 900 | 1,300 | 600 |
| **Total** | **19,900** | **25,000** | **13,540** |

November rows (newest first; they sum to the table):
| Date | Title | Category | Mode | Amount |
|---|---|---|---|---|
| Nov 12 | Office lunch | Food | Online · UPI | 550 |
| Nov 11 | Petrol | Transport | Online · Card | 440 |
| Nov 10 | Biryani | Food | Online · UPI | 540 |
| Nov 10 | Gas cylinder | Bills | Online · UPI | 402 |
| Nov 09 | Pharmacy | Health | Cash | 600 |
| Nov 09 | T-shirt | Shopping | Online · Card | 651 |
| Nov 08 | Cafe brunch | Food | Online · UPI | 780 |
| Nov 08 | Movie | Entertainment | Online · UPI | 550 |
| Nov 07 | Uber | Transport | Online · UPI | 320 |
| Nov 06 | Mobile recharge | Bills | Online · UPI | 599 |
| Nov 05 | Headphones | Shopping | Online · Card | 1,499 |
| Nov 05 | Spotify | Entertainment | Online · Card | 400 |
| Nov 04 | Swiggy dinner | Food | Online · UPI | 460 |
| Nov 03 | Wi-Fi bill | Bills | Online · UPI | 999 |
| Nov 02 | Metro card | Transport | Cash | 500 |
| Nov 01 | Groceries | Food | Online · UPI | 1,150 |
| Nov 01 | Electricity | Bills | Online · UPI | 1,100 |
| Nov 01 | Flat maintenance | Bills | Online · Card | 2,000 |

Check: Food 550+540+780+460+1,150=3,480; Transport 440+320+500=1,260; Shopping 651+1,499=2,150; Bills 402+599+999+1,100+2,000=5,100; Entertainment 550+400=950; Health 600. Total 13,540.

## Notes (3)
1. **Goa packing list** (updated Nov 12): sunscreen, swimwear, power bank, ID copies. Private.
2. **Flat 302 rules** (updated Nov 9): bin duty rota, Wi-Fi password lives in Vault, rent due on 1st. **Shared with Priya Nair, Edit.**
3. **Gift ideas** (updated Nov 3): Mom - silk scarf; Dad - trekking shoes; Rohan - cricket grip. Private.

## Pools (2)
**Goa Trip** (4 members: Aarav Kapoor, Priya Nair, Vikram Singh, Sneha Reddy). Total spent 24,000; share 6,000 each.
Paid: Aarav 9,000, Priya 6,500, Vikram 5,500, Sneha 3,000 (= 24,000). Net: Aarav +3,000, Priya +500, Vikram -500, Sneha -3,000. Last activity Nov 12.

**Flat 302** (3 members: Aarav Kapoor, Rohan Mehta, Karan Malhotra). Total spent 15,300; share 5,100 each.
Paid: Aarav 6,000, Rohan 4,800, Karan 4,500 (= 15,300). Net: Aarav +900, Rohan -300, Karan -600. Last activity Nov 10.

## Vault (4 items; sites only, no passwords or usernames shown)
Personal email (Email: aarav.kapoor@example.com), Bank login (Customer ID: 4•••••21), Flat 302 Wi-Fi (Network: Flat302_5G), Streaming (Username: aarav_k). **No third-party brand names in store screenshots.** Never show real credentials; use dots (`••••••••`) if a password field is visible.
