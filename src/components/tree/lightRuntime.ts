export const LIGHT_RUNTIME = String.raw`
function createBundleLightLayer() {
  let count = 0;
  let golden = 0, initialized = false, pulseStart = -Infinity;
  const consumed = new Set();
  const seed = (index, salt) => ((Math.imul(index + 1, 2654435761) ^ salt) >>> 0) / 4294967295;
  return {
    update(value, subset, event, now, reduced) {
      if (Number.isInteger(value) && value >= 0 && value <= 1000) count = value;
      golden = Number.isInteger(subset) ? Math.min(count, Math.max(0, subset)) : 0;
      const valid = event && typeof event.id === "string" && event.id.length > 0 && event.id.length <= 128 && Number.isSafeInteger(event.revision) && event.revision > 0 && Number.isInteger(event.lightBundles) && event.lightBundles > 0 && event.lightBundles <= count;
      if (!initialized) { initialized = true; if (valid) consumed.add(event.id); }
      else if (valid && !consumed.has(event.id)) { consumed.add(event.id); if (!reduced) pulseStart = now; }
    },
    draw(ctx, scene, now, reduced) {
      if (!count) return;
      const visible = scene.buds.filter(bud => bud.shown);
      const radius = Math.max(2.2, scene.unit * 0.022);
      ctx.save();
      let previous = null;
      for (let i = 0; i < count; i++) {
        const a = seed(i, 0x9e3779b9), b = seed(i, 0x85ebca6b);
        const bud = visible.length ? visible[Math.floor(a * visible.length) % visible.length] : null;
        const x = bud ? bud.x : scene.rootX + (a - 0.5) * scene.unit * 0.22;
        const y = (bud ? bud.y : scene.rootY - scene.unit * (0.18 + b * 0.15)) + radius * 2;
        ctx.strokeStyle = "rgba(212,190,133,.42)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        if (previous) {
          ctx.moveTo(previous.x, previous.y);
          ctx.quadraticCurveTo((previous.x + x) / 2, Math.max(previous.y, y) + scene.unit * 0.1, x, y);
        } else {
          ctx.moveTo(x, y - radius * 3);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        previous = { x, y };
        const shimmer = reduced ? 1 : 0.85 + Math.sin(now * 1.2 + i * 2.4) * 0.15;
        ctx.globalAlpha = shimmer * (0.55 + scene.night * 0.45);
        ctx.drawImage(scene.glow, x - radius * 6, y - radius * 6, radius * 12, radius * 12);
        ctx.fillStyle = i < golden ? "#ffce69" : "#ffdf99";
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 0.7, radius, 0, 0, Math.PI * 2);
        ctx.fill();
        const drift = reduced ? 0 : Math.sin(now * (0.6 + a) + i * 1.7);
        const fx = scene.width * (0.12 + a * 0.76) + drift * 9;
        const fy = scene.rootY - scene.height * (0.04 + b * 0.43) + drift * 7;
        const glow = Math.max(9, scene.unit * 0.1);
        ctx.drawImage(scene.glow, fx - glow, fy - glow, glow * 2, glow * 2);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#fff4c8";
        ctx.beginPath();
        ctx.arc(fx, fy, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      const age = now - pulseStart;
      if (!reduced && age >= 0 && age < 1.4) {
        const p = age / 1.4;
        ctx.globalAlpha = (1 - p) * 0.65;
        ctx.strokeStyle = "#ffdf99";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(scene.rootX, scene.rootY, scene.unit * (0.04 + p * 0.34), scene.unit * (0.015 + p * 0.09), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}
`;
