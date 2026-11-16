import type { TreeFruit, TreeWateringEvent } from "./types";
import { TREE_MAX_ID_LENGTH } from "./limits";

const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= TREE_MAX_ID_LENGTH &&
  /^[\x00-\x7f]+$/.test(value);

export function normalizeFruits(value: unknown): TreeFruit[] {
  if (!Array.isArray(value)) return [];
  const fruits = new Map<string, TreeFruit>();
  for (const fruit of value) {
    if (
      !fruit ||
      !validId(fruit.id) ||
      typeof fruit.golden !== "boolean" ||
      fruits.has(fruit.id)
    )
      continue;
    fruits.set(fruit.id, {
      id: fruit.id,
      golden: fruit.golden,
      ...(typeof fruit.mine === "boolean" ? { mine: fruit.mine } : {}),
    });
  }
  return [...fruits.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

export function normalizeWateringEvent(
  value: unknown,
): TreeWateringEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<TreeWateringEvent>;
  const revision = event.revision;
  if (
    !validId(event.id) ||
    !validId(event.fruitId) ||
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return null;
  if (
    event.fruitIds !== undefined &&
    (!Array.isArray(event.fruitIds) ||
      !event.fruitIds.length ||
      !event.fruitIds.every(validId))
  )
    return null;
  return {
    id: event.id,
    fruitId: event.fruitId,
    revision,
    ...(event.fruitIds !== undefined
      ? { fruitIds: [...new Set(event.fruitIds)] }
      : {}),
  };
}

export function fruitAnchorSeed(id: string) {
  if (!validId(id)) return null;
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  const key = hash >>> 0;
  hash = Math.imul(hash ^ 0x9e3779b9, 16777619) >>> 0;
  return {
    key,
    offsetX: ((hash & 1023) / 1023 - 0.5) * 0.12,
    offsetY: (((hash >>> 10) & 1023) / 1023 - 0.5) * 0.08,
  };
}

export function fruitAnchor(id: string, sites: number) {
  const anchor = fruitAnchorSeed(id);
  if (!anchor || !Number.isSafeInteger(sites) || sites < 1) return null;
  return {
    site: anchor.key % sites,
    offsetX: anchor.offsetX,
    offsetY: anchor.offsetY,
  };
}
