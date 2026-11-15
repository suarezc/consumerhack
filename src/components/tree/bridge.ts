import type { TreeProps } from "./types";
import {
  TREE_MAX_FRUITS,
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

export function normalizeTreeState(props: TreeProps) {
  const answers = count(props.answers, 1000);
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
): string | null {
  const state = normalizeTreeState(props);
  if (
    state.fruits.length > TREE_MAX_FRUITS ||
    (state.wateringEvent?.fruitIds?.length ?? 0) > TREE_MAX_FRUITS ||
    !session.length ||
    session.length > TREE_MAX_SESSION_LENGTH ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return null;
  const data = JSON.stringify({
    type: "state",
    session,
    revision,
    ...state,
    active,
    reduceMotion,
  });
  return data.length <= TREE_MAX_STATE_LENGTH ? data : null;
}
