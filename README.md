# Cars24 Vehicle Crawler — Chrome Extension

A Chrome extension that crawls [Cars24](https://www.cars24.com) used car listing pages in a **human-like** way to avoid bot detection. It scrolls gradually, pauses to "read", extracts vehicle data from listing cards, and optionally visits each detail page one-by-one.

## Features

- **Human-like scrolling** — random delays (1.5–4s), variable scroll distances, occasional scroll-up, and longer "reading" pauses every ~10 scrolls
- **Listing extraction** — title, year, price, EMI, mileage, fuel, transmission, RTO, location, badge, image URL, and detail page URL
- **Visual card highlighting** — each card turns **yellow** while being processed, light yellow when done; processes **right to left** across each row
- **Detail page fetching** (optional) — opens detail pages in a background tab (you stay on the listing page) with 3–8s delays
- **Google Sheets sync** — connect your Google account and auto-save each vehicle row to your spreadsheet in real time
- **Export** — download collected data as JSON or CSV
- **Pause / Resume / Stop** controls

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder: `crawler-chrome-extension`

## Usage

1. Navigate to a Cars24 listing page, e.g.:
   - https://www.cars24.com/buy-used-cars-delhi-ncr/
2. Click the extension icon in the toolbar
3. Adjust settings if needed:
   - **Scroll delay** — time between scrolls (default 1.5–4 seconds)
   - **Detail page delay** — time between detail page visits (default 3–8 seconds)
   - **Fetch detail page data** — enable to scrape full detail page data (cards highlight yellow right→left)
   - **Max scrolls** — stop after N scroll attempts (default 200)
4. Click **Start Crawl**
5. Keep the tab open and active — the extension will scroll and collect data automatically
6. When done, click **Export JSON** or **Export CSV**

### Google Sheets (recommended)

1. Follow **[GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md)** to configure OAuth (one-time, ~5 min)
2. In the extension popup → **Connect Google Account**
3. Click **Create New Spreadsheet** (or link an existing sheet URL)
4. Start crawl — each vehicle is saved as a row automatically

### Quick extract (no scrolling)

Click **Extract Visible Now** to grab all currently visible cards without scrolling.

## Data fields

| Field | Description |
|-------|-------------|
| `vehicleId` | Unique 8+ digit ID from URL |
| `detailUrl` | Full detail page URL |
| `title` | e.g. "2016 Renault Kwid RXT 0.8" |
| `year` | Model year |
| `price` | Listed price |
| `originalPrice` | Strikethrough price (if discounted) |
| `emi` | Monthly EMI |
| `mileage` | Odometer reading |
| `fuel` | Petrol / Diesel / CNG / etc. |
| `transmission` | Manual / Auto / etc. |
| `rto` | Registration code (e.g. DL-8C) |
| `location` | Hub / showroom location |
| `badge` | e.g. "Cars24 Owned Stock" |

## Anti-blocking tips

- Use **default or slower** delay settings — faster crawling increases block risk
- Don't run multiple crawls simultaneously
- Crawl during normal browsing hours
- Start with a single city listing page rather than trying all 10,000+ cars at once
- If blocked, wait 30+ minutes before retrying

## Project structure

```
crawler-chrome-extension/
├── manifest.json      # Extension config (Manifest V3)
├── content.js         # Page crawler (scroll, extract, detail visits)
├── background.js      # Export, detail fetch, Sheets orchestration
├── sheets.js          # Google Sheets API + OAuth
├── GOOGLE_SHEETS_SETUP.md
├── popup.html/js/css  # Extension popup UI
└── icons/             # Extension icons
```

## Limitations

- Cars24 uses client-side rendering — the extension must run in the browser tab
- Detail pages open in background tabs — keep the listing tab open and visible to watch highlights
- Very large crawls (10,000+ vehicles) will take hours with human-like delays by design
