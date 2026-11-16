export const TREE_MAX_FRUITS = 500;
export const TREE_MAX_EVENT_FRUITS = 200;
export const TREE_MAX_ID_LENGTH = 128;
export const TREE_MAX_SESSION_LENGTH = 80;

const escapedIdLength = TREE_MAX_ID_LENGTH * 6 + 2;
export const TREE_MAX_STATE_LENGTH =
  100000 +
  TREE_MAX_FRUITS * (escapedIdLength + 256) +
  TREE_MAX_EVENT_FRUITS * (escapedIdLength + 1);
