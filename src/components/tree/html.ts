import { FRUIT_RUNTIME } from "./fruitRuntime";
import { LIGHT_RUNTIME } from "./lightRuntime";
import { TREE_MAX_FRUITS, TREE_MAX_EVENT_FRUITS, TREE_MAX_STATE_LENGTH } from "./limits";

export const TREE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:">
<title>StoryTime tree</title>
<style>
html, body, #scene { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0b1030; }
#sky { display: block; width: 100%; height: 100%; touch-action: none; -webkit-user-select: none; user-select: none; }
</style>
</head>
<body><main id="scene"><canvas id="sky" role="img" aria-label="A shared tree. Each blossom is an answer. Golden blossoms are yours."></canvas></main>
<script>
(function () {
  "use strict";

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (v) => {
    v = clamp(v, 0, 1);
    return v * v * (3 - 2 * v);
  };
  const hex = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const KEYS = [0, 0.35, 0.68, 0.82, 1];
  function ramp(list) {
    const c = list.map(hex);
    return function (t) {
      let i = 0;
      while (i < KEYS.length - 2 && t > KEYS[i + 1]) i++;
      const u = clamp((t - KEYS[i]) / (KEYS[i + 1] - KEYS[i]), 0, 1);
      const a = c[i],
        b = c[i + 1];
      return (
        "rgb(" +
        Math.round(a[0] + (b[0] - a[0]) * u) +
        "," +
        Math.round(a[1] + (b[1] - a[1]) * u) +
        "," +
        Math.round(a[2] + (b[2] - a[2]) * u) +
        ")"
      );
    };
  }

  const C = {
    skyTop: ramp(["#c9cfe0", "#bfd9e6", "#e8c9a8", "#3a3566", "#0b1030"]),
    skyBot: ramp(["#f3d9cf", "#eaf1ea", "#f2a37c", "#b5668a", "#1d2452"]),
    hillFar: ramp(["#a9b3c6", "#9fc0b8", "#c98f7f", "#5a4777", "#171c44"]),
    hillMid: ramp(["#7f93a0", "#6fa08e", "#9a6a66", "#3e3560", "#111538"]),
    ground: ramp(["#33503f", "#375f45", "#3d4034", "#1c1936", "#090c22"]),
    bark: ramp(["#3b2f33", "#3a2c28", "#33221f", "#15112a", "#04050d"]),
    leaf0: ramp(["#7fa58a", "#6fa46f", "#8a9a55", "#2c4a5c", "#1c3646"]),
    leaf1: ramp(["#9dbf9a", "#8fbf7f", "#b0a85c", "#35586a", "#234453"]),
    leaf2: ramp(["#5f8a76", "#4f8a5c", "#6f7f48", "#233c50", "#152b3a"]),
    ink: ramp(["#2a2740", "#26323a", "#3a2420", "#f3e6dc", "#f6efe6"]),
  };

  function buildTree(seed) {
    const R = rng(seed);
    let maxDist = 0,
      count = 0;
    const buds = [];
    function mk(rel, len, w, depth, dist, abs) {
      let a = abs + rel;
      if (a > 1.35) {
        rel -= a - 1.35;
        a = 1.35;
      }
      if (a < -1.35) {
        rel += -1.35 - a;
        a = -1.35;
      }
      const n = {
        rel: rel,
        len: len,
        w: w,
        depth: depth,
        dist: dist,
        curve: (R() - 0.5) * 0.9,
        ph: R() * 6.283,
        kids: [],
        leaves: [],
        buds: [],
      };
      count++;
      maxDist = Math.max(maxDist, dist + len);
      if (w > 1.0 && depth < 9) {
        n.kids.push(
          mk(
            (R() - 0.5) * (depth < 2 ? 0.28 : 0.6),
            len * (0.8 + R() * 0.1),
            w * 0.78,
            depth + 1,
            dist + len,
            a,
          ),
        );
        const sides = depth === 0 ? 1 : R() < 0.7 ? 1 : 2;
        let sgn = R() < 0.5 ? -1 : 1;
        for (let i = 0; i < sides; i++) {
          n.kids.push(
            mk(
              sgn * (0.42 + R() * 0.5),
              len * (0.6 + R() * 0.2),
              w * (0.56 + R() * 0.1),
              depth + 1,
              dist + len,
              a,
            ),
          );
          sgn = -sgn;
        }
      }
      n.kids.forEach(function (k) {
        k.parent = n;
      });
      const tip = n.kids.length === 0;
      if (depth >= 3) {
        const k = tip ? 5 : 2 + Math.floor(R() * 2);
        for (let i = 0; i < k; i++) {
          const t = tip ? 0.45 + R() * 0.55 : 0.2 + R() * 0.8;
          n.leaves.push({
            t: t,
            a: (R() < 0.5 ? -1 : 1) * (0.45 + R() * 0.9),
            size: 0.05 + R() * 0.04,
            tone: Math.floor(R() * 3),
          });
        }
      }
      if (depth >= 4) {
        const k = tip ? 1 + Math.floor(R() * 2) : R() < 0.45 ? 1 : 0;
        for (let i = 0; i < k; i++) {
          const b = {
            t: tip ? 0.7 + R() * 0.3 : 0.3 + R() * 0.7,
            off: (R() - 0.5) * 0.12,
            rot: R() * 6.283,
            size: 0.85 + R() * 0.45,
            delay: R() * 0.62,
            node: n,
            key: 0,
            order: 0,
            x: 0,
            y: 0,
            open: 0,
            shown: false,
          };
          n.buds.push(b);
          buds.push(b);
        }
      }
      return n;
    }
    const root = mk(0, 1, 13, 0, 0, 0);

    buds.forEach(function (b, i) {
      b.keep = i % 3 === 0;
    });
    (function thin(n) {
      n.buds = n.buds.filter(function (b) {
        return b.keep;
      });
      n.kids.forEach(thin);
    })(root);
    for (let i = buds.length - 1; i >= 0; i--)
      if (!buds[i].keep) buds.splice(i, 1);
    buds.forEach(function (b) {
      b.at = (b.node.dist + b.t * b.node.len) / maxDist;
      b.key = b.at + R() * 0.25;
    });

    let lo = 1,
      hi = 0;
    buds.forEach(function (b) {
      lo = Math.min(lo, b.at);
      hi = Math.max(hi, b.at);
    });
    buds.forEach(function (b) {
      b.delay = (0.54 * (b.at - lo)) / Math.max(0.001, hi - lo) + R() * 0.07;
    });
    buds.sort(function (p, q) {
      return p.key - q.key;
    });
    buds.forEach(function (b, i) {
      b.order = i;
    });

    let minX = 0,
      maxX = 0,
      top = 0;
    (function walk(n, x, y, ang) {
      const a = ang + n.rel,
        ex = x + Math.sin(a) * n.len,
        ey = y - Math.cos(a) * n.len;
      minX = Math.min(minX, ex);
      maxX = Math.max(maxX, ex);
      top = Math.min(top, ey);
      n.kids.forEach(function (k) {
        walk(k, ex, ey, a);
      });
    })(root, 0, 0, 0);
    return {
      root: root,
      buds: buds,
      maxDist: maxDist,
      count: count,
      minX: minX,
      maxX: maxX,
      height: -top,
    };
  }

  const tree = buildTree(11);
  const CAP = tree.buds.length;

${FRUIT_RUNTIME}
  const fruitLayer = createFruitLayer();
${LIGHT_RUNTIME}
  const bundleLightLayer = createBundleLightLayer();
  let lightBundles = null;

  const scene = document.getElementById("scene");
  const cv = document.getElementById("sky");
  const ctx = cv.getContext("2d");
  const canopy = document.createElement("canvas");
  const canopyContext = canopy.getContext("2d");
  let canopyKey = "";
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let still = media.matches,
    nativeStill = false;
  let W = 0,
    H = 0,
    U = 1,
    baseX = 0,
    groundY = 0,
    dpr = 1;

  function sprite(size, paint) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    paint(c.getContext("2d"), size);
    return c;
  }
  const glow = sprite(128, function (g, s) {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,214,150,.55)");
    r.addColorStop(0.35, "rgba(255,190,120,.18)");
    r.addColorStop(1, "rgba(255,170,110,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
  function flower(petal, heart) {
    return sprite(72, function (g, s) {
      g.translate(s / 2, s / 2);
      g.fillStyle = petal;
      for (let i = 0; i < 5; i++) {
        g.rotate(6.283 / 5);
        g.beginPath();
        g.ellipse(0, -s * 0.24, s * 0.13, s * 0.22, 0, 0, 6.283);
        g.fill();
      }
      g.fillStyle = heart;
      g.beginPath();
      g.arc(0, 0, s * 0.085, 0, 6.283);
      g.fill();
    });
  }
  const bloomOther = flower("#ffe9e0", "#ffb976");
  const bloomMine = flower("#ffd27a", "#fff6dc");

  const starR = rng(5),
    stars = [];
  for (let i = 0; i < 150; i++)
    stars.push({
      x: starR(),
      y: starR() * 0.72,
      r: 0.4 + starR() * 1.1,
      ph: starR() * 6.283,
    });
  const flyR = rng(9),
    flies = [];
  for (let i = 0; i < 26; i++)
    flies.push({
      x: flyR(),
      y: flyR(),
      ph: flyR() * 6.283,
      sp: 0.25 + flyR() * 0.5,
    });

  function resize() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = scene.clientWidth,
      nextH = scene.clientHeight;
    if (nextW === W && nextH === H && nextDpr === dpr) return;
    if (W || H) clearTransient();
    dpr = nextDpr;
    W = nextW;
    H = nextH;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    groundY = H * 0.84;
    const availH = Math.max(1, groundY - H * 0.08);
    const availW = W * 0.84;
    U = Math.min(availH / tree.height, availW / (tree.maxX - tree.minX));
    baseX = W * 0.5 - ((tree.maxX + tree.minX) / 2) * U;
    render();
  }

  let t = 0,
    answerCount = 0,
    lanternCount = 0,
    initialized = false;
  let mine = {},
    threads = [];
  const pulses = [],
    pending = {},
    motes = [];
  let px = 0,
    py = 0,
    tpx = 0,
    tpy = 0,
    selected = -1;
  let lastTs = 0,
    lastPaint = 0,
    clockT = 0,
    raf = null,
    active = true,
    disposed = false;
  let revision = -1,
    paintedRevision = -1,
    bloom = 0,
    bloomTarget = 0;
  const session = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const bloomAt = (v) => smooth((v - 0.79) / 0.16);
  const nightAt = (v) => smooth((v - 0.72) / 0.18);
  const answersAt = () => answerCount;
  const growth = (v) => 0.07 + 0.93 * smooth(v / 0.78);

  const leafBuf = [[], [], []];

  function hill(yBase, amp, freq, shift, fill) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = -64; x <= W + 64; x += 8)
      ctx.lineTo(
        x,
        yBase +
          Math.sin(x * freq + shift) * amp +
          Math.sin(x * freq * 2.3 + shift * 1.7) * amp * 0.35,
      );
    ctx.lineTo(W + 64, H + 64);
    ctx.lineTo(-64, H + 64);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  const groundAt = (x) => groundY + Math.pow((x - baseX) / W, 2) * H * 0.16;

  function drawBranch(n, x, y, ang, g, gDist, ctx) {
    const f = clamp((gDist - n.dist) / n.len, 0, 1);
    n.f = f;
    if (f <= 0) return;
    const a = ang + n.rel;
    const L = n.len * U * f;
    const ex = x + Math.sin(a) * L,
      ey = y - Math.cos(a) * L;
    const cx = (x + ex) / 2 + Math.cos(a) * n.curve * L * 0.22,
      cy = (y + ey) / 2 + Math.sin(a) * n.curve * L * 0.22;
    n.x0 = x;
    n.y0 = y;
    n.cx = cx;
    n.cy = cy;
    n.ex = ex;
    n.ey = ey;
    ctx.lineWidth = Math.max(0.7, n.w * U * 0.0105 * (0.3 + 0.7 * g));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();

    for (let i = 0; i < n.leaves.length; i++) {
      const lf = n.leaves[i];
      if (lf.t > f) continue;
      const sc = clamp((gDist - (n.dist + lf.t * n.len)) / 0.35, 0, 1);
      if (sc <= 0) continue;
      const u = lf.t / f,
        v = 1 - u;
      const px = v * v * x + 2 * v * u * cx + u * u * ex,
        py = v * v * y + 2 * v * u * cy + u * u * ey;
      const s = lf.size * U * sc,
        rot = a + lf.a - 1.5708;
      leafBuf[lf.tone].push(
        px + Math.cos(rot) * s * 0.9,
        py + Math.sin(rot) * s * 0.9,
        s,
        rot,
      );
    }
    for (let i = 0; i < n.buds.length; i++) {
      const b = n.buds[i];
      b.shown = false;
      if (b.t > f) continue;
      const u = b.t / f,
        v = 1 - u;
      b.x = v * v * x + 2 * v * u * cx + u * u * ex + Math.cos(a) * b.off * U;
      b.y = v * v * y + 2 * v * u * cy + u * u * ey + Math.sin(a) * b.off * U;
      b.shown = true;
    }
    if (n.depth === 0 && g < 0.3) {
      const al = clamp((0.3 - g) / 0.1, 0, 1),
        s = U * 0.11;
      ctx.save();
      ctx.globalAlpha = al;
      ctx.fillStyle = C.leaf1(t);
      for (let k = -1; k <= 1; k += 2) {
        const rot = a + k * 0.95 - 1.5708;
        ctx.beginPath();
        ctx.ellipse(
          ex + Math.cos(rot) * s,
          ey + Math.sin(rot) * s,
          s,
          s * 0.42,
          rot,
          0,
          6.283,
        );
        ctx.fill();
      }
      ctx.restore();
    }
    for (let i = 0; i < n.kids.length; i++)
      drawBranch(n.kids[i], ex, ey, a, g, gDist, ctx);
  }

  function drawCanopy(g) {
    const key = [W, H, dpr, t, g].join(":");
    if (key !== canopyKey) {
      canopyKey = key;
      canopy.width = cv.width;
      canopy.height = cv.height;
      const ctx = canopyContext;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      leafBuf[0].length = leafBuf[1].length = leafBuf[2].length = 0;
      ctx.strokeStyle = C.bark(t);
      ctx.lineCap = "round";
      tree.buds.forEach(function (bud) {
        bud.shown = false;
      });
      drawBranch(
        tree.root,
        baseX,
        groundY + 3,
        0,
        g,
        g * tree.maxDist * 1.02,
        ctx,
      );
      const tones = [C.leaf0(t), C.leaf1(t), C.leaf2(t)];
      for (let k = 0; k < 3; k++) {
        const L = leafBuf[k];
        ctx.fillStyle = tones[k];
        ctx.beginPath();
        for (let i = 0; i < L.length; i += 4) {
          ctx.moveTo(
            L[i] + Math.cos(L[i + 3]) * L[i + 2],
            L[i + 1] + Math.sin(L[i + 3]) * L[i + 2],
          );
          ctx.ellipse(
            L[i],
            L[i + 1],
            L[i + 2],
            L[i + 2] * 0.44,
            L[i + 3],
            0,
            6.283,
          );
        }
        ctx.fill();
      }
    }
    ctx.drawImage(canopy, 0, 0, W, H);
  }

  function render() {
    if (!W) return;
    const g = growth(t),
      b = bloom,
      nf = nightAt(t),
      n = answersAt(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = ctx.createLinearGradient(0, 0, 0, groundY + 40);
    sky.addColorStop(0, C.skyTop(t));
    sky.addColorStop(1, C.skyBot(t));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (nf > 0.01) {
      ctx.save();
      ctx.translate(-px * 5, -py * 3);
      ctx.fillStyle = "#fdf3e4";
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.globalAlpha =
          nf *
          (0.35 +
            0.5 * (still ? 0.6 : 0.5 + 0.5 * Math.sin(clockT * 1.3 + s.ph)));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283);
        ctx.fill();
      }
      const mx = W * 0.86,
        my = H * (W < 720 ? 0.36 : 0.2),
        mr = Math.max(14, Math.min(W, H) * 0.038);
      ctx.globalAlpha = nf * 0.5;
      ctx.drawImage(glow, mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      ctx.globalAlpha = nf;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, 6.283);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    const warm = smooth((t - 0.5) / 0.18) * (1 - smooth((t - 0.74) / 0.12));
    if (warm > 0.01) {
      const sx = W * 0.2,
        sy = groundY - H * 0.04,
        sr = Math.max(W, H) * 0.5;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, "rgba(255,214,150," + 0.75 * warm + ")");
      sg.addColorStop(0.25, "rgba(255,170,110," + 0.3 * warm + ")");
      sg.addColorStop(1, "rgba(255,150,110,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(-px * 10, -py * 4);
    hill(groundY - H * 0.075, H * 0.022, 0.0042, 1.2, C.hillFar(t));
    ctx.restore();
    ctx.save();
    ctx.translate(-px * 18, -py * 6);
    hill(groundY - H * 0.03, H * 0.016, 0.0061, 4.1, C.hillMid(t));
    ctx.restore();

    ctx.save();
    ctx.translate(-px * 30, -py * 9);

    if (b > 0.01) {
      const hx = baseX + ((tree.maxX + tree.minX) / 2) * U,
        hy = groundY - tree.height * U * 0.62,
        hr = tree.height * U * 0.85;
      ctx.globalAlpha = 0.5 * b;
      ctx.drawImage(glow, hx - hr, hy - hr, hr * 2, hr * 2);
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = -64; x <= W + 64; x += 8) ctx.lineTo(x, groundAt(x));
    ctx.lineTo(W + 64, H + 64);
    ctx.lineTo(-64, H + 64);
    ctx.closePath();
    ctx.fillStyle = C.ground(t);
    ctx.fill();

    drawCanopy(g);
    tree.buds.forEach(function (bud) {
      bud.open = 0;
    });

    ctx.strokeStyle = C.ground(t);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = -9; i <= 9; i++) {
      const gx = baseX + i * U * 0.035,
        gy = groundAt(gx) + 2;
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(
        gx + i * 0.6,
        gy - U * 0.07,
        gx + i * 1.4,
        gy - U * (0.09 + ((i * i) % 5) * 0.012),
      );
    }
    ctx.stroke();

    const budR = Math.max(1.4, U * 0.014),
      flowerR = Math.max(5, U * 0.062);
    const buds = tree.buds;
    if (b > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n && i < buds.length; i++) {
        const d = buds[i];
        if (!d.shown) continue;
        const o = smooth((b - d.delay) / 0.38);
        if (o <= 0 || pending[i]) continue;
        const r = flowerR * d.size * (mine[i] ? 4.6 : 3.2);
        ctx.globalAlpha = o * (0.35 + 0.55 * nf);
        ctx.drawImage(glow, d.x - r, d.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < n && i < buds.length; i++) {
      const d = buds[i];
      if (!d.shown) continue;
      const o = smooth((b - d.delay) / 0.38);
      d.open = o;
      if (pending[i]) continue;
      if (o < 1) {
        ctx.globalAlpha = 1 - o;
        ctx.fillStyle = mine[i] ? "#ffd27a" : "#f4c9c0";
        ctx.beginPath();
        ctx.arc(d.x, d.y, budR * (mine[i] ? 1.7 : 1), 0, 6.283);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (o > 0) {
        const r = flowerR * d.size * (mine[i] ? 1.35 : 1) * (0.3 + 0.7 * o);
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot + (1 - o) * 1.2);
        ctx.globalAlpha = Math.min(1, o * 1.4);
        ctx.drawImage(mine[i] ? bloomMine : bloomOther, -r, -r, r * 2, r * 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    if (b > 0.75) {
      const ta = smooth((b - 0.75) / 0.25),
        lr = Math.max(5, U * 0.036);
      for (let k = 0; k < threads.length; k++) {
        const th = threads[k],
          A = buds[th.a],
          B = buds[th.b];
        if (th.a >= n || th.b >= n || !A.shown || !B.shown) continue;
        const al = ta * Math.min(A.open, B.open);
        if (al < 0.03) continue;
        const dist = Math.hypot(B.x - A.x, B.y - A.y),
          qx = (A.x + B.x) / 2,
          qy = (A.y + B.y) / 2 + dist * 0.34;
        ctx.globalAlpha = al * 0.4;
        ctx.strokeStyle = "#ffe2b0";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(qx, qy, B.x, B.y);
        ctx.stroke();
        for (let j = 0; j < th.count; j++) {
          const u = (j + 1) / (th.count + 1),
            v = 1 - u;
          const lx = v * v * A.x + 2 * v * u * qx + u * u * B.x,
            ly = v * v * A.y + 2 * v * u * qy + u * u * B.y;
          const tw = still
            ? 0.85
            : 0.65 + 0.35 * Math.sin(clockT * 2.1 + th.ph + j * 1.9);
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = al * tw;
          ctx.drawImage(glow, lx - lr * 2.4, ly - lr * 2.4, lr * 4.8, lr * 4.8);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = al;
          ctx.fillStyle = th.own ? "#ffd27a" : "#fff1d6";
          ctx.beginPath();
          ctx.arc(lx, ly, th.own ? 2.2 : 1.6, 0, 6.283);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < lanternCount; i++) {
      const d = buds[(i * 37 + 7) % buds.length];
      const anchorX = d.shown ? d.x : tree.root.ex;
      const anchorY = d.shown ? d.y : tree.root.ey;
      const x = anchorX + (d.shown ? 0 : ((i % 5) - 2) * 9),
        y = anchorY + 15 + (d.shown ? 0 : Math.floor(i / 5) * 9),
        r = Math.max(3, U * 0.035);
      ctx.strokeStyle = "rgba(255,226,176,.65)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.65;
      ctx.drawImage(glow, x - r * 5, y - r * 5, r * 10, r * 10);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffd27a";
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.75, r, 0, 0, 6.283);
      ctx.fill();
    }

    fruitLayer.draw(ctx, { buds, unit: U, rootX: baseX, rootY: groundY + 3, glow }, clockT, still);
    bundleLightLayer.draw(ctx, { buds, unit: U, rootX: baseX, rootY: groundY + 3, width: W, height: H, glow, night: nf }, clockT, still);

    if (
      selected >= 0 &&
      buds[selected] &&
      buds[selected].shown &&
      selected < n
    ) {
      const d = buds[selected];
      ctx.strokeStyle = "#ffd27a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, flowerR * 1.9, 0, 6.283);
      ctx.stroke();
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i],
        d = buds[p.i],
        age = (clockT - p.t0) / 1.6;
      if (age >= 1 || !d) {
        pulses.splice(i, 1);
        continue;
      }
      if (!d.shown) continue;
      ctx.strokeStyle = "rgba(255,210,122," + (1 - age) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, budR * 2 + age * U * 0.22, 0, 6.283);
      ctx.stroke();
    }

    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i],
        p = motePos(m);
      m.trail.push(p.x, p.y);
      if (m.trail.length > 36) m.trail.splice(0, 2);
      ctx.fillStyle = "#ffd27a";
      for (let k = 0; k < m.trail.length; k += 2) {
        ctx.globalAlpha = 0.5 * (k / m.trail.length);
        ctx.beginPath();
        ctx.arc(
          m.trail[k],
          m.trail[k + 1],
          1 + 1.6 * (k / m.trail.length),
          0,
          6.283,
        );
        ctx.fill();
      }
      const mr = Math.max(16, U * 0.16);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glow, p.x - mr, p.y - mr, mr * 2, mr * 2);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff6dc";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, 6.283);
      ctx.fill();
      if (p.done) {
        motes.splice(i, 1);
        delete pending[m.i];
        pulses.push({ i: m.i, t0: clockT });
      }
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    if (nf > 0.2 && !still && lightBundles === null) {
      ctx.save();
      ctx.translate(-px * 46, -py * 14);
      ctx.fillStyle = "#ffe6a8";
      for (let i = 0; i < flies.length; i++) {
        const f = flies[i];
        const fx = (f.x + Math.sin(clockT * 0.11 * f.sp + f.ph) * 0.05) * W,
          fy =
            groundY -
            f.y * H * 0.42 +
            Math.sin(clockT * 0.5 * f.sp + f.ph * 2) * 14;
        ctx.globalAlpha =
          nf *
          (0.25 + 0.55 * Math.max(0, Math.sin(clockT * 1.1 * f.sp + f.ph)));
        ctx.beginPath();
        ctx.arc(fx, fy, 1.4, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    paintedRevision = revision;
  }

  function motePos(m) {
    const age = clockT - m.t0,
      FLY = 0.6,
      CLIMB = 1.8;
    const footX = baseX,
      footY = groundY + 3;
    if (age < FLY) {
      const u = smooth(age / FLY),
        v = 1 - u,
        mx = (m.fx + footX) / 2,
        my = Math.min(m.fy, footY) - 60;
      return {
        x: v * v * m.fx + 2 * v * u * mx + u * u * footX,
        y: v * v * m.fy + 2 * v * u * my + u * u * footY,
        done: false,
      };
    }
    const d = tree.buds[m.i],
      chain = [],
      segs = [];
    for (let n = d.node; n; n = n.parent) chain.unshift(n);
    let total = 0;
    for (let k = 0; k < chain.length; k++) {
      const n = chain[k];
      if (!(n.f > 0)) break;
      const uMax = n === d.node ? Math.min(1, d.t / n.f) : 1;
      const L = n.len * U * n.f * uMax;
      segs.push([n, uMax, L]);
      total += L;
      if (n.f < 1) break;
    }
    const done = age >= FLY + CLIMB;
    if (!segs.length) return { x: footX, y: footY, done: done };
    let dist = smooth((age - FLY) / CLIMB) * total;
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      if (dist <= s[2] || k === segs.length - 1) {
        const u = clamp(s[2] > 0 ? dist / s[2] : 1, 0, 1) * s[1],
          v = 1 - u,
          n = s[0];
        return {
          x: v * v * n.x0 + 2 * v * u * n.cx + u * u * n.ex,
          y: v * v * n.y0 + 2 * v * u * n.cy + u * u * n.ey,
          done: done,
        };
      }
      dist -= s[2];
    }
    return { x: footX, y: footY, done: done };
  }

  function send(message) {
    if (window.ReactNativeWebView)
      window.ReactNativeWebView.postMessage(
        JSON.stringify(Object.assign({ session: session }, message)),
      );
  }
  function clearTransient() {
    pulses.length = motes.length = 0;
    Object.keys(pending).forEach(function (key) {
      delete pending[key];
    });
    selected = -1;
    px = py = tpx = tpy = 0;
  }
  function schedule(force = false) {
    if (
      raf === null &&
      !disposed &&
      (force || (active && !document.hidden && !still))
    )
      raf = requestAnimationFrame(frame);
  }
  function animationTime() {
    return (
      clockT + (lastTs ? Math.max(0, (performance.now() - lastTs) / 1000) : 0)
    );
  }
  function refresh() {
    if (!active || document.hidden || still) {
      clockT = animationTime();
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      lastTs = lastPaint = 0;
    } else if (!lastTs) {
      lastTs = performance.now();
    }
    if (still) {
      bloom = bloomTarget;
      clearTransient();
    }
    schedule(true);
  }
  function receive(event) {
    if (typeof event.data !== "string" || event.data.length > ${TREE_MAX_STATE_LENGTH}) return;
    let value;
    try {
      value = JSON.parse(event.data);
    } catch {
      return;
    }
    if (value && value.type === "hello") {
      send({ type: "ready" });
      return;
    }
    if (
      !value ||
      value.type !== "state" ||
      value.session !== session ||
      !Number.isInteger(value.revision) ||
      value.revision <= revision
    )
      return;
    if (
      !Number.isFinite(value.timeOfDay) ||
      !Number.isInteger(value.answers) ||
      value.answers < 0 ||
      !Array.isArray(value.mine) ||
      !Array.isArray(value.notes) ||
      !Number.isInteger(value.lanterns) ||
      value.lanterns < 0 ||
      (value.lightBundles !== undefined && (!Number.isInteger(value.lightBundles) || value.lightBundles < 0 || value.lightBundles > 1000)) ||
      (Array.isArray(value.fruits) && value.fruits.length > ${TREE_MAX_FRUITS}) ||
      (Array.isArray(value.wateringEvent?.fruitIds) && value.wateringEvent.fruitIds.length > ${TREE_MAX_EVENT_FRUITS})
    )
      return;
    const nextT = clamp(value.timeOfDay, 0, 1),
      nextCount = Math.min(CAP, value.answers);
    const validIndex = (i) => Number.isInteger(i) && i >= 0 && i < nextCount;
    const nextMine = {};
    value.mine.slice(0, CAP).forEach(function (i) {
      if (validIndex(i)) nextMine[i] = true;
    });
    const reset = initialized && (nextCount < answerCount || nextT < t);
    if (reset) clearTransient();
    const arrivals = [];
    if (initialized && !reset) {
      for (let i = 0; i < nextCount; i++) {
        if (i >= answerCount || (nextMine[i] && !mine[i])) arrivals.push(i);
      }
    }
    t = nextT;
    answerCount = nextCount;
    mine = nextMine;
    lanternCount = Math.min(64, value.lanterns);
    threads = value.notes
      .slice(0, 512)
      .filter(function (note) {
        return (
          note &&
          validIndex(note.from) &&
          validIndex(note.to) &&
          note.from !== note.to &&
          Number.isInteger(note.count) &&
          note.count > 0
        );
      })
      .map(function (note) {
        return {
          a: note.from,
          b: note.to,
          count: Math.min(32, note.count),
          own: note.own === true,
          ph: note.from * 1.7 + note.to * 0.9,
        };
      });
    nativeStill = value.reduceMotion === true;
    still = nativeStill || media.matches;
    active = value.active !== false;
    bloomTarget = bloomAt(t);
    if (!initialized || reset || still) bloom = bloomTarget;
    revision = value.revision;
    initialized = true;
    fruitLayer.update(value.fruits, value.lightBundles !== undefined || value.lightEvent !== undefined ? null : value.wateringEvent, animationTime(), still);
    if (value.lightBundles !== undefined) {
      lightBundles = value.lightBundles;
      bundleLightLayer.update(lightBundles, value.goldenLightBundles, value.lightEvent, animationTime(), still);
    }
    if (!still)
      arrivals.slice(-12).forEach(function (i) {
        if (pending[i]) return;
        pending[i] = true;
        motes.push({
          i: i,
          t0: animationTime(),
          fx: baseX,
          fy: H - 16,
          trail: [],
        });
      });
    refresh();
  }
  let down = null;
  function pointerDown(event) {
    down = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    cv.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (
      down &&
      down.id === event.pointerId &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12
    )
      down.moved = true;
    if (still) return;
    const r = cv.getBoundingClientRect();
    tpx = clamp(((event.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    tpy = clamp(((event.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
  }
  function pointerUp(event) {
    const tap = down && down.id === event.pointerId && !down.moved;
    down = null;
    tpx = tpy = 0;
    if (!tap || !initialized) return;
    const r = cv.getBoundingClientRect(),
      x = event.clientX - r.left + px * 30,
      y = event.clientY - r.top + py * 9;
    let best = -1,
      distance = 160 * 160;
    for (let i = 0; i < answerCount; i++) {
      const d = tree.buds[i];
      if (!d) continue;
      const q = (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y);
      if (q < distance) {
        distance = q;
        best = i;
      }
    }
    selected = best;
    if (best >= 0)
      send({ type: "tap", revision: paintedRevision, index: best });
    if (still) render();
  }
  function pointerCancel() {
    down = null;
    tpx = tpy = 0;
  }
  function motionChanged() {
    still = nativeStill || media.matches;
    refresh();
  }
  function visibilityChanged() {
    refresh();
  }
  function pageHide(event) {
    if (!event.persisted) {
      dispose();
      return;
    }
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    clockT = animationTime();
    lastTs = lastPaint = 0;
  }
  function pageShow(event) {
    if (event.persisted) refresh();
  }
  function frame(ts) {
    raf = null;
    if (disposed) return;
    if (!active || document.hidden || still) {
      render();
      return;
    }
    if (!lastPaint || ts - lastPaint >= 1000 / 30 - 1) {
      const elapsed = lastTs ? Math.max(0, (ts - lastTs) / 1000) : 0;
      const dt = Math.min(0.1, elapsed);
      lastTs = lastPaint = ts;
      clockT += elapsed;
      px += (tpx - px) * Math.min(1, dt * 4);
      py += (tpy - py) * Math.min(1, dt * 4);
      bloom += (bloomTarget - bloom) * (1 - Math.exp(-elapsed * 2.8));
      if (Math.abs(bloomTarget - bloom) < 0.001) bloom = bloomTarget;
      render();
    }
    schedule();
  }
  function dispose() {
    disposed = true;
    if (raf !== null) cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener("message", receive);
    document.removeEventListener("message", receive);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", visibilityChanged);
    media.removeEventListener("change", motionChanged);
    cv.removeEventListener("pointerdown", pointerDown);
    cv.removeEventListener("pointermove", pointerMove);
    cv.removeEventListener("pointerup", pointerUp);
    cv.removeEventListener("pointercancel", pointerCancel);
    cv.removeEventListener("lostpointercapture", pointerCancel);
    window.removeEventListener("pagehide", pageHide);
    window.removeEventListener("pageshow", pageShow);
    clearTransient();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(scene);
  window.addEventListener("message", receive);
  document.addEventListener("message", receive);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", visibilityChanged);
  media.addEventListener("change", motionChanged);
  cv.addEventListener("pointerdown", pointerDown);
  cv.addEventListener("pointermove", pointerMove);
  cv.addEventListener("pointerup", pointerUp);
  cv.addEventListener("pointercancel", pointerCancel);
  cv.addEventListener("lostpointercapture", pointerCancel);
  window.addEventListener("pagehide", pageHide);
  window.addEventListener("pageshow", pageShow);
  resize();
  send({ type: "ready" });
})();
</script>
</body>
</html>`;
