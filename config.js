// ── perceptron config ────────────────────────────────────────────────────
// Paste your logging endpoint URL below to start collecting results.
// Leave it as "" to keep logging OFF — the game works fully offline either way.
//
// To get a URL with zero hosting, see README → "Collecting data (optional)".
window.PERCEPTRON_CONFIG = {
  endpoint: "https://perceptron-logger.fercook.workers.dev",
  // Optional shared secret. If you set SECRET in your Worker, put the
  // same value here. (config.js is publicly visible, so this only deters casual
  // abuse — it is not real authentication.)
  token: "SecretParaCloudflare",
};
