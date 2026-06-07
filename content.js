/**
 * Cars24 listing crawler — runs in page context.
 * Scrolls human-like, extracts vehicle cards, optionally visits detail pages.
 */

const VEHICLE_URL_RE = /\/buy-used-[a-z0-9-]+-\d{8,}\/?$/i;
const VEHICLE_ID_RE = /-(\d{8,})\/?$/;

const HIGHLIGHT_STYLE_ID = "cars24-crawler-highlight-styles";

let crawlState = {
  running: false,
  paused: false,
  phase: "idle",
  vehicles: new Map(),
  processedCardIds: new Set(),
  detailIndex: 0,
  scrollCount: 0,
  noNewCount: 0,
  settings: {},
};

// ─── Utilities ───────────────────────────────────────────────────────────────

const SESSION_BACKUP_KEY = "cars24-crawler-backup";

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function humanDelay(minMs, maxMs) {
  await sleep(randomBetween(minMs, maxMs));
}

function isExtensionValid() {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function backupToSession(data) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(SESSION_BACKUP_KEY) || "{}");
    sessionStorage.setItem(
      SESSION_BACKUP_KEY,
      JSON.stringify({ ...existing, ...data, savedAt: new Date().toISOString() })
    );
  } catch (_) {}
}

async function safeStorageSet(data) {
  backupToSession(data);
  if (!isExtensionValid()) return false;
  try {
    await chrome.storage.local.set(data);
    return true;
  } catch (err) {
    console.warn("[Cars24 Crawler] Storage error:", err.message);
    return false;
  }
}

async function safeStorageGet(keys) {
  if (!isExtensionValid()) {
    try {
      const backup = JSON.parse(sessionStorage.getItem(SESSION_BACKUP_KEY) || "{}");
      if (Array.isArray(keys)) {
        const out = {};
        for (const key of keys) if (key in backup) out[key] = backup[key];
        return out;
      }
      return backup;
    } catch {
      return {};
    }
  }
  try {
    return await chrome.storage.local.get(keys);
  } catch (err) {
    console.warn("[Cars24 Crawler] Storage read error:", err.message);
    return {};
  }
}

async function safeSendMessage(message) {
  if (!isExtensionValid()) return false;
  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (err) {
    console.warn("[Cars24 Crawler] Message error:", err.message);
    return false;
  }
}

function extractVehicleId(url) {
  const match = url.match(VEHICLE_ID_RE);
  return match ? match[1] : null;
}

function isFastListingMode(settings) {
  return !settings?.visitDetails;
}

function isListingPage() {
  return (
    window.location.hostname === "www.cars24.com" &&
    window.location.pathname.includes("/buy-used-cars") &&
    !VEHICLE_URL_RE.test(window.location.pathname)
  );
}

function isDetailPage() {
  return VEHICLE_URL_RE.test(window.location.pathname);
}

// ─── Card highlighting ───────────────────────────────────────────────────────

function injectHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    .crawler-card-active,
    .crawler-card-done {
      position: relative !important;
      overflow: hidden !important;
      border-radius: 12px !important;
      z-index: 2;
      transition: background 0.25s ease;
    }

    .crawler-card-active {
      background: #ffeb3b !important;
      box-shadow: 0 0 0 3px #f9a825 !important;
    }

    .crawler-card-done {
      background: #fff9c4 !important;
      box-shadow: 0 0 0 2px #fff176 !important;
    }

    .crawler-highlight-fill {
      position: absolute !important;
      inset: 0 !important;
      z-index: 0 !important;
      pointer-events: none !important;
      border-radius: inherit !important;
    }

    .crawler-highlight-fill-active {
      background: #ffeb3b !important;
    }

    .crawler-highlight-fill-done {
      background: #fff9c4 !important;
    }

    .crawler-card-active > *:not(.crawler-highlight-fill),
    .crawler-card-done > *:not(.crawler-highlight-fill),
    .crawler-card-active a,
    .crawler-card-active div,
    .crawler-card-active section,
    .crawler-card-active article,
    .crawler-card-active span,
    .crawler-card-active p,
    .crawler-card-active h2,
    .crawler-card-active h3,
    .crawler-card-active h4,
    .crawler-card-done a,
    .crawler-card-done div,
    .crawler-card-done section,
    .crawler-card-done article,
    .crawler-card-done span,
    .crawler-card-done p,
    .crawler-card-done h2,
    .crawler-card-done h3,
    .crawler-card-done h4 {
      background: inherit !important;
      background-color: inherit !important;
    }

    .crawler-card-active,
    .crawler-card-active > *:not(.crawler-highlight-fill),
    .crawler-card-active a,
    .crawler-card-active div,
    .crawler-card-active section,
    .crawler-card-active article {
      background: #ffeb3b !important;
      background-color: #ffeb3b !important;
    }

    .crawler-card-done,
    .crawler-card-done > *:not(.crawler-highlight-fill),
    .crawler-card-done a,
    .crawler-card-done div,
    .crawler-card-done section,
    .crawler-card-done article {
      background: #fff9c4 !important;
      background-color: #fff9c4 !important;
    }

    .crawler-card-active *:not(img):not(svg):not(video):not(.crawler-highlight-fill) {
      background-color: #ffeb3b !important;
    }

    .crawler-card-done *:not(img):not(svg):not(video):not(.crawler-highlight-fill) {
      background-color: #fff9c4 !important;
    }
  `;
  document.head.appendChild(style);
}

function getCardRoot(cardEl) {
  return cardEl.closest('[class*="carCardContainer"]') || cardEl;
}

function removeHighlightFill(root) {
  root.querySelectorAll(".crawler-highlight-fill").forEach((el) => el.remove());
}

function highlightCard(cardEl, state) {
  const root = getCardRoot(cardEl);
  root.classList.remove("crawler-card-active", "crawler-card-done");
  removeHighlightFill(root);

  if (!state) return;

  const fill = document.createElement("div");
  fill.className = "crawler-highlight-fill";

  if (state === "active") {
    root.classList.add("crawler-card-active");
    fill.classList.add("crawler-highlight-fill-active");
  }

  if (state === "done") {
    root.classList.add("crawler-card-done");
    fill.classList.add("crawler-highlight-fill-done");
  }

  root.prepend(fill);
}

function clearAllHighlights() {
  document
    .querySelectorAll(".crawler-card-active, .crawler-card-done")
    .forEach((el) => {
      el.classList.remove("crawler-card-active", "crawler-card-done");
      removeHighlightFill(el);
    });
}

function getCardsRightToLeft() {
  const items = findCarCards()
    .map((card) => {
      const root = getCardRoot(card);
      const rect = root.getBoundingClientRect();
      return { card, root, rect };
    })
    .filter(({ rect }) => rect.width > 10 && rect.height > 10)
    .filter(
      ({ rect }) =>
        rect.top < window.innerHeight + 150 && rect.bottom > -150
    );

  const rows = new Map();
  for (const item of items) {
    const rowKey = Math.round(item.rect.top / 100);
    if (!rows.has(rowKey)) rows.set(rowKey, []);
    rows.get(rowKey).push(item);
  }

  const sorted = [];
  for (const rowKey of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(rowKey).sort((a, b) => b.rect.right - a.rect.right);
    sorted.push(...row);
  }
  return sorted;
}

async function scrollCardIntoView(root) {
  root.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(randomBetween(500, 900));
}

// ─── DOM extraction ──────────────────────────────────────────────────────────

function findCarCards() {
  const cards = new Set();

  // Primary: links with vehicle detail URLs
  document.querySelectorAll('a[href*="/buy-used-"]').forEach((link) => {
    const href = link.href?.split("?")[0];
    if (href && VEHICLE_URL_RE.test(new URL(href).pathname)) {
      cards.add(link.closest('[class*="carCardContainer"]') || link);
    }
  });

  // Fallback: card containers
  document.querySelectorAll('[class*="carCardContainer"]').forEach((el) => {
    const link = el.querySelector('a[href*="/buy-used-"]');
    if (link) cards.add(el);
  });

  return [...cards];
}

const BADGE_RE =
  /^(Cars24 Owned Stock|Verified Direct Seller|Direct Seller|Partner Stock)\s*/i;

const KNOWN_MAKES = [
  "Maruti Suzuki", "Mercedes Benz", "Land Rover", "Maruti", "Hyundai", "Mahindra",
  "Volkswagen", "CITROEN", "Hindustan Motors", "Mahindra Renault", "Renault",
  "Tata", "Honda", "Toyota", "Ford", "Nissan", "Skoda", "Jeep", "KIA", "MG",
  "Audi", "BMW", "Datsun", "Fiat", "Chevrolet", "Mitsubishi", "Ssangyong",
  "Volvo", "Porsche", "Lexus", "Mini", "Isuzu",
];

function normalizeText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

function stripBadge(text) {
  return normalizeText(text.replace(BADGE_RE, ""));
}

function parseTitleFromUrl(href) {
  try {
    const path = new URL(href).pathname;
    const match = path.match(/\/buy-used-(.+)-((?:19|20)\d{2})-cars-[^/]+-\d{8,}\/?$/i);
    if (!match) return { title: null, year: null, make: null, model: null };

    const slug = match[1];
    const year = parseInt(match[2], 10);
    const name = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return { title: `${year} ${name}`, year, make: name.split(" ")[0], model: null };
  } catch {
    return { title: null, year: null, make: null, model: null };
  }
}

function parseTitleFromCardText(text) {
  const cleaned = stripBadge(text);
  if (!cleaned) return null;

  const kmIdx = cleaned.search(/\d[\d,]*\s*km/i);
  if (kmIdx > 0) return cleaned.slice(0, kmIdx).trim();

  const emiIdx = cleaned.search(/\bEMI\b/i);
  if (emiIdx > 0) return cleaned.slice(0, emiIdx).trim();

  return cleaned.slice(0, 120).trim();
}

function extractCarTitle(cardEl, link, href) {
  const carNameEl = cardEl.querySelector('[class*="carName"]');
  if (carNameEl) {
    const name = normalizeText(carNameEl.innerText);
    if (name && name.length > 6 && !BADGE_RE.test(name)) return name;
  }

  const ariaLabel = link.getAttribute("aria-label") || link.getAttribute("title");
  if (ariaLabel) {
    const parsed = parseTitleFromCardText(ariaLabel);
    if (parsed && parsed.length > 6) return parsed;
  }

  const linkTitle = parseTitleFromCardText(link.innerText);
  if (linkTitle && linkTitle.length > 6) return linkTitle;

  const cardTitle = parseTitleFromCardText(cardEl.innerText);
  if (cardTitle && cardTitle.length > 6) return cardTitle;

  return parseTitleFromUrl(href).title;
}

function parseMakeModelVariant(title) {
  if (!title) return { make: null, model: null, variant: null, year: null };

  const yearMatch = title.match(/^((?:19|20)\d{2})\s+(.+)$/);
  if (!yearMatch) return { make: null, model: null, variant: title, year: null };

  const year = parseInt(yearMatch[1], 10);
  let remainder = yearMatch[2].trim();

  let make = null;
  for (const known of KNOWN_MAKES.sort((a, b) => b.length - a.length)) {
    if (remainder.toLowerCase().startsWith(known.toLowerCase())) {
      make = known;
      remainder = remainder.slice(known.length).trim();
      break;
    }
  }

  if (!make) {
    const parts = remainder.split(/\s+/);
    make = parts[0] || null;
    remainder = parts.slice(1).join(" ");
  }

  const modelParts = remainder.split(/\s+/);
  const model = modelParts.length > 1 ? modelParts[0] : remainder || null;
  const variant =
    modelParts.length > 1 ? modelParts.slice(1).join(" ") : null;

  return { make, model, variant, year };
}

function extractCardSpec(cardEl, classKey) {
  const el = cardEl.querySelector(`[class*="${classKey}"]`);
  return el ? normalizeText(el.innerText) : null;
}

function parseListingCard(cardEl) {
  const link =
    cardEl.tagName === "A"
      ? cardEl
      : cardEl.querySelector('a[href*="/buy-used-"]');
  if (!link) return null;

  const href = link.href.split("?")[0];
  if (!VEHICLE_URL_RE.test(new URL(href).pathname)) return null;

  const vehicleId = extractVehicleId(href);
  if (!vehicleId) return null;

  const rawText = normalizeText(cardEl.innerText || link.innerText || "");
  const badgeMatch = rawText.match(BADGE_RE);
  const badge = badgeMatch ? badgeMatch[0].trim() : null;

  let title = extractCarTitle(cardEl, link, href);
  let { make, model, variant, year } = parseMakeModelVariant(title);

  if (!year || !title) {
    const fromUrl = parseTitleFromUrl(href);
    if (!year && fromUrl.year) year = fromUrl.year;
    if ((!title || BADGE_RE.test(title)) && fromUrl.title) {
      title = fromUrl.title;
      const parsed = parseMakeModelVariant(title);
      make = make || parsed.make;
      model = model || parsed.model;
      variant = variant || parsed.variant;
      year = year || parsed.year;
    }
  }

  const text = stripBadge(rawText);

  let mileage = extractCardSpec(cardEl, "km__");
  if (!mileage) {
    const kmMatch = text.match(/([\d,]+)\s*km/i);
    mileage = kmMatch ? kmMatch[1].replace(/,/g, "") + " km" : null;
  }

  let fuel = extractCardSpec(cardEl, "fuel__");
  if (!fuel) {
    const fuelTypes = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"];
    fuel = fuelTypes.find((f) => new RegExp(`\\b${f}\\b`, "i").test(text)) || null;
  }

  const transmissions = ["Manual", "Automatic", "Auto", "AMT", "CVT", "DCT"];
  let transmission =
    transmissions.find((t) => new RegExp(`\\b${t}\\b`, "i").test(text)) || null;

  const rtoMatch = text.match(/\b([A-Z]{2}-\d{1,2}[A-Z]?)\b/);
  const rto = rtoMatch ? rtoMatch[1] : null;

  const emiMatch = text.match(/EMI\s*₹([\d,]+)\/m/i);
  const emi = emiMatch ? "₹" + emiMatch[1] + "/m" : null;

  const priceMatches = [...text.matchAll(/₹([\d,.]+)\s*(lakh|L|cr)?/gi)];
  let price = null;
  let originalPrice = null;
  if (priceMatches.length > 0) {
    const last = priceMatches[priceMatches.length - 1];
    price = "₹" + last[1] + (last[2] ? " " + last[2] : "");
    if (priceMatches.length > 1) {
      const prev = priceMatches[priceMatches.length - 2];
      originalPrice = "₹" + prev[1] + (prev[2] ? " " + prev[2] : "");
    }
  }

  let location = null;
  const locationEl = cardEl.querySelector('[class*="location"], [class*="hub"], [class*="address"]');
  if (locationEl) {
    location = normalizeText(locationEl.innerText);
  }
  if (!location) {
    const locationMatch = text.match(/\+ other charges\s+(.+)$/i);
    location = locationMatch ? locationMatch[1].trim() : null;
  }
  if (!location) {
    const lines = (cardEl.innerText || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    location = lines.length > 0 ? lines[lines.length - 1] : null;
  }
  if (location && BADGE_RE.test(location)) location = null;

  const imageEl = cardEl.querySelector("img[class*='carImg'], img");
  const imageUrl = imageEl?.src || imageEl?.dataset?.src || null;

  return {
    vehicleId,
    detailUrl: href,
    title,
    make,
    model,
    variant,
    year,
    mileage,
    fuel,
    transmission,
    rto,
    emi,
    price,
    originalPrice,
    location,
    badge,
    imageUrl,
    scrapedAt: new Date().toISOString(),
    source: "listing",
  };
}

function extractAllVisibleVehicles() {
  const cards = findCarCards();
  let newCount = 0;

  for (const card of cards) {
    const vehicle = parseListingCard(card);
    if (vehicle && !crawlState.vehicles.has(vehicle.vehicleId)) {
      crawlState.vehicles.set(vehicle.vehicleId, vehicle);
      newCount++;
    }
  }

  return newCount;
}

// ─── Detail page extraction ──────────────────────────────────────────────────

function parseDetailPage() {
  const url = window.location.href.split("?")[0];
  const vehicleId = extractVehicleId(url);
  if (!vehicleId) return null;

  const h1 = document.querySelector("h1");
  const title = h1?.innerText?.trim() || document.title.split("|")[0].trim();

  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const bodyText = document.body.innerText;

  const specs = {};
  document.querySelectorAll("[class*='spec'], [class*='detail'], li, span").forEach((el) => {
    const t = el.innerText?.trim();
    if (!t || t.length > 80) return;
    if (/^\d[\d,]*\s*km$/i.test(t)) specs.mileage = t;
    if (/^(Petrol|Diesel|CNG|Electric|Hybrid)$/i.test(t)) specs.fuel = t;
    if (/^(Manual|Automatic|Auto|AMT)$/i.test(t)) specs.transmission = t;
    if (/^[A-Z]{2}-\d{1,2}[A-Z]?$/.test(t)) specs.rto = t;
    if (/^\d{1,2}(st|nd|rd|th)\s+Owner$/i.test(t)) specs.owners = t;
  });

  const priceEl = document.querySelector("[class*='price'], [class*='Price']");
  const price = priceEl?.innerText?.trim() || null;

  const images = [...document.querySelectorAll("img[src*='media.cars24.com'], img[src*='cars24']")]
    .map((img) => img.src)
    .filter((src, i, arr) => arr.indexOf(src) === i)
    .slice(0, 10);

  const existing = crawlState.vehicles.get(vehicleId) || {};

  return {
    ...existing,
    vehicleId,
    detailUrl: url,
    title,
    year: yearMatch ? parseInt(yearMatch[0], 10) : existing.year,
    mileage: specs.mileage || existing.mileage,
    fuel: specs.fuel || existing.fuel,
    transmission: specs.transmission || existing.transmission,
    rto: specs.rto || existing.rto,
    owners: specs.owners || null,
    price: price || existing.price,
    images,
    detailScrapedAt: new Date().toISOString(),
    source: "detail",
  };
}

// ─── Human-like scrolling ────────────────────────────────────────────────────

async function humanScroll() {
  const settings = crawlState.settings;
  const fast = isFastListingMode(settings);
  const direction = fast ? 1 : Math.random() < 0.08 ? -1 : 1;
  const amount = randomBetween(
    fast ? 400 : settings.scrollMinPx || 250,
    fast ? 900 : settings.scrollMaxPx || 700
  );

  window.scrollBy({ top: direction * amount, behavior: fast ? "auto" : "smooth" });
  crawlState.scrollCount++;

  if (fast) {
    await humanDelay(
      settings.scrollDelayMinMs || 400,
      settings.scrollDelayMaxMs || 800
    );
    return;
  }

  // Longer pause every ~8-15 scrolls (simulates reading)
  if (crawlState.scrollCount % randomBetween(8, 15) === 0) {
    await broadcastStatus("Taking a short reading pause…");
    await humanDelay(
      settings.longPauseMinMs || 8000,
      settings.longPauseMaxMs || 18000
    );
  } else {
    await humanDelay(
      settings.scrollDelayMinMs || 1500,
      settings.scrollDelayMaxMs || 4000
    );
  }
}

async function fetchDetailInBackground(url, retries = 2) {
  const settings = crawlState.settings;
  const delayMs = randomBetween(
    settings.detailDelayMinMs || 3000,
    settings.detailDelayMaxMs || 8000
  );

  if (!isExtensionValid()) {
    return { ok: false, error: "Extension context invalidated — refresh page after reloading extension" };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: "FETCH_DETAIL",
        url,
        delayMs,
      });
      if (result?.ok) return result;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    } catch (err) {
      console.warn(`[Cars24 Crawler] Detail fetch attempt ${attempt + 1} failed:`, err.message);
      if (attempt < retries) await sleep(1500 * (attempt + 1));
      else return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: "Detail fetch failed after retries" };
}

async function persistCrawlData() {
  await safeStorageSet({
    crawlVehicles: [...crawlState.vehicles.values()],
    crawlProcessedIds: [...crawlState.processedCardIds],
    crawlRunning: crawlState.running,
  });
}

async function syncVehicleToSheets(vehicle, { awaitResult = true } = {}) {
  if (!vehicle?.vehicleId || !isExtensionValid()) return;

  const doSync = async () => {
    try {
      const result = await chrome.runtime.sendMessage({
        type: "SHEETS_APPEND_VEHICLE",
        vehicle,
      });

      if (result?.ok && !result.skipped) {
        await broadcastStatus(`Saved to Google Sheet: ${vehicle.title || vehicle.vehicleId}`);
      } else if (result?.error && !result.error.includes("not connected") && !result.error.includes("Auto-sync disabled")) {
        console.warn("[Cars24 Crawler] Sheets sync:", result.error);
      }
    } catch (err) {
      console.warn("[Cars24 Crawler] Sheets sync failed (continuing):", err.message);
    }
  };

  if (awaitResult) await doSync();
  else doSync();
}

async function processSingleCard(card, root, settings) {
  const fast = isFastListingMode(settings);
  const vehicle = parseListingCard(card);
  if (!vehicle) return false;
  if (crawlState.processedCardIds.has(vehicle.vehicleId)) return false;

  if (fast) {
    highlightCard(card, "active");
  } else {
    await scrollCardIntoView(root);
    highlightCard(card, "active");
  }

  crawlState.vehicles.set(vehicle.vehicleId, vehicle);
  crawlState.detailIndex = crawlState.processedCardIds.size + 1;

  if (!fast || crawlState.processedCardIds.size % 5 === 0) {
    await broadcastStatus(
      `Processing (right→left): ${vehicle.title || vehicle.vehicleId}`
    );
  }

  let fetchError = null;

  if (settings.visitDetails) {
    const result = await fetchDetailInBackground(vehicle.detailUrl);
    if (result?.ok && result.data) {
      crawlState.vehicles.set(vehicle.vehicleId, {
        ...vehicle,
        ...result.data,
        source: "detail",
      });
    } else {
      fetchError = result?.error || "Detail fetch failed";
      crawlState.vehicles.set(vehicle.vehicleId, {
        ...vehicle,
        fetchError,
        source: "listing",
      });
      await humanDelay(
        settings.detailDelayMinMs || 3000,
        settings.detailDelayMaxMs || 8000
      );
    }
  } else {
    await sleep(fast ? 60 : randomBetween(400, 900));
  }

  highlightCard(card, "done");
  crawlState.processedCardIds.add(vehicle.vehicleId);

  const savedVehicle = crawlState.vehicles.get(vehicle.vehicleId);

  if (fast) {
    crawlState.cardsSincePersist = (crawlState.cardsSincePersist || 0) + 1;
    if (crawlState.cardsSincePersist >= 8) {
      await persistCrawlData();
      crawlState.cardsSincePersist = 0;
    }
    syncVehicleToSheets(savedVehicle, { awaitResult: false });
  } else {
    await persistCrawlData();
    await syncVehicleToSheets(savedVehicle);
    await broadcastProgress();
  }

  if (fetchError) {
    console.warn(`[Cars24 Crawler] Skipped detail for ${vehicle.vehicleId}: ${fetchError}`);
  }

  return true;
}

async function processVisibleCardsRightToLeft() {
  const settings = crawlState.settings;
  const cards = getCardsRightToLeft();
  let processedThisPass = 0;

  crawlState.phase = "processing";

  for (const { card, root } of cards) {
    if (!crawlState.running) break;

    while (crawlState.paused) {
      await sleep(500);
    }

    try {
      const didProcess = await processSingleCard(card, root, settings);
      if (didProcess) processedThisPass++;
    } catch (err) {
      console.error("[Cars24 Crawler] Card error (continuing):", err);

      try {
        const vehicle = parseListingCard(card);
        if (vehicle) {
          crawlState.vehicles.set(vehicle.vehicleId, {
            ...vehicle,
            fetchError: err.message,
            source: "listing",
          });
          crawlState.processedCardIds.add(vehicle.vehicleId);
          highlightCard(card, "done");
          await persistCrawlData();
          await syncVehicleToSheets(crawlState.vehicles.get(vehicle.vehicleId));
        }
      } catch (_) {}

      await broadcastStatus(`Skipped one card — continuing…`);
      await sleep(500);
    }
  }

  await persistCrawlData();
  await broadcastProgress();
  return processedThisPass;
}

async function scrollListingPage() {
  const settings = crawlState.settings;
  const fast = isFastListingMode(settings);
  const maxScrolls = settings.maxScrolls || 200;
  const maxNoNew = settings.maxNoNewScrolls || 8;

  injectHighlightStyles();
  crawlState.phase = "scrolling";
  await broadcastStatus(
    fast
      ? "Fast listing mode — scraping cards quickly…"
      : "Crawling — highlighting cards right to left…"
  );

  while (
    crawlState.running &&
    !crawlState.paused &&
    crawlState.scrollCount < maxScrolls &&
    crawlState.noNewCount < maxNoNew
  ) {
    try {
      const prevProcessed = crawlState.processedCardIds.size;

      await processVisibleCardsRightToLeft();

      const processedNow = crawlState.processedCardIds.size - prevProcessed;

      crawlState.phase = "scrolling";
      await humanScroll();
      await sleep(fast ? randomBetween(250, 450) : randomBetween(800, 1500));
      extractAllVisibleVehicles();

      if (processedNow === 0) {
        crawlState.noNewCount++;
      } else {
        crawlState.noNewCount = 0;
      }

      await broadcastProgress();
    } catch (err) {
      console.error("[Cars24 Crawler] Loop error (continuing):", err);
      await broadcastStatus("Hit an error — continuing crawl…");
      await sleep(1000);
    }
  }

  await processVisibleCardsRightToLeft();
  return [...crawlState.vehicles.values()];
}

// ─── Main crawl flow ─────────────────────────────────────────────────────────

async function startCrawl(settings) {
  if (crawlState.running) return;

  crawlState.running = true;
  crawlState.paused = false;
  crawlState.vehicles = new Map();
  crawlState.processedCardIds = new Set();
  crawlState.scrollCount = 0;
  crawlState.noNewCount = 0;
  crawlState.detailIndex = 0;
  crawlState.settings = settings;

  clearAllHighlights();
  await safeStorageSet({
    crawlRunning: true,
    crawlSettings: settings,
    crawlProcessedIds: [],
  });

  if (isListingPage()) {
    try {
      extractAllVisibleVehicles();
      await scrollListingPage();
      await finishCrawl();
    } catch (err) {
      console.error("[Cars24 Crawler] Crawl error:", err);
      await persistCrawlData();
      await broadcastStatus(`Crawl interrupted: ${err.message}. Data saved.`);
      crawlState.running = false;
    }
  } else {
    await broadcastStatus("Navigate to a Cars24 listing page first.");
    crawlState.running = false;
  }
}

async function finishCrawl() {
  crawlState.running = false;
  crawlState.phase = "done";

  const vehicles = [...crawlState.vehicles.values()];

  await safeStorageSet({
    crawlRunning: false,
    crawlVehicles: vehicles,
    crawlFinishedAt: new Date().toISOString(),
    crawlProcessedIds: [...crawlState.processedCardIds],
  });

  await broadcastStatus(`Done! Collected ${vehicles.length} vehicles.`);
  await broadcastProgress();
  await safeSendMessage({ type: "CRAWL_COMPLETE", count: vehicles.length });
}

function stopCrawl() {
  crawlState.running = false;
  crawlState.paused = false;
  clearAllHighlights();
  safeStorageSet({ crawlRunning: false });
  broadcastStatus("Crawl stopped.");
}

function pauseCrawl() {
  crawlState.paused = true;
  broadcastStatus("Crawl paused.");
}

function resumeCrawl() {
  crawlState.paused = false;
  broadcastStatus("Crawl resumed.");
}

async function broadcastProgress() {
  const vehicles = [...crawlState.vehicles.values()];
  await safeSendMessage({
    type: "CRAWL_PROGRESS",
    phase: crawlState.phase,
    vehicleCount: vehicles.length,
    scrollCount: crawlState.scrollCount,
    detailIndex: crawlState.processedCardIds.size,
    detailTotal: crawlState.vehicles.size,
    running: crawlState.running,
    paused: crawlState.paused,
  });
  await safeStorageSet({ crawlVehicles: vehicles });
}

async function broadcastStatus(message) {
  await safeSendMessage({ type: "CRAWL_STATUS", message });
}

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_CRAWL") {
    startCrawl(msg.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "STOP_CRAWL") {
    stopCrawl();
    sendResponse({ ok: true });
  }
  if (msg.type === "PAUSE_CRAWL") {
    pauseCrawl();
    sendResponse({ ok: true });
  }
  if (msg.type === "RESUME_CRAWL") {
    resumeCrawl();
    sendResponse({ ok: true });
  }
  if (msg.type === "GET_STATE") {
    sendResponse({
      running: crawlState.running,
      paused: crawlState.paused,
      phase: crawlState.phase,
      vehicleCount: crawlState.vehicles.size,
      scrollCount: crawlState.scrollCount,
      isListingPage: isListingPage(),
      isDetailPage: isDetailPage(),
    });
  }
  if (msg.type === "EXTRACT_NOW") {
    const count = extractAllVisibleVehicles();
    broadcastProgress();
    sendResponse({ ok: true, newCount: count, total: crawlState.vehicles.size });
  }
});

// ─── Init: restore processed highlights state ────────────────────────────────

(async function init() {
  injectHighlightStyles();

  const stored = await safeStorageGet([
    "crawlProcessedIds",
    "crawlVehicles",
  ]);

  if (stored.crawlProcessedIds) {
    crawlState.processedCardIds = new Set(stored.crawlProcessedIds);
  }
  if (stored.crawlVehicles) {
    for (const v of stored.crawlVehicles) {
      crawlState.vehicles.set(v.vehicleId, v);
    }
  }

  // Re-apply done highlights for already-processed cards on page
  for (const { card } of getCardsRightToLeft()) {
    const vehicle = parseListingCard(card);
    if (vehicle && crawlState.processedCardIds.has(vehicle.vehicleId)) {
      highlightCard(card, "done");
    }
  }
})();
