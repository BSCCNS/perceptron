/**
 * perceptron — Google Apps Script backend (zero hosting).
 *
 * Appends each result the game sends into a Google Sheet, one row per round.
 * See README → "Collecting data (optional)" for the click-by-click setup.
 *
 * Works with the game's fire-and-forget logger because the request is a
 * "simple" POST (text/plain body), so the browser does NOT send a CORS
 * preflight and no CORS headers are needed here.
 */

var SHEET_NAME = "events";
var HEADERS = [
  "ts", "session", "mode", "encoding", "variant", "aligned", "donut",
  "accuracy", "error", "guess", "target", "rangeMin", "rangeMax", "unit",
];

// Optional: set a shared secret here AND in config.js (token) to reject random
// POSTs. Leave "" to accept anything. Note: config.js is public, so this only
// deters casual abuse — it is not real authentication.
var SECRET = "";

// Numeric fields are coerced to numbers; everything else is stored as text with
// a leading '=' / '+' / '-' / '@' neutralized to prevent spreadsheet formula
// injection from untrusted POST data.
var NUMERIC = { accuracy: 1, error: 1, guess: 1, target: 1, rangeMin: 1, rangeMax: 1 };
function clean(key, val) {
  if (val == null) return "";
  if (NUMERIC[key]) { var n = Number(val); return isFinite(n) ? n : ""; }
  var s = String(val).slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (SECRET && data.token !== SECRET) return ContentService.createTextOutput("denied");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    var row = HEADERS.map(function (h) {
      if (h === "ts") return new Date(Number(data.ts) || Date.now());
      return clean(h, data[h]);
    });
    sheet.appendRow(row);
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("err: " + err);
  }
}

// Lets you open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return ContentService.createTextOutput("perceptron logger is running");
}
