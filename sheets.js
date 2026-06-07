/**
 * Google Sheets — OAuth API or Apps Script webhook (no OAuth setup needed).
 */

const SHEET_FIELDS = [
  "vehicleId", "title", "make", "model", "variant", "year", "detailUrl",
  "price", "originalPrice", "emi", "mileage", "fuel", "transmission", "rto",
  "owners", "location", "badge", "imageUrl", "scrapedAt", "detailScrapedAt",
  "source", "fetchError",
];

const SHEET_TAB = "Vehicles";

function isOAuthConfigured() {
  const clientId = chrome.runtime.getManifest().oauth2?.client_id || "";
  return Boolean(clientId && !clientId.includes("REPLACE_WITH_YOUR"));
}

function getOAuthSetupStatus() {
  return {
    configured: isOAuthConfigured(),
    extensionId: chrome.runtime.id,
    clientId: isOAuthConfigured()
      ? "configured"
      : (chrome.runtime.getManifest().oauth2?.client_id || "missing"),
  };
}

function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    if (!isOAuthConfigured()) {
      reject(new Error("OAuth not configured in manifest.json — use Apps Script connect instead"));
      return;
    }
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!token) {
        reject(new Error("No auth token received"));
      } else {
        resolve(token);
      }
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

function parseSpreadsheetId(urlOrId) {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

function vehicleToRow(vehicle) {
  return SHEET_FIELDS.map((f) => {
    const val = vehicle[f];
    return val == null ? "" : String(val);
  });
}

async function sheetsFetch(path, token, options = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.message || `Sheets API error (${res.status})`);
  }
  return body;
}

async function getSheetsConfig() {
  return chrome.storage.local.get([
    "sheetsConnected",
    "sheetsMode",
    "sheetsWebhookUrl",
    "sheetsSpreadsheetId",
    "sheetsSpreadsheetUrl",
    "sheetsSyncedIds",
    "sheetsAutoSync",
  ]);
}

async function getSheetsStatus() {
  const cfg = await getSheetsConfig();
  const oauth = getOAuthSetupStatus();
  return {
    connected: Boolean(cfg.sheetsConnected),
    mode: cfg.sheetsMode || null,
    spreadsheetId: cfg.sheetsSpreadsheetId || null,
    spreadsheetUrl: cfg.sheetsSpreadsheetUrl || null,
    webhookUrl: cfg.sheetsWebhookUrl || null,
    syncedCount: (cfg.sheetsSyncedIds || []).length,
    autoSync: cfg.sheetsAutoSync !== false,
    oauthConfigured: oauth.configured,
    extensionId: oauth.extensionId,
  };
}

// ─── Apps Script webhook (recommended — no OAuth client needed) ──────────────

async function postToWebhook(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (!json.ok) throw new Error(json.error || "Webhook returned error");
    return json;
  } catch (err) {
    if (!res.ok) throw new Error(`Webhook failed (${res.status}): ${text.slice(0, 120)}`);
    if (text.includes("ok")) return { ok: true };
    throw err;
  }
}

async function connectViaWebhook(webhookUrl, sheetUrl) {
  const url = webhookUrl?.trim();
  if (!url || !url.includes("script.google.com")) {
    return { ok: false, error: "Paste a valid Apps Script Web App URL (script.google.com/...)" };
  }

  await postToWebhook(url, { action: "init", headers: SHEET_FIELDS });

  const spreadsheetUrl = sheetUrl?.trim() || null;
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrl);

  await chrome.storage.local.set({
    sheetsConnected: true,
    sheetsMode: "webhook",
    sheetsWebhookUrl: url,
    sheetsSpreadsheetUrl: spreadsheetUrl,
    sheetsSpreadsheetId: spreadsheetId,
    sheetsSyncedIds: [],
  });

  return { ok: true, mode: "webhook", spreadsheetUrl };
}

async function appendViaWebhook(vehicle, cfg) {
  await postToWebhook(cfg.sheetsWebhookUrl, {
    action: "append",
    headers: SHEET_FIELDS,
    row: vehicleToRow(vehicle),
  });
}

// ─── OAuth API path (advanced) ───────────────────────────────────────────────

async function connectGoogleAccount() {
  if (!isOAuthConfigured()) {
    return {
      ok: false,
      needsSetup: true,
      extensionId: chrome.runtime.id,
      error: "OAuth Client ID not set in manifest.json. Use 'Connect via Apps Script' below (easier), or follow GOOGLE_SHEETS_SETUP.md.",
    };
  }

  const token = await getAuthToken(true);
  await chrome.storage.local.set({ sheetsConnected: true, sheetsMode: "oauth" });
  return { ok: true, connected: true, mode: "oauth", tokenReceived: Boolean(token) };
}

async function disconnectGoogleAccount() {
  try {
    const token = await getAuthToken(false);
    if (token) await removeCachedToken(token);
  } catch (_) {}

  try {
    await chrome.identity.clearAllCachedAuthTokens();
  } catch (_) {}

  await chrome.storage.local.set({
    sheetsConnected: false,
    sheetsMode: null,
    sheetsWebhookUrl: null,
    sheetsSpreadsheetId: null,
    sheetsSpreadsheetUrl: null,
    sheetsSyncedIds: [],
  });

  return { ok: true };
}

async function createSpreadsheet() {
  if (!isOAuthConfigured()) {
    return { ok: false, error: "OAuth not configured. Use Apps Script connect instead." };
  }

  const token = await getAuthToken(true);
  const title = `Cars24 Crawler - ${new Date().toLocaleDateString("en-IN")}`;

  const sheet = await sheetsFetch("", token, {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: SHEET_TAB } }],
    }),
  });

  const spreadsheetId = sheet.spreadsheetId;
  const spreadsheetUrl = sheet.spreadsheetUrl;

  await chrome.storage.local.set({
    sheetsConnected: true,
    sheetsMode: "oauth",
    sheetsSpreadsheetId: spreadsheetId,
    sheetsSpreadsheetUrl: spreadsheetUrl,
    sheetsSyncedIds: [],
  });

  await ensureHeaders(token, spreadsheetId);
  return { ok: true, spreadsheetId, spreadsheetUrl };
}

async function linkSpreadsheet(urlOrId) {
  if (!isOAuthConfigured()) {
    return { ok: false, error: "OAuth not configured. Use Apps Script connect instead." };
  }

  const spreadsheetId = parseSpreadsheetId(urlOrId);
  if (!spreadsheetId) {
    return { ok: false, error: "Invalid Google Sheet URL or ID" };
  }

  const token = await getAuthToken(true);
  await sheetsFetch(`/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title`, token);

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  await chrome.storage.local.set({
    sheetsConnected: true,
    sheetsMode: "oauth",
    sheetsSpreadsheetId: spreadsheetId,
    sheetsSpreadsheetUrl: spreadsheetUrl,
  });

  await ensureHeaders(token, spreadsheetId);
  return { ok: true, spreadsheetId, spreadsheetUrl };
}

async function resolveSheetTab(token, spreadsheetId) {
  const meta = await sheetsFetch(`/${spreadsheetId}?fields=sheets.properties`, token);
  const hasVehicles = meta.sheets?.some((s) => s.properties?.title === SHEET_TAB);
  if (hasVehicles) return SHEET_TAB;

  await sheetsFetch(`/${spreadsheetId}:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
    }),
  });

  return SHEET_TAB;
}

async function ensureHeaders(token, spreadsheetId) {
  const tab = await resolveSheetTab(token, spreadsheetId);
  const range = `${tab}!A1:V1`;
  const existing = await sheetsFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    token
  );

  if (existing.values?.length > 0) return tab;

  await sheetsFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ values: [SHEET_FIELDS] }),
    }
  );

  return tab;
}

async function appendViaOAuth(vehicle, cfg) {
  const token = await getAuthToken(false);
  const spreadsheetId = cfg.sheetsSpreadsheetId;
  const tab = await ensureHeaders(token, spreadsheetId);
  const range = `${tab}!A:V`;

  await sheetsFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ values: [vehicleToRow(vehicle)] }),
    }
  );
}

// ─── Unified append ────────────────────────────────────────────────────────────

async function appendVehicleToSheet(vehicle) {
  const cfg = await getSheetsConfig();

  if (!cfg.sheetsConnected) {
    return { ok: false, error: "Google Sheets not connected" };
  }

  if (cfg.sheetsAutoSync === false) {
    return { ok: false, error: "Auto-sync disabled" };
  }

  if (!vehicle?.vehicleId) {
    return { ok: false, error: "Invalid vehicle data" };
  }

  const syncedIds = new Set(cfg.sheetsSyncedIds || []);
  if (syncedIds.has(vehicle.vehicleId)) {
    return { ok: true, skipped: true };
  }

  if (cfg.sheetsMode === "webhook") {
    if (!cfg.sheetsWebhookUrl) {
      return { ok: false, error: "Webhook URL missing — reconnect Apps Script" };
    }
    await appendViaWebhook(vehicle, cfg);
  } else {
    if (!cfg.sheetsSpreadsheetId) {
      return { ok: false, error: "No spreadsheet linked — create or link a sheet" };
    }
    await appendViaOAuth(vehicle, cfg);
  }

  syncedIds.add(vehicle.vehicleId);
  await chrome.storage.local.set({ sheetsSyncedIds: [...syncedIds] });
  return { ok: true, vehicleId: vehicle.vehicleId };
}

async function syncAllVehiclesToSheet() {
  const { crawlVehicles = [] } = await chrome.storage.local.get("crawlVehicles");

  if (crawlVehicles.length === 0) {
    return { ok: false, error: "No vehicles to sync" };
  }

  let synced = 0;
  let skipped = 0;
  const errors = [];

  for (const vehicle of crawlVehicles) {
    try {
      const result = await appendVehicleToSheet(vehicle);
      if (result.ok && result.skipped) skipped++;
      else if (result.ok) synced++;
      else errors.push(result.error);
    } catch (err) {
      errors.push(err.message);
    }
  }

  return {
    ok: true,
    synced,
    skipped,
    total: crawlVehicles.length,
    errors: errors.length ? errors.slice(0, 3) : null,
  };
}
