export const TREE_MAX_FRUITS = 10000;
export const TREE_MAX_ID_LENGTH = 256;
export const TREE_MAX_SESSION_LENGTH = 80;

const escapedIdLength = TREE_MAX_ID_LENGTH * 6 + 2;
const fruitAndEventEntryLength = escapedIdLength * 2 + 256;
export const TREE_MAX_STATE_LENGTH =
  100000 + TREE_MAX_FRUITS * fruitAndEventEntryLength;
