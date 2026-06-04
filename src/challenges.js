/* charteval — encoding challenges.
   Each challenge:
     id, name, blurb, hierRank (Cleveland–McGill, 1 = most accurate)
     generate()            -> round object { range:{min,max,unit}, target, prompt, hideTarget?, ... }
     setup(svg, round)     -> scene { valueAt(pt), preview(value), commit(guess, target) }
   The engine wires pointer events to valueAt/preview/commit. */
(function () {
  const CE = window.CE;
  const el = CE.el, clamp = CE.clamp, fmt = CE.fmt;

  const COL_YOU = "#5b9dff";   // your guess
  const COL_ACT = "#fbbf24";   // actual value
  const COL_AXIS = "#6b7488";  // axes / outlines
  const COL_INK = "#e8eaf0";   // primary text
  const COL_MUTED = "#9aa3b2"; // secondary text
  const COL_NEUTRAL = "#39414f"; // reference / inert shapes
  const COL_STAGE = "#07090c"; // stage background (for donut holes etc.) — matches page bg
  const COL_GHOST = "#6b7280"; // hover preview

  function snap(v, range) {
    const span = range.max - range.min;
    const step = span >= 200 ? 5 : span >= 50 ? 1 : span >= 5 ? 0.5 : 0.1;
    return Math.round(v / step) * step;
  }
  function targetIn(range, lo, hi) {
    return snap(CE.lerp(range.min, range.max, CE.rand(lo, hi)), range);
  }

  // small reusable bits ------------------------------------------------------
  function text(g, x, y, str, opts) {
    const a = Object.assign({ x, y, "text-anchor": "middle", "font-size": 23, fill: COL_INK }, opts || {});
    g.appendChild(el("text", a, str));
  }
  // upward/downward pointing triangle marker
  function tri(g, x, y, color, dir) {
    const s = 13;
    const pts = dir === "up"
      ? `${x},${y} ${x - s},${y + s * 1.4} ${x + s},${y + s * 1.4}`
      : `${x},${y} ${x - s},${y - s * 1.4} ${x + s},${y - s * 1.4}`;
    g.appendChild(el("polygon", { points: pts, fill: color }));
  }

  // ============================ POSITION ====================================
  CE.register({
    id: "position", name: "Position", hierRank: 1,
    blurb: "Position along a common scale — the most accurately read encoding.",
    generate() {
      const range = CE.niceRange();
      return { range, target: targetIn(range, 0.08, 0.92) };
    },
    prompt: () => `Click where this value falls on the scale.`,
    setup(svg, round) {
      const r = round.range, x0 = 130, x1 = 770, axisY = 300;
      const xOf = (v) => x0 + ((v - r.min) / (r.max - r.min)) * (x1 - x0);

      const base = el("g"); svg.appendChild(base);
      base.appendChild(el("line", { x1: x0, y1: axisY, x2: x1, y2: axisY, stroke: COL_AXIS, "stroke-width": 3 }));
      [[x0, r.min], [x1, r.max]].forEach(([x, v]) => {
        base.appendChild(el("line", { x1: x, y1: axisY - 10, x2: x, y2: axisY + 10, stroke: COL_AXIS, "stroke-width": 3 }));
        text(base, x, axisY + 38, fmt(v, r), { fill: COL_MUTED, "font-size": 21 });
      });

      const ghost = el("g"); svg.appendChild(ghost);
      return {
        valueAt: (p) => clamp(r.min + ((p.x - x0) / (x1 - x0)) * (r.max - r.min), r.min, r.max),
        preview(v) {
          ghost.replaceChildren();
          const x = xOf(v);
          ghost.appendChild(el("line", { x1: x, y1: axisY - 26, x2: x, y2: axisY + 26, stroke: COL_GHOST, "stroke-width": 2 }));
        },
        commit(g, t) {
          ghost.replaceChildren();
          const fin = el("g"); svg.appendChild(fin);
          const xg = xOf(g), xt = xOf(t);
          fin.appendChild(el("line", { x1: xg, y1: axisY, x2: xt, y2: axisY, stroke: COL_NEUTRAL, "stroke-width": 6, "stroke-linecap": "round" }));
          fin.appendChild(el("line", { x1: xt, y1: axisY - 30, x2: xt, y2: axisY + 8, stroke: COL_ACT, "stroke-width": 3 }));
          tri(fin, xt, axisY - 30, COL_ACT, "down");
          text(fin, xt, axisY - 58, fmt(t, r), { fill: COL_ACT, "font-weight": 700 });
          fin.appendChild(el("line", { x1: xg, y1: axisY - 8, x2: xg, y2: axisY + 30, stroke: COL_YOU, "stroke-width": 3 }));
          tri(fin, xg, axisY + 30, COL_YOU, "up");
          text(fin, xg, axisY + 74, "you: " + fmt(g, r), { fill: COL_YOU, "font-weight": 700 });
        },
      };
    },
  });

  // ============================ LENGTH / BARS ===============================
  CE.register({
    id: "length", name: "Length", hierRank: 2,
    blurb: "Length of a bar. With a floating baseline you must judge length, not height.",
    generate() {
      const max = CE.pick([50, 100, 200]);
      const range = { min: 0, max, unit: "" };
      const refVal = snap(CE.rand(0.3, 0.7) * max, range);
      return { range, refVal, aligned: Math.random() < 0.5, target: targetIn(range, 0.1, 0.95) };
    },
    prompt: (rd) => `Click where the blue bar reaches this value` +
      (rd.aligned ? " <span class='dim'>(shared baseline)</span>" : " <span class='dim'>(floating baseline — judge length)</span>"),
    setup(svg, round) {
      const r = round.range, plotH = 320, top = 150, scale = plotH / r.max;
      const yBaseRef = top + plotH, yBaseTgt = round.aligned ? yBaseRef : top + plotH - 80;
      const refX = 290, tgtX = 510, bw = 96;
      const topOf = (v, base) => base - v * scale;

      const base = el("g"); svg.appendChild(base);
      // reference bar (known value)
      base.appendChild(el("rect", { x: refX, y: topOf(round.refVal, yBaseRef), width: bw, height: round.refVal * scale, fill: COL_NEUTRAL }));
      base.appendChild(el("line", { x1: refX - 14, y1: yBaseRef, x2: refX + bw + 14, y2: yBaseRef, stroke: COL_AXIS, "stroke-width": 3 }));
      text(base, refX + bw / 2, yBaseRef + 30, "reference = " + fmt(round.refVal, r), { fill: COL_MUTED, "font-size": 20 });
      // target baseline (where the blue bar grows from)
      base.appendChild(el("line", { x1: tgtX - 14, y1: yBaseTgt, x2: tgtX + bw + 14, y2: yBaseTgt, stroke: COL_AXIS, "stroke-width": 3 }));
      text(base, tgtX + bw / 2, yBaseTgt + 30, round.aligned ? "make this bar" : "(floating baseline)", { fill: COL_MUTED, "font-size": 20 });

      const ghost = el("g"); svg.appendChild(ghost);
      return {
        valueAt: (p) => clamp((yBaseTgt - p.y) / scale, r.min, r.max),
        preview(v) {
          ghost.replaceChildren();
          ghost.appendChild(el("rect", { x: tgtX, y: topOf(v, yBaseTgt), width: bw, height: v * scale, fill: COL_YOU, "fill-opacity": 0.25, stroke: COL_GHOST, "stroke-dasharray": "4 4" }));
        },
        commit(g, t) {
          ghost.replaceChildren();
          const fin = el("g"); svg.appendChild(fin);
          fin.appendChild(el("rect", { x: tgtX, y: topOf(g, yBaseTgt), width: bw, height: g * scale, fill: COL_YOU, "fill-opacity": 0.8 }));
          fin.appendChild(el("line", { x1: tgtX - 16, y1: topOf(t, yBaseTgt), x2: tgtX + bw + 16, y2: topOf(t, yBaseTgt), stroke: COL_ACT, "stroke-width": 4 }));
          text(fin, tgtX + bw / 2, topOf(t, yBaseTgt) - 12, "actual " + fmt(t, r), { fill: COL_ACT, "font-weight": 700, "font-size": 21 });
          text(fin, tgtX + bw / 2, topOf(g, yBaseTgt) + (g * scale > 40 ? 28 : -12), "you " + fmt(g, r), { fill: g * scale > 40 ? "#fff" : COL_YOU, "font-weight": 700, "font-size": 21 });
        },
      };
    },
  });

  // ============================ ANGLE / PIE =================================
  function slicePath(cx, cy, r, frac, inner) {
    if (frac <= 0) return "";
    if (frac >= 1) frac = 0.99999;
    const a = frac * 2 * Math.PI;
    const x1 = cx, y1 = cy - r, x2 = cx + r * Math.sin(a), y2 = cy - r * Math.cos(a);
    const large = frac > 0.5 ? 1 : 0;
    if (inner > 0) {
      const ix1 = cx, iy1 = cy - inner, ix2 = cx + inner * Math.sin(a), iy2 = cy - inner * Math.cos(a);
      return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`;
    }
    return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }
  CE.register({
    id: "angle", name: "Angle", hierRank: 4,
    blurb: "Angle / slice of a pie (or donut) — what share of the whole?",
    generate() {
      const range = { min: 0, max: 100, unit: "%" };
      return { range, donut: Math.random() < 0.4, target: snap(CE.rand(6, 94), range) };
    },
    prompt: (rd) => `Click so the ${rd.donut ? "ring" : "slice"} is this share of the whole.`,
    setup(svg, round) {
      const r = round.range, cx = 450, cy = 285, R = 156, inner = round.donut ? 76 : 0;
      const base = el("g"); svg.appendChild(base);
      base.appendChild(el("circle", { cx, cy, r: R, fill: COL_NEUTRAL, stroke: COL_AXIS, "stroke-width": 2 }));
      if (inner) base.appendChild(el("circle", { cx, cy, r: inner, fill: COL_STAGE, stroke: COL_AXIS, "stroke-width": 2 }));
      base.appendChild(el("line", { x1: cx, y1: cy - R - 12, x2: cx, y2: cy - inner, stroke: COL_AXIS, "stroke-width": 2, "stroke-dasharray": "3 4" }));

      const ghost = el("g"); svg.appendChild(ghost);
      const valAt = (p) => {
        let ang = Math.atan2(p.x - cx, -(p.y - cy));
        if (ang < 0) ang += 2 * Math.PI;
        return clamp((ang / (2 * Math.PI)) * 100, 0, 100);
      };
      return {
        valueAt: valAt,
        preview(v) {
          ghost.replaceChildren();
          const d = slicePath(cx, cy, R, v / 100, inner);
          if (d) ghost.appendChild(el("path", { d, fill: COL_YOU, "fill-opacity": 0.22 }));
        },
        commit(g, t) {
          ghost.replaceChildren();
          const fin = el("g"); svg.appendChild(fin);
          fin.appendChild(el("path", { d: slicePath(cx, cy, R, g / 100, inner), fill: COL_YOU, "fill-opacity": 0.4 }));
          fin.appendChild(el("path", { d: slicePath(cx, cy, R, t / 100, inner), fill: "none", stroke: COL_ACT, "stroke-width": 4 }));
          text(fin, cx, cy + R + 40, "actual " + fmt(t, r), { fill: COL_ACT, "font-weight": 700 });
          text(fin, cx, cy + R + 66, "you " + fmt(g, r), { fill: COL_YOU, "font-weight": 700 });
        },
      };
    },
  });

  // ============================ AREA ========================================
  CE.register({
    id: "area", name: "Area", hierRank: 5,
    blurb: "Area of a circle. Doubling the value should roughly multiply the area, not the radius.",
    generate() {
      const range = { min: 0, max: 100, unit: "" };
      const refVal = 50;
      return { range, refVal, target: snap(CE.rand(8, 100), range) };
    },
    prompt: () => `Click to size the circle's <b>area</b> to this value.`,
    setup(svg, round) {
      const r = round.range, rr = 70, refC = [260, 300], tgtC = [620, 300];
      // Let the player size well past the target range so over-shoots aren't
      // clipped (which biased results near the top); targets stay within r.
      const maxSize = r.max * 2;
      const radOf = (v) => rr * Math.sqrt(Math.max(v, 0) / round.refVal);
      const maxRad = radOf(r.max);

      const base = el("g"); svg.appendChild(base);
      base.appendChild(el("circle", { cx: refC[0], cy: refC[1], r: rr, fill: COL_NEUTRAL }));
      text(base, refC[0], refC[1] + 5, "= " + fmt(round.refVal, r), { fill: COL_INK, "font-weight": 700 });
      text(base, refC[0], refC[1] + rr + 34, "reference", { fill: COL_MUTED, "font-size": 20 });
      base.appendChild(el("circle", { cx: tgtC[0], cy: tgtC[1], r: 3, fill: COL_AXIS }));
      text(base, tgtC[0], tgtC[1] + maxRad + 34, "click to size your circle", { fill: COL_MUTED, "font-size": 20 });

      const ghost = el("g"); svg.appendChild(ghost);
      const valAt = (p) => {
        const d = Math.hypot(p.x - tgtC[0], p.y - tgtC[1]);
        return clamp((d / rr) * (d / rr) * round.refVal, r.min, maxSize);
      };
      return {
        valueAt: valAt,
        preview(v) {
          ghost.replaceChildren();
          ghost.appendChild(el("circle", { cx: tgtC[0], cy: tgtC[1], r: radOf(v), fill: COL_YOU, "fill-opacity": 0.2, stroke: COL_GHOST, "stroke-dasharray": "4 4" }));
        },
        commit(g, t) {
          ghost.replaceChildren();
          const fin = el("g"); svg.appendChild(fin);
          fin.appendChild(el("circle", { cx: tgtC[0], cy: tgtC[1], r: radOf(g), fill: COL_YOU, "fill-opacity": 0.4 }));
          fin.appendChild(el("circle", { cx: tgtC[0], cy: tgtC[1], r: radOf(t), fill: "none", stroke: COL_ACT, "stroke-width": 4 }));
          const labelY = tgtC[1] - Math.max(radOf(g), radOf(t)) - 20;
          text(fin, tgtC[0], labelY - 26, "actual " + fmt(t, r), { fill: COL_ACT, "font-weight": 700 });
          text(fin, tgtC[0], labelY, "you " + fmt(g, r), { fill: COL_YOU, "font-weight": 700 });
        },
      };
    },
  });

  // ====================== COLOR / SATURATION / LIGHTNESS ====================
  CE.register({
    id: "color", name: "Color", hierRank: 6,
    blurb: "Color hue / saturation / lightness — read a swatch and place it on the scale.",
    generate() {
      const range = CE.niceRange();
      const variant = CE.pick(["color", "saturation", "lightness"]);
      const hue = CE.randInt(0, 360);
      return { range, variant, hue, target: targetIn(range, 0.06, 0.94), hideTarget: true };
    },
    prompt: (rd) => `Read the swatch's ${rd.variant === "color" ? "colour" : rd.variant} and click its value on the scale below.`,
    setup(svg, round) {
      const r = round.range;
      const cmap = round.variant === "color" ? CE.viridis
        : round.variant === "saturation" ? CE.satRamp(round.hue) : CE.grayRamp;
      const frac = (v) => (v - r.min) / (r.max - r.min);
      const x0 = 180, x1 = 720, yL = 380, hL = 50;
      const xOf = (v) => x0 + frac(v) * (x1 - x0);

      const base = el("g"); svg.appendChild(base);
      // stimulus swatch
      base.appendChild(el("rect", { x: 370, y: 120, width: 160, height: 130, rx: 8, fill: cmap(frac(round.target)), stroke: COL_AXIS }));
      text(base, 450, 285, "what value is this?", { fill: COL_MUTED, "font-size": 20 });
      // legend (built from thin slices so it matches the swatch's colormap exactly)
      const N = 120;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        base.appendChild(el("rect", { x: x0 + (i / N) * (x1 - x0), y: yL, width: (x1 - x0) / N + 1, height: hL, fill: cmap(t) }));
      }
      base.appendChild(el("rect", { x: x0, y: yL, width: x1 - x0, height: hL, fill: "none", stroke: COL_AXIS }));
      text(base, x0, yL + hL + 26, fmt(r.min, r), { fill: COL_MUTED, "font-size": 20 });
      text(base, x1, yL + hL + 26, fmt(r.max, r), { fill: COL_MUTED, "font-size": 20 });

      const ghost = el("g"); svg.appendChild(ghost);
      return {
        valueAt: (p) => clamp(r.min + ((p.x - x0) / (x1 - x0)) * (r.max - r.min), r.min, r.max),
        preview(v) {
          ghost.replaceChildren();
          tri(ghost, xOf(v), yL - 4, COL_GHOST, "down");
        },
        commit(g, t) {
          ghost.replaceChildren();
          const fin = el("g"); svg.appendChild(fin);
          tri(fin, xOf(t), yL - 4, COL_ACT, "down");
          text(fin, xOf(t), yL - 34, "actual " + fmt(t, r), { fill: COL_ACT, "font-weight": 700, "font-size": 20 });
          tri(fin, xOf(g), yL + hL + 4, COL_YOU, "up");
          text(fin, xOf(g), yL + hL + 50, "you " + fmt(g, r), { fill: COL_YOU, "font-weight": 700, "font-size": 20 });
        },
      };
    },
  });
})();
