/* Original Areca L-system renderer, from physarum/src/main.js.
 * Geometry, stroke treatment, leaf unfurling and wind are retained verbatim.
 * The adapter supplies transparent compositing and animation lifecycle controls.
 */
(function (root) {
  'use strict';
const TAU = Math.PI * 2;
const PAPER = [248, 241, 223];
const INK = [24, 54, 45];
const PALM = [83, 118, 90];
const WATER = [139, 192, 199];
const LIME = [199, 215, 110];

function mix(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ease(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function lerpColor(a, b, t) {
  return [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
  ];
}

function colorString(rgb, alpha = 1) {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${alpha})`;
}


function mount(fernCanvas, options = {}) {
  const sourceCtx = fernCanvas.getContext('2d');
  if (!sourceCtx) return null;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = media.matches, mature = Boolean(options.mature);
  const fernParams = { grow: .6692, detail: .64, wind: .402 };
  let width = 1, height = 1, dpr = 1;
  let time = 0, start = 0, segments = [], cachedDetail = -1, perchSegments = [];
  let paused = reduceMotion, visible = true, destroyed = false;
  let frame = 0, lastTime = 0;
function windOffset(segment, now, local = 1) {
    const wind = fernParams.wind;
    const heightBias = clamp(1 - segment.y2 / height, 0, 1);
    const branchWeight = clamp(segment.branchDepth / 7, 0, 1);
    const travellingGust = Math.sin(now * 0.00068 - segment.xMid * 0.010 + segment.phase * 0.00003);
    const highFlutter = Math.sin(now * 0.00122 + segment.yMid * 0.016 + segment.reveal * TAU);
    const slowPush = Math.max(0, Math.sin(now * 0.00028 - segment.reveal * TAU * 1.35));
    const amp = wind * local * (2.4 + heightBias * 20 + branchWeight * 12);
    return [
      (travellingGust * 0.70 + highFlutter * 0.18 + slowPush * 0.24) * amp,
      Math.sin(now * 0.00052 + segment.xMid * 0.014) * amp * 0.10,
    ];
  }

function buildFern() {
    const detail = fernParams.detail;
    const iterations = detail > 0.62 ? 6 : 5;
    let sentence = "X";

    for (let i = 0; i < iterations; i += 1) {
      let next = "";
      for (const token of sentence) {
        if (token === "X") {
          next += "F+[[X]-X]-F[-FX]+X";
        } else if (token === "F") {
          next += "FF";
        } else {
          next += token;
        }
      }
      sentence = next;
    }

    const stack = [];
    const raw = [];
    let x = 0;
    let y = 0;
    let angle = -Math.PI * 0.5;
    let branchDepth = 0;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    const turn = 24.5 * (Math.PI / 180);

    for (const token of sentence) {
      if (token === "F") {
        const nx = x + Math.cos(angle);
        const ny = y + Math.sin(angle);
        raw.push({ x1: x, y1: y, x2: nx, y2: ny, angle, branchDepth });
        x = nx;
        y = ny;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      } else if (token === "+") {
        angle += turn;
      } else if (token === "-") {
        angle -= turn;
      } else if (token === "[") {
        stack.push([x, y, angle, branchDepth]);
        branchDepth += 1;
      } else if (token === "]") {
        const state = stack.pop();
        x = state[0];
        y = state[1];
        angle = state[2];
        branchDepth = state[3];
      }
    }

    const rawWidth = maxX - minX || 1;
    const rawHeight = maxY - minY || 1;
    const scale = Math.min(width * 0.72 / rawWidth, height * 1.10 / rawHeight);
    const ox = width * 0.55 - (minX + rawWidth * 0.50) * scale;
    const oy = height * 1.05 - maxY * scale;

    segments = raw.map((segment, index) => ({
      id: index,
      x1: ox + segment.x1 * scale,
      y1: oy + segment.y1 * scale,
      x2: ox + segment.x2 * scale,
      y2: oy + segment.y2 * scale,
      branchDepth: segment.branchDepth,
      depth: index / raw.length,
      length: Math.hypot((segment.x2 - segment.x1) * scale, (segment.y2 - segment.y1) * scale),
      phase: Math.sin(index * 12.9898 + segment.branchDepth * 78.233) * 43758.5453,
    }));

    let minMidX = Infinity;
    let maxMidX = -Infinity;
    for (const segment of segments) {
      segment.xMid = (segment.x1 + segment.x2) * 0.5;
      segment.yMid = (segment.y1 + segment.y2) * 0.5;
      minMidX = Math.min(minMidX, segment.xMid);
      maxMidX = Math.max(maxMidX, segment.xMid);
    }

    const span = maxMidX - minMidX || 1;
    for (const segment of segments) {
      const across = (segment.xMid - minMidX) / span;
      const branchWeight = clamp(segment.branchDepth / 7, 0, 1);
      const stemPriority = segment.branchDepth <= 1 ? segment.depth * 0.12 : 0.12;
      segment.reveal = clamp(stemPriority + across * 0.80 + branchWeight * 0.08, 0, 1);
    }

    // Keep actual branch references for birds; avoid neighbouring landing spots.
    perchSegments = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s.branchDepth < 1 || s.branchDepth > 5 || s.yMid < height * .12 || s.yMid > height * .86) continue;
      if (Math.abs(s.x2 - s.x1) < Math.abs(s.y2 - s.y1) * .45) continue;
      if (perchSegments.some(other => Math.hypot(other.xMid - s.xMid, other.yMid - s.yMid) < Math.max(20, width * .03))) continue;
      perchSegments.push(s);
      if (perchSegments.length >= 65) break;
    }
    cachedDetail = detail;
  }

function drawWind(now) {
    const wind = fernParams.wind;
    if (wind <= 0.02) return;

    sourceCtx.save();
    sourceCtx.globalCompositeOperation = "multiply";
    sourceCtx.lineCap = "round";
    for (let i = 0; i < 6; i += 1) {
      const phase = i / 6;
      const y = height * (0.20 + phase * 0.64) + Math.sin(now * 0.00030 + i * 1.7) * 18 * wind;
      const sweep = ((now * 0.018 * (0.55 + wind) + i * 151) % (width + 420)) - 260;
      sourceCtx.strokeStyle = colorString(lerpColor(WATER, PALM, 0.18 + phase * 0.24), 0.010 + wind * 0.014);
      sourceCtx.lineWidth = 0.9 + wind * 1.2;
      sourceCtx.beginPath();
      sourceCtx.moveTo(sweep - 230, y);
      sourceCtx.bezierCurveTo(sweep - 70, y - 22 * wind, sweep + 90, y + 24 * wind, sweep + 280, y - 8 * wind);
      sourceCtx.stroke();
    }
    sourceCtx.restore();
  }

function drawSource(now) {
    sourceCtx.clearRect(0, 0, width, height);
    drawWind(now);

    const elapsed = now - start;
    const progress = mature || reduceMotion ? 1 : clamp(elapsed * (0.00008 + fernParams.grow * 0.00035), 0, 1);
    const wave = progress * 1.20 - 0.06;
    const revealWidth = mix(0.030, 0.090, fernParams.detail);
    const breath = Math.sin(now * 0.00032) * fernParams.wind;

    sourceCtx.save();
    sourceCtx.lineCap = "round";
    sourceCtx.lineJoin = "round";
    sourceCtx.globalCompositeOperation = "multiply";

    for (const segment of segments) {
      const local = ease((wave - segment.reveal) / revealWidth);
      if (local <= 0) continue;

      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const branchWeight = clamp(segment.branchDepth / 7, 0, 1);
      const rootWind = windOffset(segment, now, local * 0.24);
      const tipWind = windOffset(segment, now, local);
      const sway = tipWind[0] - rootWind[0];
      const curl =
        (Math.sin(now * 0.00072 + segment.phase * 0.0002) * 0.65 +
          Math.sin(segment.depth * 9 + breath + segment.reveal * TAU) * 0.35) *
        fernParams.wind *
        Math.min(22, segment.length * (0.8 + branchWeight * 0.9));
      const x1 = segment.x1 + rootWind[0] * segment.depth * 0.18;
      const y1 = segment.y1 + rootWind[1];
      const targetX = segment.x2 + tipWind[0] + sway * 0.14;
      const targetY = segment.y2 + tipWind[1] + breath * branchWeight * 4;
      const x2 = mix(x1, targetX, local);
      const y2 = mix(y1, targetY, local);
      const cx = mix(x1, targetX, 0.52) + nx * curl + sway * 0.30;
      const cy = mix(y1, targetY, 0.52) + ny * curl + tipWind[1] * 0.30;
      const widthScale = Math.max(0.34, 3.4 - branchWeight * 2.6 - segment.depth * 1.6);

      if (segment.branchDepth > 1 && local > 0.18 && segment.phase % 2 > 0.25) {
        const leafT = ease(local);
        const lx = mix(x1, x2, 0.72);
        const ly = mix(y1, y2, 0.72);
        const side = Math.sin(segment.phase) > 0 ? 1 : -1;
        const leafAngle =
          Math.atan2(y2 - y1, x2 - x1) +
          Math.sin(segment.phase) * 0.28 +
          side * (1 - leafT) * mix(0.75, 1.18, fernParams.detail) +
          tipWind[0] * 0.005;
        const leafLength = clamp(segment.length * mix(1.8, 3.9, fernParams.detail) * (1 - segment.depth * 0.20), 3, 17);
        const leafWidth = leafLength * mix(0.11, 0.20, fernParams.detail);
        sourceCtx.fillStyle = colorString(lerpColor(LIME, PALM, 0.72 + branchWeight * 0.18), (0.026 + fernParams.detail * 0.030) * leafT);
        sourceCtx.beginPath();
        sourceCtx.ellipse(lx, ly, leafLength * mix(0.22, 1, leafT), leafWidth * Math.pow(leafT, 1.45), leafAngle, 0, TAU);
        sourceCtx.fill();
      }

      sourceCtx.strokeStyle = colorString(lerpColor(WATER, PALM, 0.58), 0.050 * local);
      sourceCtx.lineWidth = widthScale * 3.0;
      sourceCtx.beginPath();
      sourceCtx.moveTo(x1, y1);
      sourceCtx.quadraticCurveTo(cx, cy, x2, y2);
      sourceCtx.stroke();

      sourceCtx.strokeStyle = colorString(lerpColor(lerpColor(WATER, PALM, 0.58), INK, clamp(segment.depth * 0.42, 0, 1)), (0.18 + segment.depth * 0.34) * local);
      sourceCtx.lineWidth = widthScale;
      sourceCtx.beginPath();
      sourceCtx.moveTo(x1, y1);
      sourceCtx.quadraticCurveTo(cx, cy, x2, y2);
      sourceCtx.stroke();
    }

    sourceCtx.restore();
  }

  function render() { drawSource(time); }
  function tick(timestamp) {
    frame = 0;
    if (destroyed || paused || document.hidden || !visible) { lastTime = 0; return; }
    if (!lastTime) lastTime = timestamp - 25;
    const elapsed = timestamp - lastTime;
    if (elapsed >= 1000 / 42) {
      time += Math.min(elapsed, 80);
      lastTime = timestamp;
      render();
    }
    frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (!options.externalClock && !destroyed && !paused && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const rect = fernCanvas.getBoundingClientRect();
    const scale = Math.min(1, 1700 / Math.max(1, rect.width), 1000 / Math.max(1, rect.height));
    width = Math.max(1, Math.round(rect.width * scale));
    height = Math.max(1, Math.round(rect.height * scale));
    dpr = Math.min(devicePixelRatio || 1, 1.15);
    fernCanvas.width = Math.round(width * dpr);
    fernCanvas.height = Math.round(height * dpr);
    sourceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = 'high';
    buildFern(); render(); resume();
  }
  function visibility() { lastTime = 0; resume(); }
  function motionChanged() {
    if (reduceMotion && !media.matches) start = time - 10000;
    reduceMotion = media.matches;
    paused = reduceMotion;
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    render(); resume(); options.onPause?.(paused);
  }
  const observer = new ResizeObserver(resize); observer.observe(fernCanvas);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; lastTime = 0; resume();
  }); intersection.observe(fernCanvas);
  document.addEventListener('visibilitychange', visibility);
  media.addEventListener('change', motionChanged);
  resize();
  return {
    get paused() { return paused; },
    resize,
    renderAt(now) { time = now; render(); },
    getPerches() {
      // Quadratic branch midpoint, using exactly the same wind and curl as the ink.
      const breath = Math.sin(time * .00032) * fernParams.wind;
      return perchSegments.map((segment, id) => {
        const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1;
        const length = Math.max(.001, Math.hypot(dx, dy)), nx = -dy / length, ny = dx / length;
        const weight = clamp(segment.branchDepth / 7, 0, 1);
        const rootWind = windOffset(segment, time, .24), tipWind = windOffset(segment, time, 1);
        const sway = tipWind[0] - rootWind[0];
        const curl = (Math.sin(time * .00072 + segment.phase * .0002) * .65 + Math.sin(segment.depth * 9 + breath + segment.reveal * TAU) * .35) * fernParams.wind * Math.min(22, segment.length * (.8 + weight * .9));
        const x1 = segment.x1 + rootWind[0] * segment.depth * .18, y1 = segment.y1 + rootWind[1];
        const x2 = segment.x2 + tipWind[0] + sway * .14, y2 = segment.y2 + tipWind[1] + breath * weight * 4;
        const cx = mix(x1, x2, .52) + nx * curl + sway * .30, cy = mix(y1, y2, .52) + ny * curl + tipWind[1] * .30;
        const t = .65, u = 1 - t;
        return { id: segment.id, x: (u*u*x1 + 2*u*t*cx + t*t*x2) / width, y: (u*u*y1 + 2*u*t*cy + t*t*y2) / height };
      });
    },
    regrow() {
      mature = false;
      start = paused ? time - 10000 : time;
      render(); resume();
    },
    pause(value) {
      paused = value;
      if (!paused) {
        if (reduceMotion) start = time - 10000;
        reduceMotion = false;
      }
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      render(); resume();
    },
    wind(value) { fernParams.wind = clamp(value, 0, 1); render(); },
    fullness(value) { fernParams.detail = clamp(value, 0, 1); buildFern(); render(); },
    destroy() {
      destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motionChanged);
    },
  };
}
root.ArecaBotanical = { mount };
})(typeof window === 'undefined' ? globalThis : window);
