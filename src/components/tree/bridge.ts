import type { TreeProps } from "./types";
import {
  TREE_MAX_FRUITS,
  TREE_MAX_EVENT_FRUITS,
  TREE_MAX_ID_LENGTH,
  TREE_MAX_SESSION_LENGTH,
  TREE_MAX_STATE_LENGTH,
} from "./limits";
import {
  fruitAnchorSeed,
  normalizeFruits,
  normalizeWateringEvent,
} from "./fruit";

const count = (value: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;

export const normalizeAnswerCount = (value: number) => count(value, 1000);

export type TreeDataStatus =
  | { status: "ready"; fruitCount: number }
  | {
      status: "unavailable";
      reason: "capacity" | "invalid-data";
      fruitCount: number | null;
    };

export function getTreeDataStatus(
  props: Pick<TreeProps, "fruits" | "wateringEvent">,
): TreeDataStatus {
  const fruits = props.fruits;
  const fruitCount =
    fruits === undefined ? 0 : Array.isArray(fruits) ? fruits.length : null;
  if (fruitCount === null)
    return { status: "unavailable", reason: "invalid-data", fruitCount };
  const event = props.wateringEvent;
  if (
    fruitCount > TREE_MAX_FRUITS ||
    (Array.isArray(event?.fruitIds) &&
      event.fruitIds.length > TREE_MAX_EVENT_FRUITS)
  )
    return { status: "unavailable", reason: "capacity", fruitCount };
  const validId = (id: unknown) =>
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= TREE_MAX_ID_LENGTH &&
    /^[\x00-\x7f]+$/.test(id);
  for (const fruit of fruits ?? [])
    if (!fruit || !validId(fruit.id) || typeof fruit.golden !== "boolean")
      return { status: "unavailable", reason: "invalid-data", fruitCount };
  if (
    event !== undefined &&
    event !== null &&
    (!validId(event.id) ||
      !validId(event.fruitId) ||
      !Number.isSafeInteger(event.revision) ||
      event.revision < 1 ||
      (event.fruitIds !== undefined &&
        (!Array.isArray(event.fruitIds) || !event.fruitIds.length)))
  )
    return { status: "unavailable", reason: "invalid-data", fruitCount };
  for (const id of event?.fruitIds ?? [])
    if (!validId(id))
      return { status: "unavailable", reason: "invalid-data", fruitCount };
  return { status: "ready", fruitCount };
}

export function normalizeTreeState(props: TreeProps) {
  const answers = normalizeAnswerCount(props.answers);
  const lightBundles = count(props.lightBundles ?? 0, 1000);
  const event = props.lightEvent;
  const lightEvent =
    event &&
    typeof event.id === "string" &&
    event.id.length > 0 &&
    event.id.length <= 128 &&
    /^[\x00-\x7f]+$/.test(event.id) &&
    Number.isSafeInteger(event.revision) &&
    event.revision > 0 &&
    Number.isInteger(event.lightBundles) &&
    event.lightBundles > 0 &&
    event.lightBundles <= 1000
      ? {
          id: event.id,
          revision: event.revision,
          lightBundles: event.lightBundles,
        }
      : null;
  const validIndex = (value: number) =>
    Number.isInteger(value) && value >= 0 && value < answers;
  return {
    timeOfDay: Number.isFinite(props.timeOfDay)
      ? Math.min(1, Math.max(0, props.timeOfDay))
      : 0,
    answers,
    mine: Array.isArray(props.mine)
      ? [...new Set(props.mine.filter(validIndex))]
      : [],
    notes: Array.isArray(props.notes)
      ? props.notes
          .filter(
            (note) =>
              note &&
              validIndex(note.from) &&
              validIndex(note.to) &&
              note.from !== note.to,
          )
          .slice(0, 512)
          .map((note) => ({
            from: note.from,
            to: note.to,
            count: count(note.count, 32),
            own: note.own === true,
          }))
      : [],
    lanterns: count(props.lanterns, 64),
    ...(props.lightBundles !== undefined
      ? {
          lightBundles,
          goldenLightBundles: count(
            props.goldenLightBundles ?? 0,
            lightBundles,
          ),
        }
      : {}),
    ...(props.lightEvent !== undefined ? { lightEvent } : {}),
    fruits: normalizeFruits(props.fruits).map((fruit) => ({
      ...fruit,
      anchor: fruitAnchorSeed(fruit.id),
    })),
    wateringEvent: normalizeWateringEvent(props.wateringEvent),
  };
}

export function readTreeMessage(
  data: string,
):
  | { type: "ready"; session: string }
  | { type: "tap"; session: string; revision: number; index: number }
  | null {
  if (typeof data !== "string" || data.length > 512) return null;
  try {
    const message = JSON.parse(data);
    if (
      !message ||
      typeof message.session !== "string" ||
      message.session.length > TREE_MAX_SESSION_LENGTH ||
      !message.session.length
    )
      return null;
    if (message.type === "ready")
      return { type: "ready", session: message.session };
    if (
      message.type !== "tap" ||
      !Number.isInteger(message.revision) ||
      message.revision < 0 ||
      !Number.isInteger(message.index) ||
      message.index < 0
    )
      return null;
    return {
      type: "tap",
      session: message.session,
      revision: message.revision,
      index: message.index,
    };
  } catch {
    return null;
  }
}

export function serializeTreeState(
  props: TreeProps,
  session: string,
  revision: number,
  active: boolean,
  reduceMotion: boolean,
  includeFruits = true,
  includeEvent = true,
): string | null {
  if (
    !session.length ||
    session.length > TREE_MAX_SESSION_LENGTH ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return null;
  if (getTreeDataStatus(props).status !== "ready") return null;
  const { fruits, wateringEvent, ...state } = normalizeTreeState({
    ...props,
    fruits: includeFruits ? props.fruits : undefined,
    wateringEvent: includeEvent ? props.wateringEvent : undefined,
  });
  const data = JSON.stringify({
    type: "state",
    session,
    revision,
    ...state,
    ...(includeFruits ? { fruits } : {}),
    ...(includeEvent ? { wateringEvent } : {}),
    active,
    reduceMotion,
  });
  return data.length <= TREE_MAX_STATE_LENGTH ? data : null;
}

export function createTreeStateSerializer() {
  let session: string | null = null;
  let fruits: NonNullable<TreeProps["fruits"]> = [];
  let event: TreeProps["wateringEvent"] = null;
  const serialize = (
    props: TreeProps,
    nextSession: string,
    revision: number,
    active: boolean,
    reduceMotion: boolean,
  ) => {
    if (getTreeDataStatus(props).status !== "ready") return null;
    const nextFruits = props.fruits ?? [];
    const nextEvent = props.wateringEvent ?? null;
    const includeFruits =
      session !== nextSession ||
      nextFruits.length !== fruits.length ||
      nextFruits.some(
        (fruit, i) =>
          fruit.id !== fruits[i].id ||
          fruit.golden !== fruits[i].golden ||
          fruit.mine !== fruits[i].mine,
      );
    const includeEvent =
      session !== nextSession ||
      nextEvent?.id !== event?.id ||
      nextEvent?.fruitId !== event?.fruitId ||
      nextEvent?.revision !== event?.revision ||
      nextEvent?.fruitIds?.length !== event?.fruitIds?.length ||
      (nextEvent?.fruitIds?.some((id, i) => id !== event?.fruitIds?.[i]) ??
        false);
    const data = serializeTreeState(
      props,
      nextSession,
      revision,
      active,
      reduceMotion,
      includeFruits,
      includeEvent,
    );
    if (data === null) return null;
    session = nextSession;
    if (includeFruits)
      fruits = nextFruits.map(({ id, golden, mine }) => ({ id, golden, mine }));
    if (includeEvent)
      event = nextEvent
        ? {
            id: nextEvent.id,
            fruitId: nextEvent.fruitId,
            revision: nextEvent.revision,
            ...(nextEvent.fruitIds
              ? { fruitIds: [...nextEvent.fruitIds] }
              : {}),
          }
        : null;
    return data;
  };
  return Object.assign(serialize, {
    reset() {
      session = null;
      fruits = [];
      event = null;
    },
  });
}
