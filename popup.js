const $ = (id) => document.getElementById(id);

const els = {
  status: $("status"),
  vehicleCount: $("vehicleCount"),
  scrollCount: $("scrollCount"),
  progressFill: $("progressFill"),
  statusMessage: $("statusMessage"),
  startBtn: $("startBtn"),
  pauseBtn: $("pauseBtn"),
  stopBtn: $("stopBtn"),
  extractBtn: $("extractBtn"),
  exportJsonBtn: $("exportJsonBtn"),
  exportCsvBtn: $("exportCsvBtn"),
  visitDetails: $("visitDetails"),
  scrollDelayMin: $("scrollDelayMin"),
  scrollDelayMax: $("scrollDelayMax"),
  detailDelayMin: $("detailDelayMin"),
  detailDelayMax: $("detailDelayMax"),
  maxScrolls: $("maxScrolls"),
  fastModeHint: $("fastModeHint"),
  sheetsStatusText: $("sheetsStatusText"),
  sheetsSetup: $("sheetsSetup"),
  webhookUrl: $("webhookUrl"),
  connectWebhookBtn: $("connectWebhookBtn"),
  connectGoogleBtn: $("connectGoogleBtn"),
  sheetsActions: $("sheetsActions"),
  createSheetBtn: $("createSheetBtn"),
  sheetUrl: $("sheetUrl"),
  linkSheetBtn: $("linkSheetBtn"),
  oauthHint: $("oauthHint"),
  extensionId: $("extensionId"),
  sheetsAutoSync: $("sheetsAutoSync"),
  openSheetLink: $("openSheetLink"),
  syncAllBtn: $("syncAllBtn"),
  disconnectGoogleBtn: $("disconnectGoogleBtn"),
};

let isPaused = false;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url?.includes("cars24.com")) {
    setStatusMessage("Please open a Cars24 listing page first.");
    return null;
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    setStatusMessage("Content script not loaded. Refresh the Cars24 page.");
    return null;
  }
}

function updateFastModeHint() {
  if (els.visitDetails.checked) {
    els.fastModeHint.textContent = "Detail mode — slower, fetches full car page for each card.";
    els.fastModeHint.style.color = "#6b7280";
  } else {
    els.fastModeHint.textContent = "Fast listing mode — scrapes card data only (~5–10× faster).";
    els.fastModeHint.style.color = "#059669";
  }
}

function getSettings() {
  const visitDetails = els.visitDetails.checked;
  return {
    visitDetails,
    scrollDelayMinMs: visitDetails
      ? parseFloat(els.scrollDelayMin.value) * 1000
      : 400,
    scrollDelayMaxMs: visitDetails
      ? parseFloat(els.scrollDelayMax.value) * 1000
      : 800,
    detailDelayMinMs: parseFloat(els.detailDelayMin.value) * 1000,
    detailDelayMaxMs: parseFloat(els.detailDelayMax.value) * 1000,
    longPauseMinMs: 8000,
    longPauseMaxMs: 18000,
    scrollMinPx: 250,
    scrollMaxPx: 700,
    maxScrolls: parseInt(els.maxScrolls.value, 10),
    maxNoNewScrolls: 8,
  };
}

function setRunningUI(running, paused = false) {
  els.startBtn.disabled = running;
  els.pauseBtn.disabled = !running;
  els.stopBtn.disabled = !running;
  els.pauseBtn.textContent = paused ? "Resume" : "Pause";
  els.status.textContent = running ? (paused ? "Paused" : "Running") : "Idle";
}

function setStatusMessage(msg) {
  els.statusMessage.textContent = msg;
}

function updateUI(data) {
  if (data.vehicleCount != null) els.vehicleCount.textContent = data.vehicleCount;
  if (data.scrollCount != null) els.scrollCount.textContent = data.scrollCount;

  if (data.phase === "scrolling" && data.running) {
    const pct = Math.min((data.scrollCount / parseInt(els.maxScrolls.value, 10)) * 100, 100);
    els.progressFill.style.width = pct + "%";
  } else if (data.phase === "details" && data.detailTotal > 0) {
    const pct = (data.detailIndex / data.detailTotal) * 100;
    els.progressFill.style.width = pct + "%";
  } else if (data.phase === "done") {
    els.progressFill.style.width = "100%";
    setRunningUI(false);
  }

  if (data.running != null) setRunningUI(data.running, data.paused);
}

async function refreshState() {
  const stored = await chrome.storage.local.get([
    "crawlVehicles",
    "crawlRunning",
    "crawlFinishedAt",
  ]);

  if (stored.crawlVehicles) {
    els.vehicleCount.textContent = stored.crawlVehicles.length;
  }

  const state = await sendToContent({ type: "GET_STATE" });
  if (state) {
    updateUI(state);
    if (state.running) setRunningUI(true, state.paused);
  } else if (stored.crawlRunning) {
    setRunningUI(true);
    setStatusMessage("Crawl in progress — highlighting cards right to left…");
  }
}

// ─── Event listeners ─────────────────────────────────────────────────────────

els.visitDetails.addEventListener("change", updateFastModeHint);

els.startBtn.addEventListener("click", async () => {
  const settings = getSettings();
  await chrome.storage.local.set({ crawlSettings: settings });
  setRunningUI(true);
  setStatusMessage("Starting crawl…");
  await sendToContent({ type: "START_CRAWL", settings });
});

els.pauseBtn.addEventListener("click", async () => {
  if (isPaused) {
    await sendToContent({ type: "RESUME_CRAWL" });
    isPaused = false;
  } else {
    await sendToContent({ type: "PAUSE_CRAWL" });
    isPaused = true;
  }
  setRunningUI(true, isPaused);
});

els.stopBtn.addEventListener("click", async () => {
  await sendToContent({ type: "STOP_CRAWL" });
  await chrome.storage.local.set({ crawlRunning: false });
  setRunningUI(false);
  isPaused = false;
  setStatusMessage("Crawl stopped.");
});

els.extractBtn.addEventListener("click", async () => {
  const res = await sendToContent({ type: "EXTRACT_NOW" });
  if (res) {
    setStatusMessage(`Extracted ${res.newCount} new (${res.total} total).`);
    els.vehicleCount.textContent = res.total;
  }
});

async function handleExport(type) {
  setStatusMessage("Preparing export…");
  const res = await sendToBackground({ type });
  if (res?.ok) {
    setStatusMessage(`Exported ${res.count} vehicles → ${res.filename}`);
  } else {
    setStatusMessage(res?.error || "Export failed — reload extension and try again.");
  }
}

els.exportJsonBtn.addEventListener("click", () => handleExport("EXPORT_JSON"));
els.exportCsvBtn.addEventListener("click", () => handleExport("EXPORT_CSV"));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CRAWL_PROGRESS") updateUI(msg);
  if (msg.type === "CRAWL_STATUS") setStatusMessage(msg.message);
  if (msg.type === "CRAWL_COMPLETE") {
    setRunningUI(false);
    els.vehicleCount.textContent = msg.count;
    setStatusMessage(`Crawl complete — ${msg.count} vehicles collected.`);
    els.progressFill.style.width = "100%";
  }
});

// Load saved settings
chrome.storage.local.get("crawlSettings").then(({ crawlSettings }) => {
  if (!crawlSettings) return;
  els.visitDetails.checked = crawlSettings.visitDetails ?? false;
  if (crawlSettings.scrollDelayMinMs) els.scrollDelayMin.value = crawlSettings.scrollDelayMinMs / 1000;
  if (crawlSettings.scrollDelayMaxMs) els.scrollDelayMax.value = crawlSettings.scrollDelayMaxMs / 1000;
  if (crawlSettings.detailDelayMinMs) els.detailDelayMin.value = crawlSettings.detailDelayMinMs / 1000;
  if (crawlSettings.detailDelayMaxMs) els.detailDelayMax.value = crawlSettings.detailDelayMaxMs / 1000;
  if (crawlSettings.maxScrolls) els.maxScrolls.value = crawlSettings.maxScrolls;
  updateFastModeHint();
});

updateFastModeHint();

// ─── Google Sheets ───────────────────────────────────────────────────────────

async function sendToBackground(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function updateSheetsUI(status) {
  if (!status) return;

  if (status.extensionId) {
    els.extensionId.textContent = status.extensionId;
  }

  if (!status.oauthConfigured) {
    els.oauthHint.textContent = "OAuth not configured — use Apps Script connect above instead.";
  } else {
    els.oauthHint.textContent = "OAuth configured — you can use Google Account connect below.";
  }

  if (status.connected) {
    const modeLabel = status.mode === "webhook" ? "Apps Script" : "OAuth";
    els.sheetsStatusText.textContent = `Connected (${modeLabel}) · ${status.syncedCount} rows saved`;
    els.sheetsSetup.classList.add("hidden");
    els.sheetsActions.classList.remove("hidden");

    if (status.spreadsheetUrl) {
      els.openSheetLink.classList.remove("hidden");
      els.openSheetLink.href = status.spreadsheetUrl;
    } else {
      els.openSheetLink.classList.add("hidden");
    }

    if (status.webhookUrl) els.webhookUrl.value = status.webhookUrl;
    if (status.spreadsheetUrl) els.sheetUrl.value = status.spreadsheetUrl;
  } else {
    els.sheetsStatusText.textContent = "Connect a Google Sheet to auto-save crawled data";
    els.sheetsSetup.classList.remove("hidden");
    els.sheetsActions.classList.add("hidden");
    els.openSheetLink.classList.add("hidden");
  }

  els.sheetsAutoSync.checked = status.autoSync !== false;
}

async function refreshSheetsStatus() {
  const status = await sendToBackground({ type: "SHEETS_STATUS" });
  updateSheetsUI(status);
}

els.connectWebhookBtn.addEventListener("click", async () => {
  const webhookUrl = els.webhookUrl.value.trim();
  const sheetUrl = els.sheetUrl.value.trim();
  if (!webhookUrl) {
    setStatusMessage("Paste your Apps Script Web App URL first.");
    return;
  }
  setStatusMessage("Connecting to Google Sheet…");
  els.connectWebhookBtn.disabled = true;
  const res = await sendToBackground({ type: "SHEETS_CONNECT_WEBHOOK", webhookUrl, sheetUrl });
  els.connectWebhookBtn.disabled = false;
  if (res?.ok) {
    setStatusMessage("Sheet connected! Vehicles will auto-save during crawl.");
    await refreshSheetsStatus();
  } else {
    setStatusMessage(res?.error || "Connect failed — check Web App URL and deployment.");
  }
});

els.connectGoogleBtn.addEventListener("click", async () => {
  setStatusMessage("Connecting to Google…");
  const res = await sendToBackground({ type: "SHEETS_CONNECT" });
  if (res?.ok) {
    setStatusMessage("Google account connected! Now create or link a spreadsheet.");
    await refreshSheetsStatus();
  } else {
    setStatusMessage(res?.error || "Google connect failed.");
  }
});

els.createSheetBtn.addEventListener("click", async () => {
  setStatusMessage("Creating spreadsheet…");
  els.createSheetBtn.disabled = true;
  const res = await sendToBackground({ type: "SHEETS_CREATE" });
  els.createSheetBtn.disabled = false;
  if (res?.ok) {
    setStatusMessage("Spreadsheet created! Data will auto-save during crawl.");
    await refreshSheetsStatus();
  } else {
    setStatusMessage(res?.error || "Failed to create spreadsheet.");
  }
});

els.linkSheetBtn.addEventListener("click", async () => {
  const url = els.sheetUrl.value.trim();
  if (!url || !url.includes("spreadsheets")) {
    setStatusMessage("Paste a Google Sheet URL in the Sheet URL field first.");
    return;
  }
  setStatusMessage("Linking spreadsheet…");
  const res = await sendToBackground({ type: "SHEETS_LINK", url });
  if (res?.ok) {
    setStatusMessage("Sheet linked! Data will auto-save during crawl.");
    await refreshSheetsStatus();
  } else {
    setStatusMessage(res?.error || "Failed to link spreadsheet.");
  }
});

els.sheetsAutoSync.addEventListener("change", async () => {
  await sendToBackground({ type: "SHEETS_SET_AUTO_SYNC", enabled: els.sheetsAutoSync.checked });
});

els.syncAllBtn.addEventListener("click", async () => {
  setStatusMessage("Syncing all vehicles to sheet…");
  els.syncAllBtn.disabled = true;
  const res = await sendToBackground({ type: "SHEETS_SYNC_ALL" });
  els.syncAllBtn.disabled = false;
  if (res?.ok) {
    setStatusMessage(`Synced ${res.synced} new rows (${res.skipped} already in sheet).`);
    await refreshSheetsStatus();
  } else {
    setStatusMessage(res?.error || "Sync failed.");
  }
});

els.disconnectGoogleBtn.addEventListener("click", async () => {
  await sendToBackground({ type: "SHEETS_DISCONNECT" });
  setStatusMessage("Google account disconnected.");
  els.sheetUrl.value = "";
  await refreshSheetsStatus();
});

refreshState();
refreshSheetsStatus();
