export const WEATHER_RUNTIME = String.raw`
function createWeatherLayer() {
  let mode = "clear";
  const seed = i => ((Math.imul(i + 3, 2246822519) ^ 3266489917) >>> 0) / 4294967295;
  return {
    update(value) { if (value === "clear" || value === "rain" || value === "snow") mode = value; },
    background(ctx, scene, now, reduced) {
      if (mode === "clear") return;
      ctx.save();
      ctx.fillStyle = mode === "snow" ? "rgba(192,209,226,.12)" : "rgba(57,77,105,.17)";
      ctx.fillRect(0, 0, scene.width, scene.height);
      ctx.fillStyle = mode === "snow" ? "rgba(229,237,242,.78)" : "rgba(24,42,64,.2)";
      ctx.beginPath();
      ctx.moveTo(0, scene.height);
      for (let x = 0; x <= scene.width + 16; x += 16) ctx.lineTo(x, scene.groundAt(x) + 1);
      ctx.lineTo(scene.width, scene.height);
      ctx.closePath();
      ctx.fill();
      const snow = mode === "snow", count = reduced ? (snow ? 20 : 12) : (snow ? 48 : 60);
      for (let i = 0; i < count; i++) {
        const a = seed(i), b = seed(i + 83);
        const phase = reduced ? 0 : now;
        const x = a * scene.width + (snow ? Math.sin(phase * .45 + i) * 12 : 0);
        const y = (b * (scene.height + 50) + phase * (snow ? 14 + a * 16 : 160 + a * 100)) % (scene.height + 50) - 25;
        ctx.beginPath();
        if (snow) {
          ctx.fillStyle = "rgba(246,248,248,.8)";
          ctx.arc(x, y, 1 + a * 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(192,211,224,.55)";
          ctx.lineWidth = .7 + a * .5;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 4, y + 10 + a * 8);
          ctx.stroke();
        }
      }
      if (!snow) {
        ctx.strokeStyle = "rgba(192,211,224,.28)";
        ctx.lineWidth = .7;
        for (let i = 0; i < 8; i++) {
          const x = seed(i + 9) * scene.width;
          const p = reduced ? .5 : (now * .6 + seed(i + 31)) % 1;
          ctx.globalAlpha = 1 - p;
          ctx.beginPath();
          ctx.ellipse(x, scene.groundAt(x) + 5, 2 + p * 8, .8 + p * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    canopy(ctx, scene) {
      if (mode === "clear") return;
      ctx.save();
      let painted = 0;
      for (let i = 0; i < scene.buds.length && painted < 32; i += 11) {
        const bud = scene.buds[i];
        if (!bud.shown) continue;
        painted++;
        ctx.beginPath();
        if (mode === "snow") {
          ctx.fillStyle = "rgba(230,239,244,.86)";
          ctx.ellipse(bud.x, bud.y - 2, Math.max(3, scene.unit * .052), Math.max(1.4, scene.unit * .019), -.12, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(188,213,225,.36)";
          ctx.lineWidth = .8;
          ctx.moveTo(bud.x - 3, bud.y - 1);
          ctx.lineTo(bud.x + 2, bud.y - 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };
}
`;
