/**
 * Cars24 Crawler — Google Apps Script
 *
 * SETUP:
 * 1. Create a new Google Sheet
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into the Chrome extension popup
 */

var HEADERS = [
  "vehicleId", "title", "make", "model", "variant", "year", "detailUrl",
  "price", "originalPrice", "emi", "mileage", "fuel", "transmission", "rto",
  "owners", "location", "badge", "imageUrl", "scrapedAt", "detailScrapedAt",
  "source", "fetchError"
];

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Vehicles");
  if (!sheet) {
    sheet = ss.insertSheet("Vehicles");
  }
  return sheet;
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers || HEADERS);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet();
    var headers = payload.headers || HEADERS;

    if (payload.action === "init") {
      ensureHeaders(sheet, headers);
      return jsonResponse({ ok: true, message: "Sheet ready" });
    }

    if (payload.action === "append") {
      ensureHeaders(sheet, headers);
      if (payload.row && payload.row.length) {
        sheet.appendRow(payload.row);
      }
      return jsonResponse({ ok: true, message: "Row appended" });
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
