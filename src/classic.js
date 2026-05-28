(function () {
  const canvas = document.querySelector("#classic-stage");
  const ctx = canvas.getContext("2d", { alpha: false });
  const buttons = Array.from(document.querySelectorAll("[data-mode]"));
  const controls = {
    pace: document.querySelector("#pace"),
    detail: document.querySelector("#detail"),
    drift: document.querySelector("#drift"),
  };

  const TAU = Math.PI * 2;
  const paper = [248, 241, 223];
  const hot = [255, 249, 232];
  const ink = [24, 54, 45];
  const palm = [83, 118, 90];
  const water = [139, 192, 199];
  const lime = [199, 215, 110];
  const clay = [184, 115, 91];

  let width = 1;
  let height = 1;
  let dpr = 1;
  let mode = "fern";
  let fernSegments = [];
  let fernGrowth = 0;
  let fernLastFrame = 0;
  let waterState = null;
  let pointer = { x: 0, y: 0, active: false };

  function control(name) {
    return Number(controls[name].value);
  }

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

  function windOffset(segment, now, drift, local = 1) {
    const heightBias = clamp(1 - segment.y2 / height, 0, 1);
    const branchWeight = clamp(segment.branchDepth / 7, 0, 1);
    const travellingGust = Math.sin(now * 0.00072 - segment.xMid * 0.010 + segment.phase * 0.00003);
    const highFlutter = Math.sin(now * 0.00138 + segment.yMid * 0.017 + segment.reveal * TAU);
    const slowPush = Math.max(0, Math.sin(now * 0.00030 - segment.reveal * TAU * 1.5));
    const amp = drift * local * (3 + heightBias * 22 + branchWeight * 14);
    const x = (travellingGust * 0.72 + highFlutter * 0.22 + slowPush * 0.28) * amp;
    const y = Math.sin(now * 0.00056 + segment.xMid * 0.015) * amp * 0.11;
    return [x, y];
  }

  function fillPaper() {
    ctx.fillStyle = colorString(paper);
    ctx.fillRect(0, 0, width, height);
  }

  function drawWind(now, drift) {
    if (drift <= 0.02) return;

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.lineCap = "round";
    const count = 7;
    for (let i = 0; i < count; i += 1) {
      const phase = i / count;
      const y = height * (0.18 + phase * 0.68) + Math.sin(now * 0.00032 + i * 1.7) * 22 * drift;
      const sweep = ((now * 0.018 * (0.55 + drift) + i * 137) % (width + 420)) - 260;
      const alpha = (0.010 + drift * 0.020) * (0.55 + phase * 0.45);
      const rgb = lerpColor(water, palm, 0.18 + phase * 0.28);
      ctx.strokeStyle = colorString(rgb, alpha);
      ctx.lineWidth = 1 + drift * 1.4;
      ctx.beginPath();
      ctx.moveTo(sweep - 230, y);
      ctx.bezierCurveTo(
        sweep - 80,
        y - 28 * drift,
        sweep + 90,
        y + 26 * drift,
        sweep + 280,
        y - 10 * drift,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function protectLogo() {
    const gradient = ctx.createRadialGradient(150, 92, 18, 150, 92, 230);
    gradient.addColorStop(0, "rgb(255 249 232 / 0.98)");
    gradient.addColorStop(0.48, "rgb(248 241 223 / 0.88)");
    gradient.addColorStop(1, "rgb(248 241 223 / 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 430, 260);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    resetMode();
  }

  function generateFern() {
    const iterations = control("detail") > 0.62 ? 6 : 5;
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
    const turn = 24.5 * (Math.PI / 180);
    const step = 1;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;

    for (const token of sentence) {
      if (token === "F") {
        const nx = x + Math.cos(angle) * step;
        const ny = y + Math.sin(angle) * step;
        raw.push({
          x1: x,
          y1: y,
          x2: nx,
          y2: ny,
          angle,
          branchDepth,
        });
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
    const scale = Math.min(width * 0.62 / rawWidth, height * 0.82 / rawHeight);
    const ox = width * 0.54 - (minX + rawWidth * 0.50) * scale;
    const oy = height * 0.93 - maxY * scale;

    fernSegments = raw.map((s, index) => ({
      x1: ox + s.x1 * scale,
      y1: oy + s.y1 * scale,
      x2: ox + s.x2 * scale,
      y2: oy + s.y2 * scale,
      angle: s.angle,
      branchDepth: s.branchDepth,
      depth: index / raw.length,
      length: Math.hypot((s.x2 - s.x1) * scale, (s.y2 - s.y1) * scale),
      phase: Math.sin(index * 12.9898 + s.branchDepth * 78.233) * 43758.5453,
    }));

    let minMidX = Infinity;
    let maxMidX = -Infinity;
    for (const segment of fernSegments) {
      segment.xMid = (segment.x1 + segment.x2) * 0.5;
      segment.yMid = (segment.y1 + segment.y2) * 0.5;
      minMidX = Math.min(minMidX, segment.xMid);
      maxMidX = Math.max(maxMidX, segment.xMid);
    }

    const span = maxMidX - minMidX || 1;
    for (const segment of fernSegments) {
      const across = (segment.xMid - minMidX) / span;
      const branchWeight = clamp(segment.branchDepth / 7, 0, 1);
      const stemPriority = segment.branchDepth <= 1 ? segment.depth * 0.14 : 0.16;
      segment.reveal = clamp(stemPriority + across * 0.78 + branchWeight * 0.09, 0, 1);
    }
  }

  function drawFern(now) {
    fillPaper();
    if (!fernSegments.length) generateFern();

    const pace = control("pace");
    const drift = control("drift");
    const detail = control("detail");
    // Integrate growth per-frame so pace scales speed smoothly instead of
    // jumping (elapsed * rate jumps when rate changes). Clamp dt so a
    // backgrounded tab doesn't snap the fern to full growth on return.
    const dt = fernLastFrame ? Math.min(now - fernLastFrame, 64) : 0;
    fernLastFrame = now;
    fernGrowth = clamp(fernGrowth + dt * (0.00009 + pace * 0.00030), 0, 1);
    const progress = fernGrowth;
    const wave = progress * 1.22 - 0.08;
    const breath = Math.sin(now * 0.00032) * drift;

    drawWind(now, drift);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "multiply";

    for (let i = 0; i < fernSegments.length; i += 1) {
      const segment = fernSegments[i];
      const revealWidth = mix(0.025, 0.075, detail);
      const local = ease((wave - segment.reveal) / revealWidth);
      if (local <= 0) continue;

      const depth = segment.depth;
      const dx = segment.x2 - segment.x1;
      const dy = segment.y2 - segment.y1;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const branchWeight = clamp(segment.branchDepth / 7, 0, 1);
      const rootWind = windOffset(segment, now, drift, local * 0.28);
      const tipWind = windOffset(segment, now, drift, local);
      const sway = tipWind[0] - rootWind[0];
      const curl =
        (Math.sin(now * 0.00072 + segment.phase * 0.0002) * 0.65 +
          Math.sin(depth * 9 + breath + segment.reveal * TAU) * 0.35) *
        drift *
        Math.min(22, segment.length * (0.8 + branchWeight * 0.9));
      const x1 = segment.x1 + rootWind[0] * depth * 0.22;
      const y1 = segment.y1 + rootWind[1] + Math.sin(now * 0.00022 + depth * 8) * drift * branchWeight * 1.6;
      const targetX = segment.x2 + tipWind[0] + sway * 0.16;
      const targetY = segment.y2 + tipWind[1] + breath * branchWeight * 5;
      const x2 = mix(x1, targetX, local);
      const y2 = mix(y1, targetY, local);
      const cx = mix(x1, targetX, 0.52) + nx * curl + sway * 0.34;
      const cy = mix(y1, targetY, 0.52) + ny * curl + tipWind[1] * 0.32;
      const rgb = lerpColor(lerpColor(water, palm, 0.58), ink, clamp(depth * 0.46, 0, 1));
      const widthScale = Math.max(0.42, 3.8 - branchWeight * 2.8 - depth * 1.7);

      if (segment.branchDepth > 1 && local > 0.18 && i % 2 === 0) {
        const leafT = ease(local);
        const lx = mix(x1, x2, 0.72);
        const ly = mix(y1, y2, 0.72);
        const side = Math.sin(segment.phase) > 0 ? 1 : -1;
        const unfurl = 1 - leafT;
        const leafAngle =
          Math.atan2(y2 - y1, x2 - x1) +
          Math.sin(segment.phase) * 0.28 +
          side * unfurl * mix(0.75, 1.18, detail) +
          tipWind[0] * 0.005;
        const leafLength = clamp(segment.length * mix(2.1, 4.4, detail) * (1 - depth * 0.22), 3.2, 18);
        const leafWidth = leafLength * mix(0.12, 0.22, detail);
        const leafColor = lerpColor(lime, palm, 0.66 + branchWeight * 0.24);
        ctx.fillStyle = colorString(leafColor, (0.032 + detail * 0.036) * leafT);
        ctx.beginPath();
        ctx.ellipse(
          lx,
          ly,
          leafLength * mix(0.22, 1, leafT),
          leafWidth * Math.pow(leafT, 1.45),
          leafAngle,
          0,
          TAU,
        );
        ctx.fill();
      }

      ctx.strokeStyle = colorString(lerpColor(water, palm, 0.62), 0.055 * local);
      ctx.lineWidth = widthScale * 3.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();

      ctx.strokeStyle = colorString(rgb, (0.22 + depth * 0.38) * local);
      ctx.lineWidth = widthScale;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
    }

    ctx.restore();
    protectLogo();
  }

  function resetWater() {
    const scale = mix(0.19, 0.32, control("detail"));
    const simWidth = Math.max(160, Math.round(width * scale));
    const simHeight = Math.max(100, Math.round(height * scale));
    const area = simWidth * simHeight;
    waterState = {
      width: simWidth,
      height: simHeight,
      current: new Float32Array(area),
      previous: new Float32Array(area),
      next: new Float32Array(area),
      canvas: document.createElement("canvas"),
      lastDrop: 0,
    };
    waterState.canvas.width = simWidth;
    waterState.canvas.height = simHeight;
    waterState.ctx = waterState.canvas.getContext("2d", { alpha: false });
    waterState.image = waterState.ctx.createImageData(simWidth, simHeight);
  }

  function addDrop(nx, ny, strength = 3.5, radius = 8) {
    if (!waterState) return;
    const cx = Math.round(nx * waterState.width);
    const cy = Math.round(ny * waterState.height);
    const r2 = radius * radius;
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        const px = cx + x;
        const py = cy + y;
        if (px <= 1 || px >= waterState.width - 2 || py <= 1 || py >= waterState.height - 2) continue;
        const d2 = x * x + y * y;
        if (d2 > r2) continue;
        waterState.current[py * waterState.width + px] += strength * (1 - d2 / r2);
      }
    }
  }

  function drawWater(now) {
    if (!waterState) resetWater();

    const sim = waterState;
    const pace = control("pace");
    const drift = control("drift");
    const damping = mix(0.982, 0.994, control("detail"));

    if (now - sim.lastDrop > mix(1450, 420, pace)) {
      sim.lastDrop = now;
      addDrop(mix(0.26, 0.86, Math.random()), mix(0.28, 0.78, Math.random()), mix(1.4, 3.4, drift), 7);
    }

    if (pointer.active) {
      addDrop(pointer.x / width, pointer.y / height, 1.15, 5);
    }

    const w = sim.width;
    const h = sim.height;
    for (let y = 1; y < h - 1; y += 1) {
      const row = y * w;
      for (let x = 1; x < w - 1; x += 1) {
        const i = row + x;
        sim.next[i] =
          ((sim.current[i - 1] + sim.current[i + 1] + sim.current[i - w] + sim.current[i + w]) * 0.5 -
            sim.previous[i]) *
          damping;
      }
    }

    const previous = sim.previous;
    sim.previous = sim.current;
    sim.current = sim.next;
    sim.next = previous;

    const pixels = sim.image.data;
    for (let y = 0, p = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1, p += 4) {
        const i = y * w + x;
        const left = sim.current[i - 1] || 0;
        const right = sim.current[i + 1] || 0;
        const up = sim.current[i - w] || 0;
        const down = sim.current[i + w] || 0;
        const slope = (right - left + down - up) * 0.18;
        const wave = clamp(0.50 + slope + sim.current[i] * 0.020, 0, 1);
        const band = 0.5 + 0.5 * Math.sin(x * 0.040 + y * 0.016 + now * 0.00018);
        const rgb = lerpColor(lerpColor(paper, water, wave * 0.28), lerpColor(water, palm, 0.26), wave * 0.32 + band * 0.06);
        pixels[p] = rgb[0];
        pixels[p + 1] = rgb[1];
        pixels[p + 2] = rgb[2];
        pixels[p + 3] = 255;
      }
    }

    sim.ctx.putImageData(sim.image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sim.canvas, 0, 0, width, height);
    protectLogo();
  }

  function hashNoise(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function smoothNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hashNoise(ix, iy);
    const b = hashNoise(ix + 1, iy);
    const c = hashNoise(ix, iy + 1);
    const d = hashNoise(ix + 1, iy + 1);
    return mix(mix(a, b, u), mix(c, d, u), v);
  }

  function fbm(x, y) {
    let total = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 5; i += 1) {
      total += smoothNoise(x * freq, y * freq) * amp;
      freq *= 2;
      amp *= 0.52;
    }
    return total;
  }

  function terrain(wx, wz) {
    const basin = fbm(wx * 0.020, wz * 0.020);
    const ridges = Math.sin(wx * 0.030 + Math.sin(wz * 0.014) * 2.4) * 0.14;
    const river = Math.abs(Math.sin(wx * 0.026 + wz * 0.011 + Math.sin(wz * 0.008) * 2.2));
    const cut = Math.max(0, 0.32 - river) * 1.65;
    const heightValue = clamp(0.34 + basin * 0.46 + ridges - cut, 0.05, 1);
    const waterMask = clamp((0.22 - river) * 6.5, 0, 1);
    return { height: heightValue, water: waterMask };
  }

  function drawVoxel(now) {
    fillPaper();

    const pace = control("pace");
    const detail = control("detail");
    const drift = control("drift");
    const stepX = Math.max(2, Math.round(mix(5, 2, detail)));
    const cols = Math.ceil(width / stepX);
    const horizon = height * mix(0.45, 0.36, detail);
    const yBuffer = new Float32Array(cols);
    yBuffer.fill(height);

    const cameraX = Math.sin(now * 0.00010 * (0.5 + pace)) * 80 + now * 0.006 * pace;
    const cameraZ = now * (0.020 + pace * 0.045);
    const angle = -0.26 + Math.sin(now * 0.00011) * 0.12 * drift;
    const forward = [Math.sin(angle), Math.cos(angle)];
    const right = [Math.cos(angle), -Math.sin(angle)];
    const maxDepth = Math.round(mix(150, 250, detail));
    const cameraHeight = 1.05;

    for (let depth = 2; depth < maxDepth; depth += 1.55) {
      const spread = depth * 0.86;
      const baseX = cameraX + forward[0] * depth;
      const baseZ = cameraZ + forward[1] * depth;
      const fog = depth / maxDepth;

      for (let c = 0; c < cols; c += 1) {
        const lateral = (c / (cols - 1) - 0.5) * spread * 2;
        const wx = baseX + right[0] * lateral;
        const wz = baseZ + right[1] * lateral;
        const sample = terrain(wx, wz);
        const projected = horizon + ((cameraHeight - sample.height) / depth) * height * 0.82;

        if (projected < yBuffer[c]) {
          const land = lerpColor(lime, palm, clamp(sample.height * 0.9, 0, 1));
          const river = lerpColor(water, [70, 128, 130], sample.water * 0.55);
          const base = sample.water > 0.02 ? lerpColor(land, river, sample.water) : land;
          const rgb = lerpColor(base, paper, fog * 0.58);
          ctx.fillStyle = colorString(rgb, 0.96);
          const sx = c * stepX;
          ctx.fillRect(sx, projected, stepX + 1, yBuffer[c] - projected + 1);
          yBuffer[c] = projected;
        }
      }
    }

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "rgb(255 249 232 / 0.42)");
    sky.addColorStop(1, "rgb(139 192 199 / 0.10)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon + 16);
    protectLogo();
  }

  function resetMode() {
    fernSegments = [];
    fernGrowth = 0;
    fernLastFrame = 0;
    waterState = null;
    if (mode === "fern") generateFern();
    if (mode === "water") resetWater();
  }

  function setMode(nextMode) {
    mode = nextMode;
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === mode);
    });
    resetMode();
  }

  function frame(now) {
    if (mode === "fern") drawFern(now);
    if (mode === "water") drawWater(now);
    if (mode === "voxel") drawVoxel(now);
    requestAnimationFrame(frame);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  // pace and drift are read live every frame — changing them must not restart
  // the fern. Only detail changes structure (iteration count), so it rebuilds
  // the fern's geometry while preserving growth. Other modes keep full reset.
  controls.pace.addEventListener("input", () => {
    if (mode !== "fern") resetMode();
  });
  controls.drift.addEventListener("input", () => {
    if (mode !== "fern") resetMode();
  });
  controls.detail.addEventListener("input", () => {
    if (mode === "fern") {
      generateFern();
    } else {
      resetMode();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
