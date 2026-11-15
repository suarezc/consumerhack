export const FRUIT_RUNTIME = String.raw`
function createWateringTracker() {
  let initialized = false;
  const consumed = new Set();
  return {
    observe(value, fruits) {
      const validId = (id) =>
        typeof id === "string" && id.length > 0 && id.length <= 256;
      const event =
        value &&
        validId(value.id) &&
        validId(value.fruitId) &&
        Number.isSafeInteger(value.revision) &&
        value.revision >= 1 &&
        (value.fruitIds === undefined ||
          (Array.isArray(value.fruitIds) &&
            value.fruitIds.length > 0 &&
            value.fruitIds.every(validId)))
          ? {
              id: value.id,
              fruitId: value.fruitId,
              revision: value.revision,
              ...(value.fruitIds !== undefined
                ? { fruitIds: [...new Set(value.fruitIds)] }
                : {}),
            }
          : null;
      if (!initialized) {
        initialized = true;
        if (event) consumed.add(event.id);
        return null;
      }
      if (
        !event ||
        consumed.has(event.id) ||
        !(event.fruitIds ?? [event.fruitId]).every((id) =>
          fruits.some((fruit) => fruit.id === id),
        )
      )
        return null;
      consumed.add(event.id);
      return event;
    },
  };
}

function createFruitLayer() {
  let fruits = [],
    effects = [];
  const tracker = createWateringTracker();
  const ease = (value) => {
    const v = Math.max(0, Math.min(1, value));
    return v * v * (3 - 2 * v);
  };
  function target(fruit, geometry) {
    const bud = geometry.buds[fruit.anchor.key % geometry.buds.length];
    if (!bud || !bud.shown) return null;
    return {
      x: bud.x + fruit.anchor.offsetX * geometry.unit,
      y:
        bud.y +
        fruit.anchor.offsetY * geometry.unit +
        Math.max(7, geometry.unit * 0.08),
    };
  }
  return {
    update(value, event, now, reduced) {
      const ids = new Set();
      fruits = (Array.isArray(value) ? value : [])
        .filter((fruit) => {
          if (
            !fruit ||
            typeof fruit.id !== "string" ||
            !fruit.id.length ||
            fruit.id.length > 256 ||
            ids.has(fruit.id) ||
            typeof fruit.golden !== "boolean"
          )
            return false;
          const a = fruit.anchor;
          if (
            !a ||
            !Number.isInteger(a.key) ||
            a.key < 0 ||
            a.key > 4294967295 ||
            !Number.isFinite(a.offsetX) ||
            Math.abs(a.offsetX) > 0.06 ||
            !Number.isFinite(a.offsetY) ||
            Math.abs(a.offsetY) > 0.04
          )
            return false;
          ids.add(fruit.id);
          return true;
        });
      const eligible = tracker.observe(event, fruits);
      effects = effects.filter((effect) =>
        effect.fruitIds.some((id) => fruits.some((fruit) => fruit.id === id)),
      );
      if (reduced) effects = [];
      else if (eligible)
        effects.push({ fruitIds: eligible.fruitIds ?? [eligible.fruitId], t0: now });
      if (effects.length > 6) effects.splice(0, effects.length - 6);
    },
    draw(ctx, geometry, now, reduced) {
      if (!geometry.buds.length) return;
      if (reduced) effects = [];
      effects = effects.filter((effect) => now - effect.t0 < 1.8);
      const unit = geometry.unit,
        radius = Math.max(4, unit * 0.047);
      ctx.save();
      for (const fruit of fruits) {
        const point = target(fruit, geometry);
        if (
          !point ||
          effects.some(
            (effect) => effect.fruitIds.includes(fruit.id) && now - effect.t0 < 1.65,
          )
        )
          continue;
        const { x, y } = point;
        ctx.strokeStyle = "#8da585";
        ctx.lineWidth = Math.max(0.8, radius * 0.16);
        ctx.beginPath();
        ctx.moveTo(x, y - radius * 1.6);
        ctx.quadraticCurveTo(
          x + radius * 0.5,
          y - radius * 1.3,
          x,
          y - radius * 0.7,
        );
        ctx.stroke();
        ctx.fillStyle = "#6f936f";
        ctx.beginPath();
        ctx.ellipse(
          x + radius * 0.6,
          y - radius * 1.25,
          radius * 0.65,
          radius * 0.24,
          -0.45,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (fruit.golden || fruit.mine === true) {
          ctx.globalAlpha = fruit.golden ? 0.5 : 0.25;
          ctx.drawImage(
            geometry.glow,
            x - radius * 4,
            y - radius * 4,
            radius * 8,
            radius * 8,
          );
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = fruit.golden ? "#ffd27a" : "#d78c78";
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 1.08, 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = fruit.golden ? "#fff0c4" : "#f2bca2";
        ctx.beginPath();
        ctx.ellipse(
          x - radius * 0.3,
          y - radius * 0.32,
          radius * 0.22,
          radius * 0.36,
          0.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (fruit.mine === true) {
          ctx.strokeStyle = "#ffe5ad";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(x, y, radius * 1.3, radius * 1.38, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      for (const effect of effects) {
        const age = Math.max(0, now - effect.t0);
        const targets = effect.fruitIds
          .map((id) => fruits.find((fruit) => fruit.id === id))
          .filter(Boolean);
        if (!targets.length) continue;
        const rootX = geometry.rootX,
          rootY = geometry.rootY;
        if (age < 0.75) {
          const flow = ease(age / 0.75),
            startX = rootX + unit * 0.42,
            startY = rootY - unit * 0.58;
          ctx.strokeStyle = "#d5e6d4";
          ctx.lineWidth = 1.3;
          ctx.globalAlpha = Math.sin(Math.PI * flow) * 0.8;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(
            rootX + unit * 0.2,
            rootY - unit * 0.5,
            rootX,
            rootY,
          );
          ctx.stroke();
          for (let j = 0; j < 4; j++) {
            const p = (flow + j * 0.22) % 1,
              v = 1 - p;
            const x =
              v * v * startX + 2 * v * p * (rootX + unit * 0.2) + p * p * rootX;
            const y =
              v * v * startY + 2 * v * p * (rootY - unit * 0.5) + p * p * rootY;
            ctx.fillStyle = "#f0f3d6";
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        const pulse = ease((age - 0.25) / 1.3);
        ctx.globalAlpha = (1 - pulse) * 0.65;
        ctx.strokeStyle = "#ffd27a";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(
          rootX,
          rootY,
          unit * (0.05 + pulse * 0.26),
          unit * (0.02 + pulse * 0.07),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        for (const fruit of targets) {
          const point = target(fruit, geometry);
          if (point && age >= 0.65) {
            const p = ease((age - 0.65) / 1),
              v = 1 - p,
              x = v * rootX + p * point.x,
              y =
                v * v * rootY +
                2 * v * p * (point.y - unit * 0.3) +
                p * p * point.y;
            ctx.globalAlpha = 1;
            ctx.drawImage(
              geometry.glow,
              x - radius * 3.5,
              y - radius * 3.5,
              radius * 7,
              radius * 7,
            );
            ctx.fillStyle = "#fff0c4";
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    },
  };
}
`;
