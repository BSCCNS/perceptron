/* charteval — game engine: mode selection, round lifecycle, scoring, stats. */
(function () {
  const CE = window.CE;
  const challenges = CE.challenges;
  const byId = {};
  challenges.forEach((c) => (byId[c.id] = c));

  const svg = document.getElementById("stage");
  const headlineEl = document.getElementById("headline");
  const rangeEl = document.getElementById("range");
  const instrEl = document.getElementById("instruction");
  const metaEl = document.getElementById("meta");
  const feedbackEl = document.getElementById("feedback");
  const nextBtn = document.getElementById("next");
  const lockBtn = document.getElementById("lockin");
  const tabsEl = document.getElementById("tabs");

  // Coarse pointers (phones/tablets) can't hover, so a tap can't both aim and
  // confirm. There we aim by tap/drag and commit with the Lock-in button.
  const COARSE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const AIM_HINT = COARSE ? "Drag to aim, then lock in." : "Hover to aim · click to lock in.";

  // --- persistent stats ---
  const KEY = "charteval.stats.v3";
  // byEnc keeps a per-encoding accuracy record: { id: {rounds, sumAcc, best} }.
  const defaultStats = () => ({ rounds: 0, sumAcc: 0, best: 0, streak: 0, bestStreak: 0, byEnc: {} });
  let stats = load();
  function load() {
    try {
      const s = Object.assign(defaultStats(), JSON.parse(localStorage.getItem(KEY)) || {});
      if (!s.byEnc) s.byEnc = {};
      return s;
    } catch (e) { return defaultStats(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (e) {} }

  function recordEncoding(id, acc) {
    const e = stats.byEnc[id] || (stats.byEnc[id] = { rounds: 0, sumAcc: 0, best: 0 });
    e.rounds++; e.sumAcc += acc; e.best = Math.max(e.best, acc);
  }

  function renderStats() {
    const avg = stats.rounds ? stats.sumAcc / stats.rounds : 0;
    document.getElementById("s-best").textContent = CE.pct(stats.best);
    document.getElementById("s-avg").textContent = CE.pct(avg);
    document.getElementById("s-streak").textContent = stats.streak;
    document.getElementById("s-rounds").textContent = stats.rounds;
    renderBreakdown();
  }

  function renderBreakdown() {
    const host = document.getElementById("breakdown-rows");
    host.replaceChildren();
    challenges.slice().sort((a, b) => a.hierRank - b.hierRank).forEach((c) => {
      const e = stats.byEnc[c.id];
      const avg = e && e.rounds ? e.sumAcc / e.rounds : null;
      const row = document.createElement("div");
      row.className = "brow" + (avg == null ? " empty" : "");
      row.innerHTML =
        `<span class="bname">${c.name}</span>` +
        `<span class="btrack"><span class="bfill" style="width:${avg == null ? 0 : avg}%"></span></span>` +
        `<span class="bval">${avg == null ? "— (0)" : CE.pct(avg) + " (" + e.rounds + ")"}</span>`;
      host.appendChild(row);
    });
  }

  // --- mode tabs ---
  let mode = "mixed"; // a challenge id or "mixed"
  function buildTabs() {
    const make = (id, name) => {
      const b = document.createElement("button");
      b.className = "tab"; b.dataset.mode = id; b.textContent = name;
      b.addEventListener("click", () => { mode = id; syncTabs(); newRound(); });
      tabsEl.appendChild(b);
    };
    make("mixed", "Mixed");
    challenges.slice().sort((a, b) => a.hierRank - b.hierRank).forEach((c) => make(c.id, c.name));
  }
  function syncTabs() {
    [...tabsEl.children].forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  }

  // --- round lifecycle ---
  let state = "aiming"; // "aiming" | "revealed"
  let round = null, scene = null, challenge = null;
  let lastAim = null;   // current previewed value (used by the Lock-in button)

  function newRound() {
    state = "aiming";
    lastAim = null;
    challenge = mode === "mixed" ? CE.pick(challenges) : byId[mode];
    round = challenge.generate();
    svg.replaceChildren();
    scene = challenge.setup(svg, round);
    const r = round.range;
    headlineEl.textContent = round.hideTarget ? "?" : CE.fmt(round.target, r);
    rangeEl.textContent = `${CE.fmt(r.min, r)} to ${CE.fmt(r.max, r)}`;
    instrEl.innerHTML = challenge.prompt(round);
    metaEl.textContent = `${challenge.name} · rank ${challenge.hierRank}`;
    feedbackEl.className = "feedback";
    feedbackEl.innerHTML = `<span class="hint">${AIM_HINT}</span>`;
    nextBtn.hidden = true;
    lockBtn.hidden = !COARSE;
    lockBtn.disabled = true;
    svg.classList.remove("done");
  }

  function reveal(guess) {
    state = "revealed";
    scene.commit(guess, round.target);
    svg.classList.add("done");

    const acc = CE.accuracy(guess, round.target, round.range);
    const err = Math.abs(guess - round.target);
    const grade = CE.grade(acc);

    stats.rounds++;
    stats.sumAcc += acc;
    stats.best = Math.max(stats.best, acc);
    stats.streak = acc >= 90 ? stats.streak + 1 : 0;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    recordEncoding(challenge.id, acc);
    save();
    renderStats();

    // fire-and-forget: send this result to the backend (no-op if none configured)
    CE.log({
      mode: mode,
      encoding: challenge.id,
      accuracy: acc,
      error: err,
      guess: guess,
      target: round.target,
      rangeMin: round.range.min,
      rangeMax: round.range.max,
      unit: round.range.unit || "",
      variant: round.variant != null ? round.variant : "",
      aligned: round.aligned != null ? round.aligned : "",
      donut: round.donut != null ? round.donut : "",
    });

    if (round.hideTarget) headlineEl.textContent = CE.fmt(round.target, round.range);
    feedbackEl.className = "feedback show " + grade.cls;
    feedbackEl.innerHTML =
      `<div class="grade">${grade.label.toLowerCase()}</div>` +
      `<div class="fdetail">you picked ${CE.fmt(guess, round.range)} · ` +
      `off by ${CE.fmt(err, round.range)} · ${CE.pct(acc)} accuracy</div>`;
    lockBtn.hidden = true;
    nextBtn.hidden = false;
    nextBtn.focus();
  }

  // --- pointer wiring ---
  function aim(e) {
    lastAim = scene.valueAt(CE.svgPoint(svg, e));
    scene.preview(lastAim);
  }
  svg.addEventListener("pointermove", (e) => {
    if (state !== "aiming" || !scene) return;
    aim(e);
  });
  svg.addEventListener("pointerleave", () => { /* keep last preview */ });
  svg.addEventListener("pointerdown", (e) => {
    if (!scene) return;
    if (state === "revealed") { newRound(); return; }
    aim(e);
    if (e.pointerType === "touch") {
      // touch: drag to refine, commit via the Lock-in button. Reveal it even on
      // hybrid devices where the primary pointer reported as fine.
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      lockBtn.hidden = false;
      lockBtn.disabled = false;
      if (feedbackEl.className === "feedback") feedbackEl.innerHTML = `<span class="hint">Drag to aim, then lock in.</span>`;
    } else {
      // mouse/pen: the click is the commit
      reveal(lastAim);
    }
  });

  lockBtn.addEventListener("click", () => {
    if (state === "aiming" && lastAim != null) reveal(lastAim);
  });
  nextBtn.addEventListener("click", newRound);
  document.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && state === "revealed") {
      e.preventDefault(); newRound();
    }
  });

  document.getElementById("reset").addEventListener("click", () => {
    stats = defaultStats(); save(); renderStats();
  });

  // --- about dialog ---
  function buildAbout() {
    const host = document.getElementById("about-encodings");
    if (!host) return;
    host.replaceChildren();
    challenges.slice().sort((a, b) => a.hierRank - b.hierRank).forEach((c) => {
      const row = document.createElement("div");
      row.className = "about-enc";
      row.innerHTML =
        `<span class="ae-name">${c.name}</span>` +
        `<span class="ae-rank">rank ${c.hierRank}</span>` +
        `<span class="ae-blurb">${c.blurb}</span>`;
      host.appendChild(row);
    });
  }
  const aboutDlg = document.getElementById("about");
  const aboutBtn = document.getElementById("about-btn");
  if (aboutDlg && aboutBtn) {
    aboutBtn.addEventListener("click", () => {
      if (typeof aboutDlg.showModal === "function") aboutDlg.showModal();
      else aboutDlg.setAttribute("open", "");
    });
  }

  // --- boot ---
  // Show the data-collection disclaimer only when logging is actually configured.
  if (window.PERCEPTRON_CONFIG && window.PERCEPTRON_CONFIG.endpoint) {
    ["privacy", "about-privacy"].forEach((id) => {
      const el = document.getElementById(id); if (el) el.hidden = false;
    });
  }
  buildTabs(); syncTabs(); buildAbout(); renderStats(); newRound();
})();
