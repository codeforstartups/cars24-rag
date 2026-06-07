/**
 * Service worker — export, persistence, detail fetching, Google Sheets sync.
 */

importScripts("sheets.js");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    EXPORT_JSON: () => exportData("json"),
    EXPORT_CSV: () => exportData("csv"),
    FETCH_DETAIL: () => fetchDetailPage(msg.url, msg.delayMs),
    SHEETS_STATUS: () => getSheetsStatus(),
    SHEETS_CONNECT: () => connectGoogleAccount(),
    SHEETS_DISCONNECT: () => disconnectGoogleAccount(),
    SHEETS_CREATE: () => createSpreadsheet(),
    SHEETS_LINK: () => linkSpreadsheet(msg.url),
    SHEETS_CONNECT_WEBHOOK: () => connectViaWebhook(msg.webhookUrl, msg.sheetUrl),
    SHEETS_OAUTH_STATUS: () => getOAuthSetupStatus(),
    SHEETS_APPEND_VEHICLE: () => appendVehicleToSheet(msg.vehicle),
    SHEETS_SYNC_ALL: () => syncAllVehiclesToSheet(),
    SHEETS_SET_AUTO_SYNC: () =>
      chrome.storage.local.set({ sheetsAutoSync: msg.enabled }).then(() => ({ ok: true })),
  };

  const handler = handlers[msg.type];
  if (handler) {
    handler().then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(check);
      reject(new Error("Detail page load timed out"));
    }, timeoutMs);

    const check = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(check);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    }).catch((err) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(check);
      reject(err);
    });
  });
}

async function fetchDetailPage(url, delayMs = 2500) {
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    await waitForTabComplete(tabId, 30000);
    await sleep(Math.min(delayMs, 10000));

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: parseDetailPageInTab,
    });

    if (!result?.result) {
      return { ok: false, error: "Could not parse detail page" };
    }

    return { ok: true, data: result.result };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (tabId != null) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (_) {}
    }
  }
}

function parseDetailPageInTab() {
  const VEHICLE_ID_RE = /-(\d{8,})\/?$/;
  const url = window.location.href.split("?")[0];
  const idMatch = url.match(VEHICLE_ID_RE);
  if (!idMatch) return null;

  const vehicleId = idMatch[1];
  const h1 = document.querySelector("h1");
  const title = h1?.innerText?.trim() || document.title.split("|")[0].trim();
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);

  const specs = {};
  document.querySelectorAll("li, span, [class*='spec'], [class*='detail']").forEach((el) => {
    const t = el.innerText?.trim();
    if (!t || t.length > 80) return;
    if (/^\d[\d,]*\s*km$/i.test(t)) specs.mileage = t;
    if (/^(Petrol|Diesel|CNG|Electric|Hybrid)$/i.test(t)) specs.fuel = t;
    if (/^(Manual|Automatic|Auto|AMT|CVT|DCT)$/i.test(t)) specs.transmission = t;
    if (/^[A-Z]{2}-\d{1,2}[A-Z]?$/.test(t)) specs.rto = t;
    if (/^\d{1,2}(st|nd|rd|th)\s+Owner$/i.test(t)) specs.owners = t;
  });

  const priceEl = document.querySelector("[class*='price'], [class*='Price']");
  const price = priceEl?.innerText?.trim() || null;

  const images = [
    ...document.querySelectorAll("img[src*='media.cars24.com'], img[src*='cars24']"),
  ]
    .map((img) => img.src)
    .filter((src, i, arr) => arr.indexOf(src) === i)
    .slice(0, 10);

  return {
    vehicleId,
    detailUrl: url,
    title,
    year: yearMatch ? parseInt(yearMatch[0], 10) : null,
    mileage: specs.mileage || null,
    fuel: specs.fuel || null,
    transmission: specs.transmission || null,
    rto: specs.rto || null,
    owners: specs.owners || null,
    price,
    images,
    detailScrapedAt: new Date().toISOString(),
    source: "detail",
  };
}

function toDownloadDataUrl(content, mimeType) {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function exportData(format) {
  const { crawlVehicles = [] } = await chrome.storage.local.get("crawlVehicles");

  if (crawlVehicles.length === 0) {
    return { ok: false, error: "No vehicles collected yet." };
  }

  let content, mimeType, filename;

  if (format === "csv") {
    content = vehiclesToCsv(crawlVehicles);
    mimeType = "text/csv;charset=utf-8";
    filename = `cars24-vehicles-${dateStamp()}.csv`;
  } else {
    content = JSON.stringify(crawlVehicles, null, 2);
    mimeType = "application/json;charset=utf-8";
    filename = `cars24-vehicles-${dateStamp()}.json`;
  }

  const url = toDownloadDataUrl(content, mimeType);
  const downloadId = await chrome.downloads.download({ url, filename, saveAs: true });
  return { ok: true, count: crawlVehicles.length, filename, downloadId };
}

function dateStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function vehiclesToCsv(vehicles) {
  const fields = [
    "vehicleId", "title", "make", "model", "variant", "year", "detailUrl",
    "price", "originalPrice", "emi", "mileage", "fuel", "transmission", "rto",
    "owners", "location", "badge", "imageUrl", "scrapedAt", "detailScrapedAt",
    "source", "fetchError",
  ];

  const escape = (val) => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = fields.join(",");
  const rows = vehicles.map((v) => fields.map((f) => escape(v[f])).join(","));
  return [header, ...rows].join("\n");
}
