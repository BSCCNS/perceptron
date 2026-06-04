/* charteval — shared utilities + challenge registry.
   No build step: this is a classic script that hangs everything off window.CE. */
(function () {
  const CE = (window.CE = window.CE || {});
  CE.challenges = [];
  CE.register = function (challenge) { CE.challenges.push(challenge); };

  const SVGNS = "http://www.w3.org/2000/svg";

  // Create an SVG element with attributes (and optional text content).
  CE.el = function (tag, attrs, text) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  // Convert a pointer event into the SVG's user-space coordinates.
  CE.svgPoint = function (svg, evt) {
    const p = svg.createSVGPoint();
    p.x = evt.clientX;
    p.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  CE.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  CE.lerp = function (a, b, t) { return a + (b - a) * t; };
  CE.rand = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  CE.randInt = function (lo, hi) { return Math.round(CE.rand(lo, hi)); };
  CE.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  // Format a value with precision appropriate to its range, with thousands
  // separators on the integer part (e.g. "2,911", "31.5"). Display only.
  CE.fmt = function (v, range) {
    const span = range ? range.max - range.min : Math.abs(v);
    const digits = span >= 50 ? 0 : span >= 5 ? 1 : 2;
    let s = Math.abs(v).toFixed(digits);
    let dot = s.indexOf(".");
    let int = dot === -1 ? s : s.slice(0, dot);
    const frac = dot === -1 ? "" : s.slice(dot);
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    s = (v < 0 ? "-" : "") + int + frac;
    return s + (range && range.unit ? range.unit : "");
  };

  // --- color maps (all take t in [0,1], return a CSS color string) ---

  function mix(a, b, t) {
    return [
      Math.round(CE.lerp(a[0], b[0], t)),
      Math.round(CE.lerp(a[1], b[1], t)),
      Math.round(CE.lerp(a[2], b[2], t)),
    ];
  }

  const VIRIDIS = [
    [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ];
  CE.viridis = function (t) {
    t = CE.clamp(t, 0, 1);
    const n = VIRIDIS.length - 1;
    const i = Math.min(Math.floor(t * n), n - 1);
    const f = t * n - i;
    const c = mix(VIRIDIS[i], VIRIDIS[i + 1], f);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  // Saturation ramp at a fixed hue (low sat -> vivid).
  CE.satRamp = function (hue) {
    return function (t) {
      t = CE.clamp(t, 0, 1);
      return `hsl(${hue}, ${Math.round(t * 90 + 5)}%, 50%)`;
    };
  };

  // Grayscale lightness ramp (dark -> light).
  CE.grayRamp = function (t) {
    t = CE.clamp(t, 0, 1);
    const v = Math.round(t * 200 + 45); // 45..245 — stays visible on the dark stage
    return `rgb(${v},${v},${v})`;
  };

  // --- scoring ---
  // accuracy in [0,100]; 100 == perfect, falls off linearly with normalized error.
  // Kept to two decimals (not integer-rounded) so the precision is preserved both
  // on screen and in the backend.
  CE.accuracy = function (guess, target, range) {
    const span = range.max - range.min || 1;
    const normErr = Math.abs(guess - target) / span;
    return Math.max(0, Math.round(100 * (1 - normErr) * 100) / 100);
  };

  // Format an accuracy/percentage value with two decimals (e.g. "11.58%").
  CE.pct = function (v) { return (Math.round(v * 100) / 100).toFixed(2) + "%"; };

  CE.grade = function (acc) {
    if (acc >= 99) return { label: "Bullseye", cls: "g-bull" };
    if (acc >= 95) return { label: "Great", cls: "g-great" };
    if (acc >= 88) return { label: "Good", cls: "g-good" };
    if (acc >= 75) return { label: "Close", cls: "g-close" };
    if (acc >= 55) return { label: "Off", cls: "g-off" };
    return { label: "Way off", cls: "g-bad" };
  };

  // Generate endpoints for a numeric scale: multiples of 10 that aren't the
  // obvious round numbers (so 70, 350, 1400 rather than 100, 500, 1000).
  CE.niceRange = function () {
    const step = CE.pick([10, 20, 50, 100]);
    const max = step * CE.randInt(3, 19); // e.g. 70, 180, 350, 1400
    let min = 0;
    if (Math.random() < 0.45) {
      min = step * CE.randInt(1, Math.max(1, Math.floor(max / step / 2)));
    }
    return { min, max, unit: "" };
  };
})();
