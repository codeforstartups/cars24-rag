# Google Sheets Setup

The extension saves crawled vehicle data directly to **your** Google Sheet.

## Option A: Apps Script (recommended — 3 minutes, no OAuth setup)

1. Go to [sheets.new](https://sheets.new) to create a Google Sheet
2. **Extensions → Apps Script**
3. Delete default code, paste contents of `apps-script/Code.gs` from this project → **Save**
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the **Web App URL** (`https://script.google.com/macros/s/.../exec`)
6. In the extension popup:
   - Paste Web App URL
   - Paste your Google Sheet URL
   - Click **Connect Sheet via Apps Script**
7. Start crawl — rows appear automatically

---

## Option B: OAuth (advanced)

Requires Google Cloud OAuth setup (about 5 minutes).

## Step 1: Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g. "Cars24 Crawler")
3. Enable these APIs:
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)

## Step 2: Configure OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (or Internal if using Google Workspace)
3. Fill in app name: `Cars24 Crawler`
4. Add your email as developer contact
5. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
6. Add your Gmail as a **Test user** (required while app is in Testing mode)

## Step 3: Create Chrome Extension OAuth client

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Chrome extension**
3. Copy your **Extension ID** from `chrome://extensions/` (under the extension name)
4. Paste the Extension ID into the OAuth client form
5. Click **Create** and copy the **Client ID** (ends with `.apps.googleusercontent.com`)

## Step 4: Add Client ID to the extension

Open `manifest.json` and replace the placeholder:

```json
"oauth2": {
  "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
  ...
}
```

## Step 5: Reload the extension

1. Go to `chrome://extensions/`
2. Click the refresh icon on **Cars24 Vehicle Crawler**
3. Open the extension popup → **Connect Google Account**
4. Click **Create New Spreadsheet** (or paste an existing Sheet URL)

## Usage

- Enable **Auto-save each vehicle to sheet** (on by default)
- Start a crawl — each vehicle is appended as a new row in real time
- Use **Sync All Collected Data** to backfill vehicles already crawled
- Click **Open spreadsheet** to view your data in Google Sheets

## Sheet columns

| Column | Field |
|--------|-------|
| A | vehicleId |
| B | title |
| C | year |
| D | detailUrl |
| E | price |
| F | originalPrice |
| G | emi |
| H | mileage |
| I | fuel |
| J | transmission |
| K | rto |
| L | owners |
| M | location |
| N | badge |
| O | imageUrl |
| P | scrapedAt |
| Q | detailScrapedAt |
| R | source |
| S | fetchError |

## Troubleshooting

| Error | Fix |
|-------|-----|
| `bad client id` | Extension ID in Google Cloud must match `chrome://extensions/` ID |
| `access blocked` | Add your Gmail as a test user in OAuth consent screen |
| `Google Sheets not connected` | Connect account and create/link a spreadsheet first |
| `API has not been used` | Enable Google Sheets API and Drive API in Cloud Console |

After changing `manifest.json`, always reload the extension and refresh the Cars24 tab.
