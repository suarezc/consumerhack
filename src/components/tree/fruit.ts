import type { TreeFruit, TreeWateringEvent } from "./types";

const validId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 256;

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
  return [...fruits.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, 64);
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
  return { id: event.id, fruitId: event.fruitId, revision };
}

export function fruitAnchor(id: string, sites: number) {
  if (!validId(id) || !Number.isSafeInteger(sites) || sites < 1) return null;
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  const site = (hash >>> 0) % sites;
  hash = Math.imul(hash ^ 0x9e3779b9, 16777619) >>> 0;
  return {
    site,
    offsetX: ((hash & 1023) / 1023 - 0.5) * 0.12,
    offsetY: (((hash >>> 10) & 1023) / 1023 - 0.5) * 0.08,
  };
}

export function createWateringTracker() {
  let initialized = false;
  const consumed = new Set<string>();
  return {
    observe(
      value: unknown,
      fruits: readonly TreeFruit[],
    ): TreeWateringEvent | null {
      const event = normalizeWateringEvent(value);
      if (!initialized) {
        initialized = true;
        if (event) consumed.add(event.id);
        return null;
      }
      if (
        !event ||
        consumed.has(event.id) ||
        !fruits.some((fruit) => fruit.id === event.fruitId)
      )
        return null;
      consumed.add(event.id);
      return event;
    },
  };
}
