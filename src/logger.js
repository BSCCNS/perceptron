/* perceptron — fire-and-forget result logging.
   Never blocks or breaks the game: if no endpoint is configured, or the network
   fails, CE.log() silently does nothing. Sends as a "simple" request
   (sendBeacon / no-cors), so it needs no CORS setup on the backend. */
(function () {
  const CE = window.CE;
  const CFG = window.PERCEPTRON_CONFIG || {};
  const ENDPOINT = CFG.endpoint || "";
  const TOKEN = CFG.token || "";

  // Stable anonymous id so you can group a player's rounds without anything personal.
  function sessionId() {
    try {
      let id = localStorage.getItem("perceptron.session");
      if (!id) {
        id = "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem("perceptron.session", id);
      }
      return id;
    } catch (e) { return "s_anon"; }
  }
  const SID = sessionId();

  CE.log = function (event) {
    if (!ENDPOINT) return; // logging disabled until a backend is configured
    let payload;
    try {
      const base = { session: SID, ts: Date.now() };
      if (TOKEN) base.token = TOKEN;
      payload = JSON.stringify(Object.assign(base, event));
    } catch (e) { return; }

    // Preferred: sendBeacon — built for non-blocking analytics, survives page unload.
    try {
      if (navigator.sendBeacon &&
          navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain" }))) {
        return;
      }
    } catch (e) { /* fall through */ }

    // Fallback: fire-and-forget fetch with an opaque (no-cors) response.
    try {
      fetch(ENDPOINT, { method: "POST", mode: "no-cors", keepalive: true, body: payload });
    } catch (e) { /* swallow — logging must never affect gameplay */ }
  };
})();
